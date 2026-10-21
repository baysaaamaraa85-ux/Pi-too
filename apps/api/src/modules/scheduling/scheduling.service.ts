import { prisma, type Tx } from "../../shared/db/prisma.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as catalog from "../catalog/catalog.service.js";
import * as repo from "./scheduling.repository.js";

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

    return repo.createClass(tx, {
      teacherId,
      branchId,
      weekday,
      startTime,
      durationMin,
      capacity: classDefaults.maxCapacity,
    });
  });
}

export function listClasses(filters: { branchId?: string; teacherId?: string }) {
  return repo.listClasses(prisma, { ...filters, isActive: true });
}

// ФШ-15: сул суудалтай анги хайлт.
export async function listAvailableClasses(filters: { branchId?: string }) {
  const classes = await repo.listClasses(prisma, { ...filters, isActive: true });
  const withAvailability = await Promise.all(
    classes.map(async (cls) => {
      const activeCount = await repo.countActiveEnrollments(prisma, cls.id);
      return { ...cls, availableSeats: cls.capacity - activeCount };
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
