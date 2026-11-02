import {
  AttendanceStatus,
  ContractStatus,
  LessonStatus,
  Role,
  type Prisma,
} from "../../generated/prisma/client.js";
import type { AttendanceRowDto, AttendanceSheetDto } from "@pitoo/contracts";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { runIdempotent } from "../../shared/idempotency/run-idempotent.js";
import { balancesFor, teacherFlag } from "../../shared/payments/payment-status.js";
import { enqueue } from "../../shared/outbox/enqueue.js";
import { getAttendanceDefaults } from "../catalog/catalog.service.js";
import { notifyParentsInTx } from "../enrollment/enrollment.service.js";
import {
  recordAttendanceEarningInTx,
  settleAttendanceEarningInTx,
} from "../payroll/payroll.service.js";
import { todayInUlaanbaatar } from "../scheduling/scheduling.service.js";
import {
  applyDelta,
  crossedToThree,
  decideStatus,
  effectsOf,
  inverseOf,
  meetingVisitReached,
} from "./attendance.rules.js";
import * as repo from "./attendance.repository.js";

// ФШ-26...37: ирц бүртгэх, засах, нөхөлт, түүх (design 6.1, 6.2). Нэг бизнес үйлдэл
// нэг транзакц: ирц, багц, чөлөө, цалин, мэдэгдэл, аудит нэг дор (ФШ-32, ФБШ-17).

export interface Actor {
  id: string;
  role: Role;
}

function rejected(status: number, code: string, title: string, detail: string): never {
  throw new DomainError({ code, status, title, detail });
}

const HOUR_MS = 3_600_000;

function windowOf(lesson: { startsAt: Date; endsAt: Date }, editWindowHours: number, now: Date) {
  const editableUntil = new Date(lesson.endsAt.getTime() + editWindowHours * HOUR_MS);
  return {
    editableUntil,
    windowOpen: now.getTime() <= editableUntil.getTime(),
    started: now.getTime() >= lesson.startsAt.getTime(),
  };
}

