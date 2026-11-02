import type {
  AssessmentDto,
  CreateMeetingInput,
  CreateNoteInput,
  NoteDto,
  ProgressDto,
  RecordAssessmentInput,
  TeacherTaskDto,
  UpdateNoteInput,
} from "@pitoo/contracts";
import { AssessmentType, NoteVisibility, Prisma, Role } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { getAssessmentDefaults } from "../catalog/catalog.service.js";
import {
  assertContractAccessInTx,
  assertStudentReadAccessInTx,
  getContractForUserInTx,
  notifyParentsInTx,
} from "../enrollment/enrollment.service.js";
import * as repo from "./progress.repository.js";

// М6 Сургалтын явц (ФШ-38...45). Бүх босго (93%, 3 давтлага, 60%) settings-ээс (ФБШ-29).

interface Actor {
  id: string;
  role: Role;
}

function rejected(status: number, code: string, title: string, detail: string, extra?: Record<string, unknown>): never {
  throw new DomainError({ code, status, title, detail, extra });
}

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

function mapAssessment(a: Awaited<ReturnType<typeof repo.listAssessments>>[number]): AssessmentDto {
  return {
    id: a.id,
    type: a.type,
    takenOn: a.takenOn.toISOString().slice(0, 10),
    totalPercent: a.totalPercent.toFixed(2),
    contractId: a.contractId,
    programName: a.contract?.program.name ?? null,
    topics: a.topics.map((t) => ({ topic: t.topic, scorePercent: t.scorePercent.toFixed(2) })),
  };
}

// ФШ-38, 39: сорил, шалтгаан бүртгэх. 93%-иас доош багцын шалгалтад давтлагын эрх.
export function recordAssessment(actor: Actor, studentId: string, input: RecordAssessmentInput) {
  return prisma.$transaction(async (tx) => {
    const student = await repo.findStudent(tx, studentId);
    if (!student) rejected(404, "student-not-found", "Сурагч олдсонгүй", "Заасан сурагч бүртгэлгүй байна.");

    if (input.type !== AssessmentType.PLACEMENT) {
      const contract = await repo.findContract(tx, input.contractId!);
      if (!contract || contract.studentId !== studentId) {
        rejected(409, "contract-mismatch", "Гэрээ таарахгүй байна", "Энэ гэрээ тус сурагчийнх биш байна.");
      }
      // ADR-008: багш зөвхөн өөрийн сурагчийн гэрээнд бүртгэнэ.
      await assertContractAccessInTx(tx, actor, contract.id);
    }

    // ФШ-38: сэдвийн оноогоор нийт хувь давхар шалгагдана.
    let total: Prisma.Decimal;
    const topics = input.topics ?? [];
    if (topics.length > 0) {
      const mean = topics
        .reduce((acc, t) => acc.plus(t.scorePercent), D(0))
        .div(topics.length)
        .toDecimalPlaces(2);
      if (input.totalPercent !== undefined && mean.minus(input.totalPercent).abs().gt("0.01")) {
        rejected(
          409,
          "total-mismatch",
          "Нийт хувь сэдвийн оноотой таарахгүй байна",
          `Сэдвийн оноогоор дундаж ${mean.toFixed(2)}% гарч байна.`,
          { expected: mean.toFixed(2) },
        );
      }
      total = mean;
    } else {
      total = D(input.totalPercent!);
    }

    const defaults = await getAssessmentDefaults(tx);
    let freeReviewsGranted = 0;
    let reviewTopics: string[] = [];

    if (input.type === AssessmentType.BATCH_EXAM) {
      if (await repo.findBatchExam(tx, input.contractId!)) {
        rejected(409, "batch-exam-exists", "Багцын шалгалт бүртгэгдсэн", "Энэ гэрээнд багцын шалгалт аль хэдийн бүртгэгдсэн байна.");
      }
      // ФШ-39: 92.9% дүнд эрх үүснэ, 93.0% дүнд үүсэхгүй.
      if (total.lt(defaults.freeReviewThresholdPercent)) {
        freeReviewsGranted = defaults.freeReviewCount;
        await repo.setFreeReviews(tx, input.contractId!, freeReviewsGranted);
        reviewTopics = topics.filter((t) => D(t.scorePercent).lt(100)).map((t) => t.topic);
      }
      await repo.markTasksDone(tx, input.contractId!, "EXAM");
    }

    const created = await repo.createAssessment(tx, {
      studentId,
      contractId: input.contractId,
      type: input.type,
      takenOn: new Date(input.takenOn),
      totalPercent: total.toFixed(2),
      topics: topics.map((t) => ({ topic: t.topic, scorePercent: D(t.scorePercent).toFixed(2) })),
    });

    await writeAudit(tx, {
      entity: "assessment",
      entityId: created.id,
      action: "CREATE",
      after: { type: input.type, totalPercent: total.toFixed(2), freeReviewsGranted },
      actorId: actor.id,
    });
    await notifyParentsInTx(tx, studentId, "assessment_recorded", {
      studentName: student.fullName,
      type: input.type,
      totalPercent: total.toFixed(2),
      freeReviewsGranted,
    });

    return {
      id: created.id,
      type: created.type,
      totalPercent: total.toFixed(2),
      freeReviewsGranted,
      reviewTopics,
    };
  });
}

