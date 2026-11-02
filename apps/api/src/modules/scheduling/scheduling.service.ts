import { prisma, type Tx } from "../../shared/db/prisma.js";
import { Prisma, Role } from "../../generated/prisma/client.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { notifyUser } from "../../shared/outbox/notify-user.js";
import * as catalog from "../catalog/catalog.service.js";
import * as repo from "./scheduling.repository.js";

// Монгол улсын цагийн бүс (DST байхгүй, тогтмол UTC+8).
const ULAANBAATAR_UTC_OFFSET_HOURS = 8;

// ФШ-23: хичээлийг хэдэн долоо хоногийн өмнөөс үүсгэх вэ (worker болон анги
// үүсгэх үед хоёуланд нь ижил).
export const LESSON_HORIZON_WEEKS = 4;

// Улаанбаатарын өнөөдрийн огноог UTC 00:00 болгон буцаана (generateLessons-ийн
// fromDate хэлбэр). UTC огноо 00:00-08:00 цагт өчигдөр байдаг тул тусад нь тооцно.
export function todayInUlaanbaatar(): Date {
  const local = new Date(Date.now() + ULAANBAATAR_UTC_OFFSET_HOURS * 3_600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

function toOurWeekday(date: Date): number {
  const jsDay = date.getUTCDay();
  return jsDay === 0 ? 7 : jsDay;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function combineDateAndLocalTime(dateOnly: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return new Date(
    Date.UTC(
      dateOnly.getUTCFullYear(),
      dateOnly.getUTCMonth(),
      dateOnly.getUTCDate(),
      (hours ?? 0) - ULAANBAATAR_UTC_OFFSET_HOURS,
      minutes ?? 0,
    ),
  );
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

// ФШ-25: ангиудын цаг нь долоо хоногийн тогтмол дүрэм (weekday + startTime),
// бодит огноо биш тул DB-ийн EXCLUDE constraint (зөвхөн lessons-д байгаа)
// хамрахгүй. Иймд давхцлыг энд, application түвшинд шалгана.
async function assertNoClassOverlap(
  tx: Tx,
  teacherId: string,
  weekday: number,
  startTime: string,
  durationMin: number,
  excludeClassId?: string,
) {
  const existing = await repo.listClasses(tx, { teacherId, isActive: true });
  const newStart = timeToMinutes(startTime);
  const newEnd = newStart + durationMin;

  for (const cls of existing) {
    if (cls.id === excludeClassId || cls.weekday !== weekday) continue;
    const existingStart = timeToMinutes(cls.startTime);
    const existingEnd = existingStart + cls.durationMin;
    if (rangesOverlap(newStart, newEnd, existingStart, existingEnd)) {
      throw new DomainError({
        code: "class-time-conflict",
        status: 409,
        title: "Багшийн цаг давхцаж байна",
        detail: "Энэ багш тухайн өдөр, цагт өөр ангитай байна.",
        extra: { conflictingClassId: cls.id },
      });
    }
  }
}

// ФШ-19: анги үүсгэнэ, 6 (settings) суудал анхдагч.
export async function createClass(
  teacherId: string,
  branchId: string,
  weekday: number,
  startTime: string,
) {
  return prisma.$transaction(async (tx) => {
    const { academicHoursPerVisit, academicHourMinutes } = await catalog.getContractDefaults(tx);
    const durationMin = academicHoursPerVisit * academicHourMinutes;
    const classDefaults = await catalog.getClassDefaults(tx);

    await assertNoClassOverlap(tx, teacherId, weekday, startTime, durationMin);

    const created = await repo.createClass(tx, {
      teacherId,
      branchId,
      weekday,
      startTime,
      durationMin,
      capacity: classDefaults.maxCapacity,
    });

    // ФШ-23: анги үүссэн даруйд календарьт хичээл нь харагдана (өнөөдөр тухайн
    // гараг бол өнөөдрийн хичээл ч орно). Worker дараа нь өдөр бүр үргэлжлүүлнэ.
    await createLessonsForClassesInTx(tx, [created], todayInUlaanbaatar(), LESSON_HORIZON_WEEKS);

    return created;
  });
}

// Анги устгах: бодитоор устгахгүй, идэвхгүй болгоно (өнгөрсөн хичээл, ирц, цалингийн
// түүх хадгалагдана). Ангид идэвхтэй сурагч байвал устгахгүй, эс тэгвээс сурагч
// хуваарьгүй үлдэнэ. Ирээдүйн хичээлүүд календариас арилна.
export async function deleteClass(user: { id: string; role: Role }, classId: string) {
  return prisma.$transaction(async (tx) => {
    const cls = await repo.findClassById(tx, classId);
    if (!cls || !cls.isActive) {
      throw new DomainError({
        code: "class-not-found",
        status: 404,
        title: "Анги олдсонгүй",
        detail: "Заасан анги бүртгэлгүй эсвэл устгагдсан байна.",
      });
    }
    // Эзэмшлийн шалгалт: багш зөвхөн өөрийн ангийг устгана (BOLA).
    if (user.role !== Role.ADMIN && cls.teacherId !== user.id) {
      throw new DomainError({
        code: "forbidden-class",
        status: 403,
        title: "Эрх хүрэхгүй байна",
        detail: "Энэ анги танай анги биш байна.",
      });
    }

    const activeStudents = await repo.countActiveEnrollments(tx, classId);
    if (activeStudents > 0) {
      throw new DomainError({
        code: "class-has-students",
        status: 409,
        title: "Ангид сурагч бүртгэлтэй байна",
        detail: `Ангид ${activeStudents} сурагч бүртгэлтэй тул устгах боломжгүй. Эхлээд сурагчдыг өөр ангид шилжүүлнэ үү.`,
        extra: { activeStudents },
      });
    }

    const now = new Date();
    const removed = await repo.deleteFutureLessonsWithoutHistory(tx, classId, now);
    const cancelled = await repo.cancelRemainingFutureLessons(tx, classId, now);
    await repo.deactivateClass(tx, classId);

    await writeAudit(tx, {
      entity: "class",
      entityId: classId,
      action: "DELETE",
      before: { isActive: true },
      after: {
        isActive: false,
        removedLessons: removed.count,
        cancelledLessons: cancelled.count,
      },
      actorId: user.id,
    });
  });
}

export function listClasses(filters: { branchId?: string; teacherId?: string }) {
  return repo.listClasses(prisma, { ...filters, isActive: true });
}

// ФШ-15: бүх салбарын сул суудалтай анги хайлт (салбар, гараг, багшаар шүүнэ).
// Анги нь хөтөлбөртэй холбогдоогүй (ФШ-21), тиймээс хөтөлбөрөөр шүүхгүй.
export async function listAvailableClasses(filters: {
  branchId?: string;
  weekday?: number;
  teacherId?: string;
}) {
  const classes = await repo.listClasses(prisma, { ...filters, isActive: true });
  const withAvailability = await Promise.all(
    classes.map(async (cls) => {
      const activeCount = await repo.countActiveEnrollments(prisma, cls.id);
      return {
        id: cls.id,
        teacherId: cls.teacherId,
        branchId: cls.branchId,
        weekday: cls.weekday,
        startTime: cls.startTime,
        durationMin: cls.durationMin,
        capacity: cls.capacity,
        isActive: cls.isActive,
        branchName: cls.branch.name,
        teacherName: cls.teacher.fullName,
        availableSeats: cls.capacity - activeCount,
      };
    }),
  );
  return withAvailability.filter((cls) => cls.availableSeats > 0);
}

function classFull(): never {
  throw new DomainError({
    code: "class-full",
    status: 409,
    title: "Анги дүүрсэн байна",
    detail: "Энэ ангид зөвшөөрөгдөх дээд хэмжээний сурагч бүртгэлтэй.",
  });
}

function classNotFound(): never {
  throw new DomainError({
    code: "class-not-found",
    status: 404,
    title: "Анги олдсонгүй",
    detail: "Заасан анги бүртгэлгүй байна.",
  });
}

// enrollment модуль (гэрээ үргэлжлүүлэх) ангийн эзэмшлийг шалгахдаа дуудна.
export async function getClassInTx(tx: Tx, classId: string) {
  const cls = await repo.findClassById(tx, classId);
  if (!cls) classNotFound();
  return cls;
}

// ФШ-20, 21, 74: 6 (анги.capacity) суудлын хязгаар. enrollment модуль (гэрээг
// түр зогсоохоос үргэлжлүүлэх) ч энэ функцийг өөрийн транзакц дотроос дуудна.
export async function enrollContractInClassInTx(
  tx: Tx,
  contractId: string,
  classId: string,
  fromDate: Date,
) {
  const cls = await repo.findClassById(tx, classId);
  if (!cls) classNotFound();

  const activeCount = await repo.countActiveEnrollments(tx, classId);
  if (activeCount >= cls.capacity) classFull();

  return repo.createEnrollment(tx, { contractId, classId, fromDate });
}

export function enrollContractInClass(contractId: string, classId: string, fromDate: Date) {
  return prisma.$transaction((tx) => enrollContractInClassInTx(tx, contractId, classId, fromDate));
}

// ФШ-74: суудал хадгалахгүй түр зогсолтод идэвхтэй бүртгэлүүдийг хаана.
// enrollment модуль (pauseContract) өөрийн транзакц дотроос дуудна.
export function closeActiveEnrollmentsForContractInTx(tx: Tx, contractId: string, toDate: Date) {
  return repo.closeActiveEnrollmentsForContract(tx, contractId, toDate);
}

// Эзэмшлийн шалгалт: enrollment модуль (pause/resume) гэрээний идэвхтэй
// бүртгэлүүдийн ангийг (ба багшийг) харж, өөрийн эсэхийг шалгана.
export function getActiveEnrollmentsWithClassInTx(tx: Tx, contractId: string) {
  return repo.findActiveEnrollmentsWithClass(tx, contractId);
}

// ADR-011: ангийн тогтмол дүрмээс ирэх N долоо хоногийн бодит хичээл
// үүсгэнэ. Worker өдөр бүр дуудна, UNIQUE(classId, originalStartsAt) тул
// давтан ажиллуулахад давхардахгүй (skipDuplicates).
export async function generateLessons(fromDate: Date, weeks: number) {
  return prisma.$transaction(async (tx) => {
    const classes = await repo.listActiveClasses(tx);
    return createLessonsForClassesInTx(tx, classes, fromDate, weeks);
  });
}

async function createLessonsForClassesInTx(
  tx: Tx,
  classes: {
    id: string;
    teacherId: string;
    weekday: number;
    startTime: string;
    durationMin: number;
  }[],
  fromDate: Date,
  weeks: number,
) {
  const rows: {
    classId: string;
    teacherId: string;
    startsAt: Date;
    endsAt: Date;
    originalStartsAt: Date;
  }[] = [];

  for (const cls of classes) {
    let cursor = fromDate;
    while (toOurWeekday(cursor) !== cls.weekday) {
      cursor = addDays(cursor, 1);
    }
    for (let week = 0; week < weeks; week++) {
      const occurrenceDate = addDays(cursor, week * 7);
      const startsAt = combineDateAndLocalTime(occurrenceDate, cls.startTime);
      const endsAt = new Date(startsAt.getTime() + cls.durationMin * 60_000);
      rows.push({
        classId: cls.id,
        teacherId: cls.teacherId,
        startsAt,
        endsAt,
        originalStartsAt: startsAt,
      });
    }
  }

  if (rows.length === 0) return { count: 0 };
  return repo.createLessonsSkipDuplicates(tx, rows);
}

// ФШ-23: эрхээр шүүсэн календарь. Эцэг эх, сурагчийн шүүлтийн уншилт
// (contract -> enrollment -> class) бизнесийн дүрэм агуулахгүй, зөвхөн
// мэдээлэл цуглуулалт тул repository-д шууд бичигдсэн (дээрх тайлбар).
export async function listLessonsForUser(user: { id: string; role: Role }, from: Date, to: Date) {
  return prisma.$transaction(async (tx) => {
    if (user.role === Role.ADMIN) {
      return repo.listLessonsInRange(tx, { from, to });
    }
    if (user.role === Role.TEACHER) {
      return repo.listLessonsInRange(tx, { from, to, teacherId: user.id });
    }

    const contractIds =
      user.role === Role.PARENT
        ? await repo.findContractIdsForParentUser(tx, user.id)
        : await repo.findContractIdsForStudentUser(tx, user.id);
    if (contractIds.length === 0) return [];

    const classIds = await repo.findClassIdsForContracts(tx, contractIds);
    if (classIds.length === 0) return [];

    return repo.listLessonsInRange(tx, { from, to, classIds });
  });
}

function lessonNotFound(): never {
  throw new DomainError({
    code: "lesson-not-found",
    status: 404,
    title: "Хичээл олдсонгүй",
    detail: "Заасан хичээл бүртгэлгүй байна.",
  });
}

function assertLessonOwnership(lesson: { teacherId: string }, user: { id: string; role: Role }) {
  if (user.role === Role.ADMIN) return;
  if (lesson.teacherId !== user.id) {
    throw new DomainError({
      code: "forbidden-lesson",
      status: 403,
      title: "Эрх хүрэхгүй байна",
      detail: "Энэ хичээл танай ангийн хичээл биш байна.",
    });
  }
}

// ФШ-24, 60: хичээл цуцлагдахад мэдэгдэл outbox-д бичигдэнэ (ADR-006).
export async function cancelLesson(lessonId: string, user: { id: string; role: Role }) {
  return prisma.$transaction(async (tx) => {
    const lesson = await repo.findLessonById(tx, lessonId);
    if (!lesson) lessonNotFound();
    assertLessonOwnership(lesson, user);

    if (lesson.status === "CANCELLED") {
      throw new DomainError({
        code: "lesson-already-cancelled",
        status: 409,
        title: "Хичээл аль хэдийн цуцлагдсан",
        detail: "Энэ хичээл өмнө нь цуцлагдсан байна.",
      });
    }

    const updated = await repo.updateLessonStatus(tx, lessonId, { status: "CANCELLED" });

    const recipients = await repo.findNotificationRecipientsForClass(tx, lesson.classId);
    for (const recipientId of recipients) {
      await notifyUser(tx, recipientId, "lesson_cancelled", {
        lessonId,
        startsAt: lesson.startsAt.toISOString(),
      });
    }

    await writeAudit(tx, {
      entity: "lesson",
      entityId: lessonId,
      action: "CANCEL",
      before: { status: lesson.status },
      after: { status: "CANCELLED" },
      actorId: user.id,
    });

    return updated;
  });
}

// ФШ-24, 25, 60: цаг шилжүүлнэ. EXCLUDE constraint давхцал илрүүлбэл 409.
export async function rescheduleLesson(
  lessonId: string,
  user: { id: string; role: Role },
  newStartsAt: Date,
  newEndsAt: Date,
) {
  return prisma.$transaction(async (tx) => {
    const lesson = await repo.findLessonById(tx, lessonId);
    if (!lesson) lessonNotFound();
    assertLessonOwnership(lesson, user);

    if (lesson.status === "CANCELLED") {
      throw new DomainError({
        code: "lesson-cancelled",
        status: 409,
        title: "Цуцлагдсан хичээл",
        detail: "Цуцлагдсан хичээлийг шилжүүлэх боломжгүй.",
      });
    }

    let updated;
    try {
      updated = await repo.updateLessonStatus(tx, lessonId, {
        status: "RESCHEDULED",
        startsAt: newStartsAt,
        endsAt: newEndsAt,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.message.includes("lessons_no_teacher_overlap")
      ) {
        throw new DomainError({
          code: "lesson-time-conflict",
          status: 409,
          title: "Багшийн цаг давхцаж байна",
          detail: "Шилжүүлэх цагт багш өөр хичээлтэй байна.",
        });
      }
      throw error;
    }

    const recipients = await repo.findNotificationRecipientsForClass(tx, lesson.classId);
    for (const recipientId of recipients) {
      await notifyUser(tx, recipientId, "lesson_rescheduled", {
        lessonId,
        startsAt: newStartsAt.toISOString(),
      });
    }

    await writeAudit(tx, {
      entity: "lesson",
      entityId: lessonId,
      action: "RESCHEDULE",
      before: { startsAt: lesson.startsAt.toISOString() },
      after: { startsAt: newStartsAt.toISOString() },
      actorId: user.id,
    });

    return updated;
  });
}

// ФШ-71: transfer модуль гэрээний нэг бүртгэлийг хаахдаа өөрийн транзакц дотроос дуудна.
export function closeEnrollmentInTx(tx: Tx, enrollmentId: string, toDate: Date) {
  return repo.closeEnrollment(tx, enrollmentId, toDate);
}
