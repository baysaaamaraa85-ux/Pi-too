import { z } from "zod";
import { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { removeUploadedImage, saveImage } from "../../shared/uploads/image-upload.js";
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

const assessmentDefaultsSchema = z.object({
  freeReviewThresholdPercent: z.number().min(0).max(100),
  freeReviewCount: z.number().int().nonnegative(),
  weakTopicThresholdPercent: z.number().min(0).max(100),
});

const attendanceDefaultsSchema = z.object({
  editWindowHours: z.number().int().positive(),
});

const weeklyLessonsSchema = z.object({
  min: z.number().int().positive(),
  max: z.number().int().positive(),
});

const paymentAccountSchema = z.object({
  bankName: z.string(),
  accountHolder: z.string(),
  accountNumber: z.string(),
  iban: z.string().optional(),
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

// ФШ-39, 42: давтлагын босго (93%), давтлагын тоо (3), сул сэдвийн босго (60%) settings-ээс.
export async function getAssessmentDefaults(tx: Tx) {
  const row = await repo.findSetting(tx, "assessment_defaults");
  if (!row) settingNotConfigured("assessment_defaults");
  return assessmentDefaultsSchema.parse(row.value);
}

// ФШ-33: ирц бүртгэх, засах хугацаа (24 цаг) settings-ээс.
export async function getAttendanceDefaults(tx: Tx) {
  const row = await repo.findSetting(tx, "attendance_defaults");
  if (!row) settingNotConfigured("attendance_defaults");
  return attendanceDefaultsSchema.parse(row.value);
}

// ФШ-22: сурагчийн долоо хоногийн хичээлийн зөвшөөрөгдсөн хүрээ (анхдагч 2-4) settings-ээс.
export async function getWeeklyLessons(tx: Tx) {
  const row = await repo.findSetting(tx, "weekly_lessons");
  if (!row) settingNotConfigured("weekly_lessons");
  return weeklyLessonsSchema.parse(row.value);
}

// ФШ-49, ADR-016: эцэг эхэд харуулах төвийн дансны мэдээлэл settings-ээс.
export async function getPaymentAccount(tx: Tx) {
  const row = await repo.findSetting(tx, "payment_account");
  if (!row) settingNotConfigured("payment_account");
  return paymentAccountSchema.parse(row.value);
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

export function createBranch(data: repo.BranchData & { name: string; address: string }) {
  return withUniqueNameHandling(data.name, () => repo.createBranch(prisma, data));
}

export function updateBranch(id: string, data: repo.BranchData) {
  return withUniqueNameHandling(data.name ?? id, () => repo.updateBranch(prisma, id, data));
}

// ФШ-78: салбарын зураг (зөвхөн админ). Хуучин зургийн файлыг шинэ нь хадгалагдсаны дараа устгана.
export async function setBranchPhoto(id: string, image: Buffer | null, actorId: string) {
  const photoUrl = await saveImage("branches", image);
  try {
    const before = await prisma.$transaction(async (tx) => {
      const branch = await getBranchById(tx, id);
      await repo.updateBranch(tx, id, { photoUrl });
      await writeAudit(tx, {
        entity: "branch",
        entityId: id,
        action: "UPDATE",
        before: { photoUrl: branch.photoUrl },
        after: { photoUrl },
        actorId,
      });
      return branch.photoUrl;
    });
    await removeUploadedImage(before);
  } catch (err) {
    await removeUploadedImage(photoUrl);
    throw err;
  }
  return { photoUrl };
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

// D-67: protocolHourlyRate (захирлын цалингийн протокол) өөрчлөлт аудитад бичигдэнэ.
export function updateProgram(
  id: string,
  data: { name?: string; currentPrice?: string; protocolHourlyRate?: string | null },
  actorId: string,
) {
  return withUniqueNameHandling(data.name ?? id, () =>
    prisma.$transaction(async (tx) => {
      const before = await repo.findProgramById(tx, id);
      if (!before) programNotFound();
      const after = await repo.updateProgram(tx, id, data);
      if (data.protocolHourlyRate !== undefined) {
        await writeAudit(tx, {
          entity: "program",
          entityId: id,
          action: "UPDATE_PROTOCOL_RATE",
          before: { protocolHourlyRate: before.protocolHourlyRate?.toFixed(2) ?? null },
          after: { protocolHourlyRate: after.protocolHourlyRate?.toFixed(2) ?? null },
          actorId,
        });
      }
      return after;
    }),
  );
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

// enrollment модуль (нийтийн хүсэлт) салбар байгаа эсэхийг шалгахдаа дуудна.
export async function getBranchById(tx: Tx, id: string) {
  const branch = await repo.findBranchById(tx, id);
  if (!branch) {
    throw new DomainError({
      code: "branch-not-found",
      status: 404,
      title: "Салбар олдсонгүй",
      detail: "Заасан салбар бүртгэлгүй байна.",
    });
  }
  return branch;
}

// ФШ-78: нийтийн сайтын нүүр хуудасны тоон мэдээлэл (салбарын тоо, журмын гол утгууд).
export function getPublicOverview() {
  return prisma.$transaction(async (tx) => {
    const [contract, klass, assessment, branchCount] = await Promise.all([
      getContractDefaults(tx),
      getClassDefaults(tx),
      getAssessmentDefaults(tx),
      tx.branch.count(),
    ]);
    return {
      branchCount,
      classCapacity: klass.maxCapacity,
      packageHours: contract.totalAcademicHours,
      leaves: contract.defaultLeaves,
      reviewThresholdPercent: assessment.freeReviewThresholdPercent,
    };
  });
}
