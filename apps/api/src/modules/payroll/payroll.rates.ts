import type {
  RateCheckStatus,
  RateProtocolDto,
  RateProtocolRowDto,
  SetContractRateInput,
  SetContractRatesInput,
  SetContractRatesResultDto,
  TeacherContractRateDto,
} from "@pitoo/contracts";
import { Prisma, Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as repo from "./payroll.repository.js";
import { PAYROLL_COUNTED_STATUSES, applyDiscount, attendanceMinutes, settleAttendanceEarningInTx } from "./payroll.service.js";
import type { Tx } from "../../shared/db/prisma.js";

// D-67: багш хүүхэд тус бүр дээрээ цагийн үнэлгээгээ оруулдаг. Захирал протоколоор тулгаж шалгана.

interface Actor {
  id: string;
  role: Role;
}

function ubToday(): string {
  const local = new Date(Date.now() + 8 * 3_600_000);
  return local.toISOString().slice(0, 10);
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function notOwner(): never {
  throw new DomainError({
    code: "forbidden-contract-rate",
    status: 403,
    title: "Эрх хүрэхгүй байна",
    detail: "Та зөвхөн өөрийн ангийн сурагчид цагийн үнэлгээ оруулна.",
  });
}

// D-68: цагийн цалин хүүхэд (гэрээ), багш хос бүрт нэг утгатай. effective_from нь тогтмол (хамгийн эртний огноо)
// тул засахад мөр шинэчлэгдэнэ, түүх аудитад үлдэнэ.
const RATE_EPOCH = new Date("2000-01-01");

type TrueUpParams = { contractId: string; teacherId: string; createdBy: string; note: string };

// Тухайн багшийн энэ хүүхдэд цалинд тооцогдсон БҮХ ирцийн цалинг одоогийн цагийн цалин (хөнгөлөлттэй) x
// хугацаанд тулгана: зөрүүг ADJUSTMENT мөрөөр бичнэ (ADR-010: анхны EARNING засагдахгүй). Давтан дуудахад
// зөрүү 0 тул мөр нэмэгдэхгүй. Хэдэн ирцэд зөрүү бичсэнийг буцаана.
export async function trueUpContractEarningsInTx(tx: Tx, p: TrueUpParams): Promise<number> {
  const rows = await repo.listCountedLessonsForTrueUp(tx, {
    teacherId: p.teacherId,
    contractId: p.contractId,
    statuses: PAYROLL_COUNTED_STATUSES,
  });
  let adjusted = 0;
  for (const row of rows) {
    const entry = await settleAttendanceEarningInTx(tx, {
      attendanceId: row.id,
      contractId: p.contractId,
      lessonId: row.lessonId,
      teacherId: p.teacherId,
      lessonDate: new Date(new Date(row.lesson.startsAt.getTime() + 8 * 3_600_000).toISOString().slice(0, 10)),
      durationMin: attendanceMinutes(row, row.lesson),
      counted: true,
      note: p.note,
      createdBy: p.createdBy,
    });
    if (entry) adjusted += 1;
  }
  return adjusted;
}

// Ах дүүгийн хөнгөлөлт өөрчлөгдөхөд энэ гэрээнд цагийн цалин оруулсан бүх багшийн цалинг тулгана (enrollment дуудна).
export async function trueUpContractAllTeachersInTx(tx: Tx, contractId: string, createdBy: string, note: string) {
  for (const teacherId of await repo.listRateTeachers(tx, contractId)) {
    await trueUpContractEarningsInTx(tx, { contractId, teacherId, createdBy, note });
  }
}

// Нэг хүүхдийн цагийн цалинг бичиж, өмнөх бүх хичээлийн цалинг шинэ цалингаар тулгана. Транзакцыг дуудагч нээнэ
// (нэг хүүхэд, эсвэл D-99 бөөнөөр оруулахад олон хүүхэд нэг транзакцад).
async function applyContractRateInTx(tx: Tx, actor: Actor, contractId: string, hourlyRate: string) {
  if (!(await repo.teacherHasContract(tx, actor.id, contractId))) notOwner();

  const before = await repo.findEffectiveContractRate(tx, contractId, actor.id, new Date());
  const saved = await repo.upsertContractRate(tx, {
    contractId,
    teacherId: actor.id,
    hourlyRate,
    effectiveFrom: RATE_EPOCH,
    createdBy: actor.id,
  });
  await repo.deleteContractRatesExcept(tx, { contractId, teacherId: actor.id, keepFrom: RATE_EPOCH });
  await writeAudit(tx, {
    entity: "contract_rate",
    entityId: saved.id,
    action: before ? "UPDATE" : "CREATE",
    before: before ? { hourlyRate: before.hourlyRate.toFixed(2) } : null,
    after: { contractId, hourlyRate },
    actorId: actor.id,
  });

  return trueUpContractEarningsInTx(tx, {
    contractId,
    teacherId: actor.id,
    createdBy: actor.id,
    note: "Цагийн цалин өөрчлөгдсөн тул нөхөн бодолт",
  });
}

// Багш хүүхэд бүр дээрээ цагийн цалингаа гараар оруулна, хэзээ ч засна. Засвар тухайн хүүхдийн бүх хичээлийн
// (өмнөх ба дараах) цалинд үйлчилнэ: авах цалин = цалингийн цаг x цагийн цалин.
export async function setContractRate(actor: Actor, contractId: string, input: SetContractRateInput) {
  if (actor.role !== Role.TEACHER) notOwner();

  return prisma.$transaction(async (tx) => {
    const adjusted = await applyContractRateInTx(tx, actor, contractId, input.hourlyRate);
    return { contractId, hourlyRate: input.hourlyRate, adjusted };
  });
}

// D-99: багш бүх идэвхтэй хүүхдийнхээ цагийн цалинг нэг дор хадгална. НЭГ транзакц: аль нэг хүүхэд өөрийнх биш бол
// (403) эсвэл алдаа гарвал юу ч хадгалагдахгүй. Өмнөхөөсөө ялгаагүй утгыг дахин бичихгүй (аудит, нөхөн бодолт шаардлагагүй).
// Хүүхэд бүрийн цалин өөрийнх нь цагийн цалингаар бодогдоно (applyContractRateInTx дотор).
export async function setContractRates(
  actor: Actor,
  input: SetContractRatesInput,
): Promise<SetContractRatesResultDto> {
  if (actor.role !== Role.TEACHER) notOwner();

  return prisma.$transaction(async (tx) => {
    let updated = 0;
    let adjusted = 0;
    for (const row of input.rates) {
      // Эзэмшлийг эхлээд шалгана: ялгаагүй утгатай мөр ч бусдын гэрээ байж болохгүй (BOLA).
      if (!(await repo.teacherHasContract(tx, actor.id, row.contractId))) notOwner();
      const current = await repo.findEffectiveContractRate(tx, row.contractId, actor.id, new Date());
      if (current && current.hourlyRate.equals(new Prisma.Decimal(row.hourlyRate))) continue;
      adjusted += await applyContractRateInTx(tx, actor, row.contractId, row.hourlyRate);
      updated += 1;
    }
    return { updated, adjusted };
  });
}

// Багш өөрийн сурагч бүрийн одоогийн үнэлгээг харна (протоколыг харуулахгүй).
export async function listMyRates(actor: Actor): Promise<TeacherContractRateDto[]> {
  const contracts = await repo.listTeacherContracts(prisma, actor.id);
  return contracts.map((c) => {
    const current = c.rates[0] ?? null;
    return {
      contractId: c.id,
      studentId: c.student.id,
      studentName: c.student.fullName,
      programName: c.program.name,
      hourlyRate: current ? current.hourlyRate.toFixed(2) : null,
      discountPercent: c.siblingDiscountPercent.toFixed(2),
      effectiveRate: current ? applyDiscount(current.hourlyRate, c.siblingDiscountPercent).toFixed(2) : null,
    };
  });
}

function checkStatus(entered: Prisma.Decimal | null, protocol: Prisma.Decimal | null): RateCheckStatus {
  if (!protocol) return "NO_PROTOCOL";
  if (!entered) return "MISSING";
  return entered.equals(protocol) ? "MATCH" : "DIFFERENT";
}

// Захирал: хөтөлбөрийн протоколын үнэлгээг багшийн оруулсан үнэлгээтэй багш, хүүхдээр нь тулгана.
// Протокол нь зөвхөн лавлах: цалинд нөлөөлөхгүй. Тулгалтад хөнгөлөлтийн өмнөх (багшийн оруулсан) үнэлгээг авна.
export async function getRateProtocol(q: {
  teacherId?: string;
  programId?: string;
  status?: RateCheckStatus;
}): Promise<RateProtocolDto> {
  const today = new Date(ubToday());
  const [programs, pairs] = await Promise.all([repo.listPrograms(prisma), repo.listProtocolPairs(prisma)]);

  const seen = new Set<string>();
  const rows: RateProtocolRowDto[] = [];
  for (const e of pairs) {
    const teacherId = e.class.teacherId;
    const key = `${teacherId}:${e.contract.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (q.teacherId && q.teacherId !== teacherId) continue;
    if (q.programId && q.programId !== e.contract.program.id) continue;

    const current =
      e.contract.rates.find((r) => r.teacherId === teacherId && r.effectiveFrom.getTime() <= today.getTime()) ?? null;
    const protocol = e.contract.program.protocolHourlyRate;
    const status = checkStatus(current?.hourlyRate ?? null, protocol);
    if (q.status && q.status !== status) continue;
    rows.push({
      teacherId,
      teacherName: e.class.teacher.fullName,
      contractId: e.contract.id,
      studentName: e.contract.student.fullName,
      programId: e.contract.program.id,
      programName: e.contract.program.name,
      protocolRate: protocol ? protocol.toFixed(2) : null,
      enteredRate: current ? current.hourlyRate.toFixed(2) : null,
      discountPercent: e.contract.siblingDiscountPercent.toFixed(2),
      status,
    });
  }
  rows.sort((a, b) => a.teacherName.localeCompare(b.teacherName) || a.studentName.localeCompare(b.studentName));

  return {
    programs: programs.map((p) => ({
      id: p.id,
      name: p.name,
      protocolRate: p.protocolHourlyRate ? p.protocolHourlyRate.toFixed(2) : null,
    })),
    rows,
  };
}