// ФШ-41, 42: дүнгийн түүх (цаг хугацааны дарааллаар) ба сул сэдвүүд.
export function getProgress(actor: Actor, studentId: string): Promise<ProgressDto> {
  return prisma.$transaction(async (tx) => {
    await assertStudentReadAccessInTx(tx, actor, studentId);
    const rows = await repo.listAssessments(tx, studentId);
    const { weakTopicThresholdPercent } = await getAssessmentDefaults(tx);

    // ФШ-42: сүүлийн 3 сорил (сэдэвтэй) дотор сэдэв бүрийн хамгийн сүүлийн оноо босгоос доош бол сул.
    const withTopics = rows.filter((r) => r.topics.length > 0).slice(-3);
    const latest = new Map<string, { score: Prisma.Decimal; takenOn: string }>();
    for (const a of withTopics) {
      for (const t of a.topics) {
        latest.set(t.topic, { score: t.scorePercent, takenOn: a.takenOn.toISOString().slice(0, 10) });
      }
    }
    const weakTopics = [...latest.entries()]
      .filter(([, v]) => v.score.lt(weakTopicThresholdPercent))
      .map(([topic, v]) => ({ topic, scorePercent: v.score.toFixed(2), takenOn: v.takenOn }))
      .sort((a, b) => Number(a.scorePercent) - Number(b.scorePercent));

    return { assessments: rows.map(mapAssessment), weakTopics, weakTopicThresholdPercent };
  });
}

function mapNote(n: Awaited<ReturnType<typeof repo.createNote>>): NoteDto {
  return {
    id: n.id,
    lessonId: n.lessonId,
    lessonStartsAt: n.lesson.startsAt.toISOString(),
    visibility: n.visibility,
    body: n.body,
    authorName: n.author.fullName,
    createdAt: n.createdAt.toISOString(),
  };
}

// ФШ-44: багш өөрийн хичээлд тэмдэглэл бичнэ.
export function addNote(actor: Actor, lessonId: string, input: CreateNoteInput) {
  return prisma.$transaction(async (tx) => {
    const lesson = await repo.findLesson(tx, lessonId);
    if (!lesson) rejected(404, "lesson-not-found", "Хичээл олдсонгүй", "Заасан хичээл бүртгэлгүй байна.");
    if (lesson.teacherId !== actor.id) {
      rejected(403, "forbidden-lesson", "Эрх хүрэхгүй байна", "Энэ хичээл таных биш байна.");
    }
    if (!(await repo.isContractInLesson(tx, input.contractId, lesson))) {
      rejected(409, "contract-not-in-lesson", "Сурагч энэ хичээлд байхгүй", "Тэмдэглэл бичих сурагч уг хичээлд хамрагдаагүй байна.");
    }
    const note = await repo.createNote(tx, {
      lessonId,
      contractId: input.contractId,
      authorId: actor.id,
      visibility: input.visibility,
      body: input.body,
    });
    return mapNote(note);
  });
}

