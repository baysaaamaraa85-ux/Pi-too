import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as repo from "./catalog.repository.js";

const authDefaultsSchema = z.object({
  maxFailedLogins: z.number().int().positive(),
  lockoutMinutes: z.number().int().positive(),
});

const contractDefaultsSchema = z.object({
  totalAcademicHours: z.number().int().positive(),
  academicHoursPerVisit: z.number().int().positive(),
  academicHourMinutes: z.number().int().positive(),
  defaultLeaves: z.number().int().nonnegative(),
});

const classDefaultsSchema = z.object({
  maxCapacity: z.number().int().positive(),
});

function settingNotConfigured(key: string): never {
  throw new DomainError({
    code: "settings-not-configured",
    status: 500,
    title: "Тохиргоо дутуу байна",
    detail: `"${key}" тохиргоо олдсонгүй. Seed ажиллуулсан эсэхийг шалгаарай.`,
  });
}

// ФБШ-22, ФБШ-29: буруу нэвтрэлтийн хязгаар кодонд биш, settings-ээс.
export async function getAuthDefaults(tx: Tx) {
  const row = await repo.findSetting(tx, "auth_defaults");
  if (!row) settingNotConfigured("auth_defaults");
  return authDefaultsSchema.parse(row.value);
}

// ФШ-09, 17: багцын хэмжээ (75 цаг, 1 ирэлт 3 цаг, 3 чөлөө) settings-ээс.
export async function getContractDefaults(tx: Tx) {
  const row = await repo.findSetting(tx, "contract_defaults");
  if (!row) settingNotConfigured("contract_defaults");
  return contractDefaultsSchema.parse(row.value);
}

// ФШ-20: ангийн дээд суудлын тоо (анхдагч 6) settings-ээс.
export async function getClassDefaults(tx: Tx) {
  const row = await repo.findSetting(tx, "class_defaults");
  if (!row) settingNotConfigured("class_defaults");
  return classDefaultsSchema.parse(row.value);
}

function programNotFound(): never {
  throw new DomainError({
    code: "program-not-found",
    status: 404,
    title: "Хөтөлбөр олдсонгүй",
    detail: "Заасан хөтөлбөр бүртгэлгүй байна.",
  });
}

// enrollment модуль гэрээ үүсгэх үедээ өөрийнхөө транзакц дотроос дуудна.
export async function getProgramById(tx: Tx, id: string) {
  const program = await repo.findProgramById(tx, id);
  if (!program) programNotFound();
  return program;
}

function alreadyExists(name: string): never {
  throw new DomainError({
    code: "already-exists",
    status: 409,
    title: "Нэр давхардсан байна",
    detail: `"${name}" нэртэй мөр аль хэдийн байна.`,
  });
}

async function withUniqueNameHandling<T>(name: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      alreadyExists(name);
    }
    throw error;
  }
}

// ФШ-07
export function listBranches() {
  return repo.listBranches(prisma);
}

export function createBranch(name: string, address: string) {
  return withUniqueNameHandling(name, () => repo.createBranch(prisma, { name, address }));
}

export function updateBranch(id: string, data: { name?: string; address?: string }) {
  return withUniqueNameHandling(data.name ?? id, () => repo.updateBranch(prisma, id, data));
}

// ФШ-08, ADR-013: үнэ өөрчлөгдөхөд өмнөх гэрээний contracts.price хэвээр
// үлдэнэ (гэрээ үүсэх мөчдөө хуулсан), иймд Program-ийн үнийг шууд солино.
export function listPrograms() {
  return repo.listPrograms(prisma);
}

export function createProgram(name: string, currentPrice: string) {
  return withUniqueNameHandling(name, () =>
    repo.createProgram(prisma, { name, currentPrice }),
  );
}

export function updateProgram(id: string, data: { name?: string; currentPrice?: string }) {
  return withUniqueNameHandling(data.name ?? id, () => repo.updateProgram(prisma, id, data));
}

// ФШ-09, ФБШ-29
export function listSettings() {
  return repo.listSettings(prisma);
}

// ФШ-09, ФБШ-29: аудиттай (TASKS үе шат 8).
export async function updateSetting(
  key: string,
  value: Record<string, unknown>,
  actorId: string,
) {
  return prisma.$transaction(async (tx) => {
    const before = await repo.findSetting(tx, key);
    const after = await repo.upsertSetting(tx, {
      key,
      value: value as Prisma.InputJsonValue,
      updatedBy: actorId,
    });
    await writeAudit(tx, {
      entity: "settings",
      entityId: key,
      action: "UPDATE",
      before: before?.value ?? null,
      after: after.value,
      actorId,
    });
    return after;
  });
}

function teacherNotFound(): never {
  throw new DomainError({
    code: "teacher-not-found",
    status: 404,
    title: "Багш олдсонгүй",
    detail: "Заасан багш бүртгэлгүй байна.",
  });
}

// ФШ-10: хүчинтэй огноотой үнэлгээ. Хичээлийн цалинд тухайн өдрийн
// хамгийн ойрын (effectiveFrom <= lesson date) үнэлгээ хэрэглэгдэнэ.
export async function createTeacherRate(
  teacherId: string,
  hourlyRate: string,
  effectiveFrom: string,
) {
  return prisma.$transaction(async (tx) => {
    const teacher = await repo.findTeacherByUserId(tx, teacherId);
    if (!teacher) teacherNotFound();
    return repo.createTeacherRate(tx, {
      teacherId,
      hourlyRate,
      effectiveFrom: new Date(effectiveFrom),
    });
  });
}