// Хичээлийн Улаанбаатарын календарийн өдөр (UTC 00:00): enrollment.from_date-тэй харьцуулна.
function lessonDay(startsAt: Date): Date {
  const local = new Date(startsAt.getTime() + 8 * HOUR_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

async function loadLesson(tx: Tx, actor: Actor, lessonId: string) {
  const lesson = await repo.findLessonWithContext(tx, lessonId);
  if (!lesson) rejected(404, "lesson-not-found", "Хичээл олдсонгүй", "Заасан хичээл бүртгэлгүй байна.");
  // ADR-008: багш зөвхөн өөрийн хичээлийн ирцийг бүртгэнэ.
  if (actor.role !== Role.ADMIN && lesson.teacherId !== actor.id) {
    rejected(403, "forbidden-lesson", "Эрх хүрэхгүй байна", "Энэ хичээл таных биш байна.");
  }
  return lesson;
}

// Бичих үйлдлийн нөхцөл: цуцлагдаагүй, эхэлсэн, 24 цагийн дотор (ФШ-33). Хугацаа
// хэтэрсэн бол багшид хаалттай, админ шалтгаан бичиж болно.
async function loadLessonForWrite(tx: Tx, actor: Actor, lessonId: string, reason?: string) {
  const lesson = await loadLesson(tx, actor, lessonId);
  if (lesson.status === LessonStatus.CANCELLED) {
    rejected(409, "lesson-cancelled", "Хичээл цуцлагдсан", "Цуцлагдсан хичээлд ирц бүртгэгдэхгүй.");
  }
  const { editWindowHours } = await getAttendanceDefaults(tx);
  const win = windowOf(lesson, editWindowHours, new Date());
  if (!win.started) {
    rejected(409, "lesson-not-started", "Хичээл эхлээгүй байна", "Хичээл эхэлснээс хойш ирц бүртгэнэ.");
  }
  if (!win.windowOpen) {
    if (actor.role !== Role.ADMIN) {
      rejected(
        409,
        "attendance-window-closed",
        "Ирц засах хугацаа дууссан",
        `Хичээл дууссанаас хойш ${editWindowHours} цагийн дараа зөвхөн админ засна. Админд хандана уу.`,
      );
    }
    if (!reason) {
      rejected(409, "reason-required", "Шалтгаан шаардлагатай", "Хугацаа хэтэрсэн ирцийг засахад шалтгаан заавал бичнэ.");
    }
  }
  return lesson;
}

type LessonCtx = NonNullable<Awaited<ReturnType<typeof repo.findLessonWithContext>>>;

interface RowResult {
  attendanceId: string;
  contractId: string;
  status: AttendanceStatus;
  remainingVisits: number;
  leavesLeft: number;
}

function durationMin(lesson: LessonCtx): number {
  return Math.round((lesson.endsAt.getTime() - lesson.startsAt.getTime()) / 60_000);
}

// Тоолуурын шилжилт: Дууссан, багц дуусах, уулзалтын сануулга (ФШ-36, 37, 43).
async function afterCounterChange(
  tx: Tx,
  params: {
    lesson: LessonCtx;
    contract: { id: string; studentId: string; status: ContractStatus; totalVisits: number };
    studentName: string;
    beforeRemaining: number;
    afterRemaining: number;
  },
): Promise<ContractStatus> {
  const { lesson, contract, beforeRemaining, afterRemaining } = params;
  let status = contract.status;

  if (status === ContractStatus.ACTIVE && afterRemaining === 0) {
    status = ContractStatus.COMPLETED;
    // ФШ-37: багц дуусахад багшид шалгалтын ажил.
    if (!(await repo.findOpenTeacherTask(tx, contract.id, "EXAM"))) {
      await repo.createTeacherTask(tx, {
        teacherId: lesson.teacherId,
        type: "EXAM",
        contractId: contract.id,
        dueOn: todayInUlaanbaatar(),
      });
    }
  } else if (status === ContractStatus.COMPLETED && afterRemaining > 0) {
    // Засвараар үлдэгдэл 0-ээс 1 болбол гэрээ "Идэвхтэй" руу буцна (3.8.2).
    status = ContractStatus.ACTIVE;
  }

  // ФШ-36: үлдэгдэл 4-өөс 3 болоход эцэг эх, багшид нэг л мэдэгдэл.
  if (crossedToThree(beforeRemaining, afterRemaining)) {
    const payload = { studentName: params.studentName, remainingVisits: afterRemaining };
    await notifyParentsInTx(tx, contract.studentId, "package_ending", payload);
    await enqueue(tx, {
      recipientId: lesson.teacherId,
      channel: "PUSH",
      template: "package_ending",
      payload,
    });
  }

  // ФШ-43: 13 ба 25 дахь ирэлтэд эцэг эхтэй уулзах сануулга.
  if (meetingVisitReached(contract.totalVisits, beforeRemaining, afterRemaining)) {
    if (!(await repo.findOpenTeacherTask(tx, contract.id, "MEETING"))) {
      await repo.createTeacherTask(tx, {
        teacherId: lesson.teacherId,
        type: "MEETING",
        contractId: contract.id,
        dueOn: todayInUlaanbaatar(),
      });
    }
  }
  return status;
}

// Ирцийн шинэ мөр үүсгэж, нөлөөг (тоолуур, цалин, мэдэгдэл, аудит) нэг транзакцад хэрэглэнэ.
async function createRow(
  tx: Tx,
  actor: Actor,
  lesson: LessonCtx,
  contractId: string,
  present: boolean,
  isMakeup: boolean,
  reason?: string,
): Promise<RowResult | null> {
  const contract = await repo.findContractWithStudent(tx, contractId);
  if (!contract) {
    rejected(404, "contract-not-found", "Гэрээ олдсонгүй", "Заасан гэрээ бүртгэлгүй байна.");
  }

  const status = decideStatus({
    present,
    isMakeup,
    contractStatus: contract.status,
    leavesLeft: contract.leavesLeft,
    freeReviewsLeft: contract.freeReviewsLeft,
  });
  if (status === null) return null;

  const effects = effectsOf(status);
  const before = {
    remainingVisits: contract.remainingVisits,
    leavesLeft: contract.leavesLeft,
    freeReviewsLeft: contract.freeReviewsLeft,
  };
  const after = applyDelta(before, effects);

  const row = await repo.createAttendance(tx, {
    lessonId: lesson.id,
    contractId,
    marked: present,
    status,
    isMakeup,
    updatedBy: actor.id,
  });

  const newStatus = await afterCounterChange(tx, {
    lesson,
    contract,
    studentName: contract.student.fullName,
    beforeRemaining: before.remainingVisits,
    afterRemaining: after.remainingVisits,
  });
  await repo.updateContractCounters(tx, contractId, { ...after, status: newStatus });

  if (effects.counted) {
    await recordAttendanceEarningInTx(tx, {
      attendanceId: row.id,
      lessonId: lesson.id,
      teacherId: lesson.teacherId,
      lessonDate: lessonDay(lesson.startsAt),
      durationMin: durationMin(lesson),
      createdBy: actor.id,
    });
  }

  // ФШ-61: эцэг эхэд ирцийн төлөв, үлдсэн ирэлт, үлдсэн чөлөө.
  await notifyParentsInTx(tx, contract.studentId, "attendance_recorded", {
    studentName: contract.student.fullName,
    lessonStartsAt: lesson.startsAt.toISOString(),
    status,
    remainingVisits: after.remainingVisits,
    leavesLeft: after.leavesLeft,
  });

  await writeAudit(tx, {
    entity: "attendance",
    entityId: row.id,
    action: "CREATE",
    after: { status, present, isMakeup, remainingVisits: after.remainingVisits, leavesLeft: after.leavesLeft },
    reason,
    actorId: actor.id,
  });

  return {
    attendanceId: row.id,
    contractId,
    status,
    remainingVisits: after.remainingVisits,
    leavesLeft: after.leavesLeft,
  };
}

function sortedUnique(ids: string[]) {
  return [...new Set(ids)].sort();
}

// ФШ-27...29, 32, 36, 37, 43, 61, ФБШ-15, 17 (design 3.8.1): ирц хадгалах.
export function saveAttendance(
  actor: Actor,
  lessonId: string,
  input: { entries: { contractId: string; present: boolean }[]; reason?: string },
  idempotencyKey: string,
) {
  return runIdempotent(idempotencyKey, actor.id, async (tx) => {
    const lesson = await loadLessonForWrite(tx, actor, lessonId, input.reason);

    const contractIds = sortedUnique(input.entries.map((e) => e.contractId));
    if (contractIds.length !== input.entries.length) {
      rejected(409, "duplicate-entry", "Давхардсан мөр байна", "Нэг сурагчийн ирцийг нэг л удаа илгээнэ.");
    }

    const roster = await repo.findRosterEnrollments(tx, lesson.classId, lessonDay(lesson.startsAt));
    const rosterIds = new Set(roster.map((e) => e.contractId));
    const existing = await repo.findAttendanceByLesson(tx, lessonId);
    const existingIds = new Set(existing.map((a) => a.contractId));

    for (const id of contractIds) {
      if (existingIds.has(id)) {
        rejected(
          409,
          "attendance-exists",
          "Ирц аль хэдийн бүртгэгдсэн",
          "Бүртгэгдсэн ирцийг мөр бүрээр нь засна.",
        );
      }
      if (!rosterIds.has(id)) {
        rejected(
          409,
          "not-in-roster",
          "Сурагч энэ хичээлд бүртгэлгүй",
          "Түр зогссон эсвэл энэ ангид бүртгэлгүй сурагчийн ирцийг бүртгэх боломжгүй.",
        );
      }
    }

    // ADR-009, ЧХ-1: тоолуурын мөрүүдийг түгжинэ (тогтмол эрэмбээр, түгжээний мухардал гарахгүй).
    await repo.lockContractsForUpdate(tx, contractIds);

    const results: RowResult[] = [];
    for (const entry of input.entries) {
      const result = await createRow(tx, actor, lesson, entry.contractId, entry.present, false, input.reason);
      if (result) results.push(result);
    }
    return {
      entries: results.map((r) => ({
        attendanceId: r.attendanceId,
        contractId: r.contractId,
        status: r.status,
        remainingVisits: r.remainingVisits,
        leavesLeft: r.leavesLeft,
      })),
    };
  });
}

// ФШ-31: нөхөлт нэмэх.
export function addMakeup(
  actor: Actor,
  lessonId: string,
  input: { contractId: string; reason?: string },
  idempotencyKey: string,
) {
  return runIdempotent(idempotencyKey, actor.id, async (tx) => {
    const lesson = await loadLessonForWrite(tx, actor, lessonId, input.reason);
    await repo.lockContractsForUpdate(tx, [input.contractId]);

    const candidates = await repo.findMakeupCandidateEnrollments(tx, lesson.teacherId, lesson.classId);
    if (!candidates.some((c) => c.contractId === input.contractId)) {
      rejected(
        409,
        "makeup-not-allowed",
        "Нөхөлтөд нэмэх боломжгүй",
        "Нөхөлтөд зөвхөн таны өөр ангийн идэвхтэй сурагчийг нэмнэ.",
      );
    }

    const roster = await repo.findRosterEnrollments(tx, lesson.classId, lessonDay(lesson.startsAt));
    const existing = await repo.findAttendanceByLesson(tx, lessonId);
    if (
      roster.some((e) => e.contractId === input.contractId) ||
      existing.some((a) => a.contractId === input.contractId)
    ) {
      rejected(409, "makeup-duplicate", "Сурагч энэ хичээлд байна", "Энэ сурагч уг хичээлийн жагсаалтад аль хэдийн байна.");
    }

    // ФШ-31: ангийн суудлын хязгаар нөхөлтөд мөн үйлчилнэ.
    const makeupRows = existing.filter((a) => a.isMakeup).length;
    if (roster.length + makeupRows >= lesson.class.capacity) {
      rejected(409, "class-full", "Анги дүүрсэн байна", "Энэ хичээлд зөвшөөрөгдөх дээд хэмжээний сурагч байна.");
    }

    // ФШ-31: нөхөлтийн тоо нөхөгдөөгүй чөлөөний тооноос хэтрэхгүй.
    const { excused, makeups } = await repo.countExcusedAndMakeups(tx, input.contractId);
    if (makeups >= excused) {
      rejected(409, "no-makeup-available", "Нөхөх чөлөө байхгүй", "Энэ сурагчид нөхөгдөөгүй чөлөөтэй хичээл байхгүй байна.");
    }

    const result = await createRow(tx, actor, lesson, input.contractId, true, true, input.reason);
    if (!result) rejected(409, "makeup-failed", "Нөхөлт бүртгэгдсэнгүй", "Нөхөлтийг бүртгэх боломжгүй байна.");
    return { ...result };
  });
}

// ФШ-33, 34, 35, Хүснэгт 3.15 (design 3.8.2): ирц засах. Хуучин төлвийн нөлөөг
// бүрэн буцааж, шинэ тэмдэглэгээг ирц бүртгэх дүрмээр дахин хэрэглэнэ. Засвар
// зөвхөн тухайн мөрөнд нөлөөлнө.
export function patchAttendance(
  actor: Actor,
  attendanceId: string,
  input: { present: boolean; reason?: string },
) {
  return prisma.$transaction(async (tx) => {
    const found = await repo.findAttendanceById(tx, attendanceId);
    if (!found) rejected(404, "attendance-not-found", "Ирц олдсонгүй", "Заасан ирцийн бичлэг байхгүй.");
    const lesson = await loadLessonForWrite(tx, actor, found.lessonId, input.reason);

    await repo.lockContractsForUpdate(tx, [found.contractId]);
    const contract = await repo.findContractWithStudent(tx, found.contractId);
    const row = await repo.findAttendanceById(tx, attendanceId);
    if (!contract || !row) rejected(404, "attendance-not-found", "Ирц олдсонгүй", "Заасан ирцийн бичлэг байхгүй.");

    const oldStatus = row.status;
    if (oldStatus === AttendanceStatus.FREE_REVIEW && !input.present) {
      rejected(
        409,
        "free-review-edit-unsupported",
        "Үнэгүй давтлагыг ирээгүй болгох боломжгүй",
        "Үнэгүй давтлагын ирцийг өөрчлөх шаардлагатай бол админтай холбогдоно уу.",
      );
    }

    const counters0 = {
      remainingVisits: contract.remainingVisits,
      leavesLeft: contract.leavesLeft,
      freeReviewsLeft: contract.freeReviewsLeft,
    };
    const oldEffects = effectsOf(oldStatus);
    const counters1 = applyDelta(counters0, inverseOf(oldEffects));

    // Чөлөөний эрхийг засвар хийх мөчийн үлдэгдлээр шалгана (3.8.2).
    const effectiveStatus =
      contract.status === ContractStatus.COMPLETED && counters1.remainingVisits > 0
        ? ContractStatus.ACTIVE
        : contract.status;
    const newStatus = decideStatus({
      present: input.present,
      isMakeup: row.isMakeup,
      contractStatus: effectiveStatus,
      leavesLeft: counters1.leavesLeft,
      freeReviewsLeft: counters1.freeReviewsLeft,
    });
    if (newStatus === null) {
      rejected(409, "attendance-edit-invalid", "Засах боломжгүй", "Энэ ирцийг ийм утгаар засах боломжгүй.");
    }
    const newEffects = effectsOf(newStatus);
    const counters2 = applyDelta(counters1, newEffects);

    await repo.updateAttendance(tx, attendanceId, {
      marked: input.present,
      status: newStatus,
      updatedBy: actor.id,
    });

    const finalStatus = await afterCounterChange(tx, {
      lesson,
      contract,
      studentName: contract.student.fullName,
      beforeRemaining: counters0.remainingVisits,
      afterRemaining: counters2.remainingVisits,
    });
    await repo.updateContractCounters(tx, contract.id, { ...counters2, status: finalStatus });

    // ФШ-34, ADR-017: EARNING мөр хэвээр, зөрүүг ADJUSTMENT мөрөөр.
    await settleAttendanceEarningInTx(tx, {
      attendanceId,
      lessonId: lesson.id,
      teacherId: lesson.teacherId,
      lessonDate: lessonDay(lesson.startsAt),
      durationMin: durationMin(lesson),
      counted: newEffects.counted,
      note: `Ирц засав: ${oldStatus} -> ${newStatus}`,
      createdBy: actor.id,
    });

    await notifyParentsInTx(tx, contract.studentId, "attendance_updated", {
      studentName: contract.student.fullName,
      lessonStartsAt: lesson.startsAt.toISOString(),
      status: newStatus,
      remainingVisits: counters2.remainingVisits,
      leavesLeft: counters2.leavesLeft,
    });

    // ФШ-35: хэн, хэзээ, өмнөх ба шинэ утга, шалтгаан.
    await writeAudit(tx, {
      entity: "attendance",
      entityId: attendanceId,
      action: "UPDATE",
      before: { status: oldStatus, present: row.marked, remainingVisits: counters0.remainingVisits, leavesLeft: counters0.leavesLeft },
      after: { status: newStatus, present: input.present, remainingVisits: counters2.remainingVisits, leavesLeft: counters2.leavesLeft },
      reason: input.reason,
      actorId: actor.id,
    });

    return {
      attendanceId,
      contractId: contract.id,
      status: newStatus,
      remainingVisits: counters2.remainingVisits,
      leavesLeft: counters2.leavesLeft,
    };
  });
}

// ФШ-27, 30, 51, ФБШ-08: ирцийн дэлгэц.
export async function getAttendanceSheet(actor: Actor, lessonId: string): Promise<AttendanceSheetDto> {
  return prisma.$transaction(async (tx) => {
    const lesson = await loadLesson(tx, actor, lessonId);
    const { editWindowHours } = await getAttendanceDefaults(tx);
    const win = windowOf(lesson, editWindowHours, new Date());

    const roster = await repo.findRosterEnrollments(tx, lesson.classId, lessonDay(lesson.startsAt));
    const existing = await repo.findAttendanceByLesson(tx, lessonId);
    const leaves = new Set((await repo.findLeaveRequestsByLesson(tx, lessonId)).map((l) => l.contractId));
    const byContract = new Map(existing.map((a) => [a.contractId, a]));

    // ФШ-51: төлбөрийн төлвийг дүнгүйгээр ("Бүрэн" / "Үлдэгдэлтэй").
    const allContracts = [...roster.map((e) => e.contract), ...existing.map((a) => a.contract)];
    const balances = await balancesFor(tx, allContracts);
    const rows: AttendanceRowDto[] = [];
    const seen = new Set<string>();
    const add = (contract: (typeof roster)[number]["contract"], isMakeupHint: boolean) => {
      if (seen.has(contract.id)) return;
      seen.add(contract.id);
      const att = byContract.get(contract.id);
      rows.push({
        contractId: contract.id,
        studentId: contract.studentId,
        studentName: contract.student.fullName,
        programName: contract.program.name,
        remainingVisits: contract.remainingVisits,
        leavesLeft: contract.leavesLeft,
        totalVisits: contract.totalVisits,
        paymentStatus: balances.has(contract.id) ? teacherFlag(balances.get(contract.id)!) : null,
        leaveRequested: leaves.has(contract.id),
        isMakeup: att?.isMakeup ?? isMakeupHint,
        attendanceId: att?.id ?? null,
        status: att?.status ?? null,
        present: att ? att.marked : null,
      });
    };
    for (const e of roster) add(e.contract, false);
    for (const a of existing) add(a.contract, a.isMakeup);
    rows.sort((a, b) => a.studentName.localeCompare(b.studentName, "mn"));

    return {
      lesson: {
        id: lesson.id,
        startsAt: lesson.startsAt.toISOString(),
        endsAt: lesson.endsAt.toISOString(),
        status: lesson.status,
        branchName: lesson.class.branch.name,
        teacherName: lesson.teacher.fullName,
        capacity: lesson.class.capacity,
      },
      editableUntil: win.editableUntil.toISOString(),
      windowOpen: win.windowOpen,
      started: win.started,
      rows,
    };
  });
}

// ФШ-31: нөхөлтийн нэр дэвшигчид (багшийн өөр ангийн идэвхтэй сурагчид).
export async function listMakeupCandidates(actor: Actor, lessonId: string) {
  return prisma.$transaction(async (tx) => {
    const lesson = await loadLesson(tx, actor, lessonId);
    const roster = await repo.findRosterEnrollments(tx, lesson.classId, lessonDay(lesson.startsAt));
    const existing = await repo.findAttendanceByLesson(tx, lessonId);
    const taken = new Set([...roster.map((e) => e.contractId), ...existing.map((a) => a.contractId)]);
    const seats = lesson.class.capacity - roster.length - existing.filter((a) => a.isMakeup).length;

    const enrollments = await repo.findMakeupCandidateEnrollments(tx, lesson.teacherId, lesson.classId);
    const seenContracts = new Set<string>();
    const items = [];
    for (const e of enrollments) {
      if (taken.has(e.contractId) || seenContracts.has(e.contractId)) continue;
      seenContracts.add(e.contractId);
      const { excused, makeups } = await repo.countExcusedAndMakeups(tx, e.contractId);
      if (makeups >= excused) continue;
      items.push({
        contractId: e.contractId,
        studentName: e.contract.student.fullName,
        programName: e.contract.program.name,
        remainingVisits: e.contract.remainingVisits,
        leavesLeft: e.contract.leavesLeft,
        makeupsAvailable: excused - makeups,
      });
    }
    return { seatsFree: Math.max(0, seats), items };
  });
}

// ФШ-35: ирцийн өөрчлөлтийн түүх (админ).
export async function getAttendanceHistory(attendanceId: string) {
  const rows = await repo.findAuditHistoryWithActor(prisma, attendanceId);
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    before: r.before as Prisma.JsonValue,
    after: r.after as Prisma.JsonValue,
    reason: r.reason,
    actor: r.actor.phone ?? r.actor.email ?? r.actorId,
    createdAt: r.createdAt.toISOString(),
  }));
}

// ФШ-70, шинэ шаардлага 1.5: нэг өдрийн хичээлүүд, ирц бөглөгдсөн эсэх. Багшид өөрийн,
// админд бүгд (салбар, багшаар шүүнэ).
export async function listLessonsForDay(
  actor: Actor,
  filters: { date: string; branchId?: string; teacherId?: string },
) {
  const dayStart = new Date(`${filters.date}T00:00:00+08:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * HOUR_MS);
  return prisma.$transaction(async (tx) => {
    const lessons = await repo.findLessonsForDay(
      tx,
      { from: dayStart, to: dayEnd },
      {
        branchId: filters.branchId,
        teacherId: actor.role === Role.ADMIN ? filters.teacherId : actor.id,
      },
    );
    const items = [];
    for (const lesson of lessons) {
      const roster = await repo.findRosterEnrollments(tx, lesson.classId, lessonDay(lesson.startsAt));
      items.push({
        id: lesson.id,
        startsAt: lesson.startsAt.toISOString(),
        endsAt: lesson.endsAt.toISOString(),
        status: lesson.status,
        branchName: lesson.class.branch.name,
        teacherName: lesson.teacher.fullName,
        expected: roster.length,
        recorded: lesson._count.attendance,
      });
    }
    return items;
  });
}
