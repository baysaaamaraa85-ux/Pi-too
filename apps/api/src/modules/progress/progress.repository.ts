import type { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../../shared/db/prisma.js";
import type { AssessmentType, NoteVisibility } from "../../generated/prisma/client.js";

// Зөвхөн Prisma асуулга (CLAUDE.md 6.1).

export function findStudent(tx: Tx, id: string) {
  return tx.student.findUnique({ where: { id } });
}

export function findContract(tx: Tx, id: string) {
  return tx.contract.findUnique({ where: { id }, include: { student: true, program: true } });
}

export function findBatchExam(tx: Tx, contractId: string) {
  return tx.assessment.findFirst({ where: { contractId, type: "BATCH_EXAM" } });
}

export function createAssessment(
  tx: Tx,
  data: {
    studentId: string;
    contractId?: string;
    type: AssessmentType;
    takenOn: Date;
    totalPercent: string;
    topics: { topic: string; scorePercent: string }[];
  },
) {
  const { topics, ...rest } = data;
  return tx.assessment.create({
    data: { ...rest, topics: { create: topics } },
    include: { topics: true },
  });
}

export function setFreeReviews(tx: Tx, contractId: string, count: number) {
  return tx.contract.update({ where: { id: contractId }, data: { freeReviewsLeft: count } });
}

export function markTasksDone(tx: Tx, contractId: string, type: "EXAM" | "MEETING") {
  return tx.teacherTask.updateMany({
    where: { contractId, type, doneAt: null },
    data: { doneAt: new Date() },
  });
}

export function listAssessments(tx: Tx, studentId: string) {
  return tx.assessment.findMany({
    where: { studentId },
    include: { topics: true, contract: { include: { program: true } } },
    orderBy: [{ takenOn: "asc" }, { createdAt: "asc" }],
  });
}

export function findLesson(tx: Tx, id: string) {
  return tx.lesson.findUnique({ where: { id } });
}

// Сурагч хичээлд хамаарах эсэх: ангид идэвхтэй бүртгэлтэй эсвэл тэр хичээлд ирцтэй.
export async function isContractInLesson(tx: Tx, contractId: string, lesson: { id: string; classId: string }) {
  const [enrolled, attended] = await Promise.all([
    tx.enrollment.count({ where: { contractId, classId: lesson.classId } }),
    tx.attendance.count({ where: { contractId, lessonId: lesson.id } }),
  ]);
  return enrolled > 0 || attended > 0;
}

export function createNote(
  tx: Tx,
  data: { lessonId: string; contractId: string; authorId: string; visibility: NoteVisibility; body: string },
) {
  return tx.lessonNote.create({ data, include: { lesson: true, author: true } });
}

export function listNotes(tx: Tx, contractId: string, visibility?: NoteVisibility) {
  return tx.lessonNote.findMany({
    where: { contractId, ...(visibility ? { visibility } : {}) },
    include: { lesson: true, author: true },
    orderBy: { createdAt: "desc" },
  });
}

export function findNote(tx: Tx, id: string) {
  return tx.lessonNote.findUnique({ where: { id } });
}

export function updateNote(tx: Tx, id: string, data: Prisma.LessonNoteUpdateInput) {
  return tx.lessonNote.update({ where: { id }, data, include: { lesson: true, author: true } });
}

export function createMeeting(
  tx: Tx,
  data: { contractId: string; teacherId: string; metOn: Date; summary: string },
) {
  return tx.parentMeeting.create({ data, include: { teacher: true } });
}

export function listMeetings(tx: Tx, contractId: string) {
  return tx.parentMeeting.findMany({
    where: { contractId },
    include: { teacher: true },
    orderBy: { metOn: "desc" },
  });
}