// Хүснэгт 2.2: админ бүгдийг, багш өөрийн сурагчийнхыг, эцэг эх зөвхөн хуваалцсаныг, сурагч үгүй.
export function listNotes(actor: Actor, contractId: string): Promise<NoteDto[]> {
  return prisma.$transaction(async (tx) => {
    if (actor.role === Role.STUDENT) {
      rejected(403, "forbidden-notes", "Эрх хүрэхгүй байна", "Хичээлийн тэмдэглэлийг сурагч харахгүй.");
    }
    if (actor.role === Role.PARENT) {
      await getContractForUserInTx(tx, actor, contractId);
      return (await repo.listNotes(tx, contractId, NoteVisibility.SHARED)).map(mapNote);
    }
    await assertContractAccessInTx(tx, actor, contractId);
    return (await repo.listNotes(tx, contractId)).map(mapNote);
  });
}

export function updateNote(actor: Actor, noteId: string, input: UpdateNoteInput) {
  return prisma.$transaction(async (tx) => {
    const note = await repo.findNote(tx, noteId);
    if (!note) rejected(404, "note-not-found", "Тэмдэглэл олдсонгүй", "Заасан тэмдэглэл бүртгэлгүй байна.");
    if (note.authorId !== actor.id) {
      rejected(403, "forbidden-note", "Эрх хүрэхгүй байна", "Зөвхөн тэмдэглэл бичсэн багш засна.");
    }
    return mapNote(await repo.updateNote(tx, noteId, { body: input.body, visibility: input.visibility }));
  });
}

// ФШ-45, 43: эцэг эхтэй уулзсанаа бүртгэхэд сануулга биелсэнд тооцогдоно.
export function addMeeting(actor: Actor, contractId: string, input: CreateMeetingInput) {
  return prisma.$transaction(async (tx: Tx) => {
    await assertContractAccessInTx(tx, actor, contractId);
    const meeting = await repo.createMeeting(tx, {
      contractId,
      teacherId: actor.id,
      metOn: new Date(input.metOn),
      summary: input.summary,
    });
    await repo.markTasksDone(tx, contractId, "MEETING");
    await writeAudit(tx, {
      entity: "meeting",
      entityId: meeting.id,
      action: "CREATE",
      after: { metOn: input.metOn },
      actorId: actor.id,
    });
    return {
      id: meeting.id,
      metOn: input.metOn,
      summary: meeting.summary,
      teacherName: meeting.teacher.fullName,
    };
  });
}

export function listMeetings(actor: Actor, contractId: string) {
  return prisma.$transaction(async (tx) => {
    await assertContractAccessInTx(tx, actor, contractId);
    const rows = await repo.listMeetings(tx, contractId);
    return rows.map((m) => ({
      id: m.id,
      metOn: m.metOn.toISOString().slice(0, 10),
      summary: m.summary,
      teacherName: m.teacher.fullName,
    }));
  });
}

// ФШ-70: багшийн самбарт уулзалтын сануулга, багцын шалгалтын даалгаврыг харуулна. Зөвхөн
// өөрийн даалгавар (teacherId = actor.id).
export async function listOpenTasks(actor: Actor): Promise<TeacherTaskDto[]> {
  const rows = await repo.findOpenTasksForTeacher(prisma, actor.id);
  return rows.map((t) => ({
    id: t.id,
    type: t.type,
    dueOn: t.dueOn.toISOString().slice(0, 10),
    contractId: t.contractId,
    studentId: t.contract.studentId,
    studentName: t.contract.student.fullName,
    programName: t.contract.program.name,
  }));
}
