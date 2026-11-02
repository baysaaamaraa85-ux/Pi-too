import { prisma, type Tx } from "../../shared/db/prisma.js";
import {
  AssessmentType,
  ContractStatus,
  Prisma,
  Role,
  type PlacementRequestStatus,
} from "../../generated/prisma/client.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { enqueue } from "../../shared/outbox/enqueue.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { createUserInTx } from "../auth/auth.service.js";
import {
  getBranchById,
  getContractDefaults,
  getProgramById,
  getWeeklyLessons,
} from "../catalog/catalog.service.js";
import {
  closeActiveEnrollmentsForContractInTx,
  enrollContractInClassInTx,
  getActiveEnrollmentsWithClassInTx,
  getClassInTx,
  todayInUlaanbaatar,
} from "../scheduling/scheduling.service.js";
import type { EnrollStudentInput } from "@pitoo/contracts";
import * as repo from "./enrollment.repository.js";

export function searchParentsByPhone(phone: string) {
  return repo.searchParentsByPhone(prisma, phone);
}

export interface RegisterStudentResult {
  studentId: string;
  parentId: string;
  tempPassword?: string;
  studentUserId?: string;
  studentTempPassword?: string;
}

// ФШ-12, 13: сурагч, эцэг эх, холбоосыг нэг транзакцаар үүсгэнэ. Ижил
// утастай эцэг эх байвал дахин ашиглана (шинэ User+Parent үүсгэхгүй).
export interface RegisterStudentInput {
  parentPhone: string;
  parentFullName?: string;
  studentFullName: string;
  studentPhone?: string;
  school?: string;
  grade?: string;
  consentAt?: Date;
}

export function registerStudent(input: RegisterStudentInput): Promise<RegisterStudentResult> {
  return prisma.$transaction((tx) => registerStudentInTx(tx, input));
}

export async function registerStudentInTx(
  tx: Tx,
  input: RegisterStudentInput,
): Promise<RegisterStudentResult> {
  {
    const existingParent = await repo.findParentByPhone(tx, input.parentPhone);

    let parentId: string;
    let tempPassword: string | undefined;

    if (existingParent) {
      parentId = existingParent.userId;
    } else {
      if (!input.parentFullName) {
        throw new DomainError({
          code: "parent-full-name-required",
          status: 422,
          title: "Эцэг эхийн нэр шаардлагатай",
          detail: "Шинэ эцэг эх бүртгэхдээ бүтэн нэрийг заавал бичнэ.",
        });
      }
      const created = await createUserInTx(tx, "PARENT", input.parentPhone, input.parentFullName);
      parentId = created.id;
      tempPassword = created.tempPassword;
    }

    // Сурагчийн утас өгөгдвөл сурагч өөрийн нэвтрэх данстай болно (STUDENT үүрэг).
    let studentUserId: string | undefined;
    let studentTempPassword: string | undefined;
    if (input.studentPhone) {
      const studentUser = await createUserInTx(
        tx,
        "STUDENT",
        input.studentPhone,
        input.studentFullName,
      );
      studentUserId = studentUser.id;
      studentTempPassword = studentUser.tempPassword;
    }

    const student = await repo.createStudent(tx, {
      fullName: input.studentFullName,
      userId: studentUserId,
      school: input.school,
      grade: input.grade,
      consentAt: input.consentAt,
    });
    await repo.linkParentStudent(tx, parentId, student.id);

    return { studentId: student.id, parentId, tempPassword, studentUserId, studentTempPassword };
  }
}

function studentNotFound(): never {
  throw new DomainError({
    code: "student-not-found",
    status: 404,
    title: "Сурагч олдсонгүй",
    detail: "Заасан сурагч бүртгэлгүй байна.",
  });
}

function contractNotFound(): never {
  throw new DomainError({
    code: "contract-not-found",
    status: 404,
    title: "Гэрээ олдсонгүй",
    detail: "Заасан гэрээ бүртгэлгүй байна.",
  });
}

// ФШ-16, 17: гэрээ үүсгэх үед тухайн үеийн үнийг хуулж, тоолуурыг
// settings-ээс тооцно (75 цаг / 3 цаг = 25 ирэлт, 3 чөлөө) (ADR-009, 013).
export function createContract(studentId: string, programId: string, rulesAckAt: string) {
  return prisma.$transaction((tx) => createContractInTx(tx, studentId, programId, rulesAckAt));
}

async function createContractInTx(
  tx: Tx,
  studentId: string,
  programId: string,
  rulesAckAt: string,
) {
  const student = await repo.findStudentById(tx, studentId);
  if (!student) studentNotFound();

  const program = await getProgramById(tx, programId);
  const { totalAcademicHours, academicHoursPerVisit, defaultLeaves } =
    await getContractDefaults(tx);
  const totalVisits = Math.floor(totalAcademicHours / academicHoursPerVisit);

  return repo.createContract(tx, {
    studentId,
    programId,
    price: program.currentPrice.toString(),
    totalVisits,
    remainingVisits: totalVisits,
    leavesLeft: defaultLeaves,
    rulesAckAt: new Date(rulesAckAt),
  });
}

function forbiddenClass(): never {
  throw new DomainError({
    code: "forbidden-class",
    status: 403,
    title: "Эрх хүрэхгүй байна",
    detail: "Энэ анги танай анги биш тул сурагч бүртгэх боломжгүй.",
  });
}

export interface EnrollStudentResult extends RegisterStudentResult {
  contractId: string;
  remainingVisits: number;
  leavesLeft: number;
}

// Шинэ шаардлага 1.4, ФШ-12...17, 20, 22, ФБШ-23: сурагч, эцэг эх (шинэ бол), гэрээ,
// ангийн бүртгэл НЭГ транзакцаар. Аль нэг нь амжилтгүй бол (жишээ нь анги дүүрсэн)
// бүгд буцна. Багш зөвхөн өөрийн ангид бүртгэнэ (ADR-008).
export async function enrollNewStudent(
  user: { id: string; role: Role },
  input: EnrollStudentInput,
): Promise<EnrollStudentResult> {
  const classIds = [...new Set(input.classIds)];
  return prisma.$transaction(async (tx) => {
    // 1. Эзэмшлийн шалгалт: ямар нэг бичилтээс өмнө.
    for (const classId of classIds) {
      const cls = await getClassInTx(tx, classId);
      if (user.role !== Role.ADMIN && cls.teacherId !== user.id) forbiddenClass();
    }

    // 2. ФШ-22: долоо хоногийн хичээлийн тоо хүрээнээс гарвал анхааруулна, баталвал хадгална.
    const weekly = await getWeeklyLessons(tx);
    if (
      !input.weeklyWarningAcknowledged &&
      (classIds.length < weekly.min || classIds.length > weekly.max)
    ) {
      throw new DomainError({
        code: "weekly-lessons-out-of-range",
        status: 409,
        title: "Долоо хоногийн хичээлийн тоо хэвийн хүрээнээс гарсан",
        detail: `Сурагч долоо хоногт ${weekly.min}-${weekly.max} удаа хичээллэх ёстой, та ${classIds.length} анги сонгосон байна. Онцгой тохиолдол бол баталгаажуулж хадгална уу.`,
        extra: { selected: classIds.length, min: weekly.min, max: weekly.max },
      });
    }

    const registered = await registerStudentInTx(tx, {
      parentPhone: input.parentPhone,
      parentFullName: input.parentFullName,
      studentFullName: input.studentFullName,
      studentPhone: input.studentPhone,
      school: input.school,
      grade: input.grade,
      consentAt: new Date(input.consentAt),
    });

    if (input.placementPercent !== undefined) {
      await repo.createAssessment(tx, {
        studentId: registered.studentId,
        type: AssessmentType.PLACEMENT,
        takenOn: new Date(input.fromDate),
        totalPercent: input.placementPercent.toFixed(2),
      });
    }

    const contract = await createContractInTx(
      tx,
      registered.studentId,
      input.programId,
      input.rulesAckAt,
    );

    const fromDate = new Date(input.fromDate);
    for (const classId of classIds) {
      await enrollContractInClassInTx(tx, contract.id, classId, fromDate);
    }

    await writeAudit(tx, {
      entity: "contract",
      entityId: contract.id,
      action: "ENROLL",
      after: { studentId: registered.studentId, programId: input.programId, classIds },
      actorId: user.id,
    });

    return {
      ...registered,
      contractId: contract.id,
      remainingVisits: contract.remainingVisits,
      leavesLeft: contract.leavesLeft,
    };
  });
}

// Багш гэрээний эзэмшлийг шалгана: өөрийн ангид идэвхтэй бүртгэлтэй эсвэл өөрийн
// зогсоосон гэрээ (суудал хаагдсан ч үргэлжлүүлэх эрхтэй). Админ хязгааргүй.
export async function assertContractAccessInTx(
  tx: Tx,
  user: { id: string; role: Role },
  contractId: string,
) {
  const contract = await repo.findContractWithPauses(tx, contractId);
  if (!contract) contractNotFound();
  if (user.role === Role.ADMIN) return contract;
  const owned = await findTeacherOwnedEnrollment(tx, contractId, user.id);
  const pausedByMe = contract.pauses.some((p) => p.pausedBy === user.id);
  if (!owned && !pausedByMe) notOwner();
  return contract;
}

function mapContractRow(row: Awaited<ReturnType<typeof repo.listContracts>>["items"][number]) {
  return {
    id: row.id,
    studentId: row.studentId,
    studentName: row.student.fullName,
    programName: row.program.name,
    status: row.status,
    totalVisits: row.totalVisits,
    remainingVisits: row.remainingVisits,
    leavesLeft: row.leavesLeft,
    freeReviewsLeft: row.freeReviewsLeft,
    meetingsCount: row._count.meetings,
    planItems: row.planItems.map((p) => ({
      position: p.position,
      topic: p.topic,
      doneAt: p.doneAt?.toISOString() ?? null,
    })),
    activePause: row.pauses[0]
      ? {
          startedOn: row.pauses[0].startedOn.toISOString().slice(0, 10),
          holdSeat: row.pauses[0].holdSeat,
          reason: row.pauses[0].reason,
        }
      : null,
    classes: row.enrollments.map((e) => ({
      id: e.class.id,
      branchName: e.class.branch.name,
      weekday: e.class.weekday,
      startTime: e.class.startTime,
      teacherName: e.class.teacher.fullName,
    })),
  };
}

// Багш өөрийн сурагчдын гэрээг (зогссон ч) харна, админ бүгдийг.
export async function listContracts(
  user: { id: string; role: Role },
  q: { status?: ContractStatus; search?: string; page: number; limit: number },
) {
  const { items, total } = await repo.listContracts(prisma, {
    ...q,
    teacherId: user.role === Role.TEACHER ? user.id : undefined,
  });
  return { items: items.map(mapContractRow), page: q.page, limit: q.limit, total };
}

// ФШ-18
export async function updateContractPlan(
  user: { id: string; role: Role },
  contractId: string,
  items: { position: number; topic: string }[],
) {
  return prisma.$transaction(async (tx) => {
    await assertContractAccessInTx(tx, user, contractId);
    await repo.replacePlanItems(tx, contractId, items);
    return repo.findContractById(tx, contractId);
  });
}

async function findTeacherOwnedEnrollment(tx: Tx, contractId: string, teacherId: string) {
  const enrollments = await getActiveEnrollmentsWithClassInTx(tx, contractId);
  return enrollments.find((e) => e.class.teacherId === teacherId);
}

function notOwner(): never {
  throw new DomainError({
    code: "forbidden-contract",
    status: 403,
    title: "Эрх хүрэхгүй байна",
    detail: "Энэ гэрээ танай ангид бүртгэлгүй байна.",
  });
}

// ФШ-72, design 6.5: гэрээг түр зогсооно. Багш, суудал хадгалах эсэхээ сонгоно.
export async function pauseContract(
  contractId: string,
  teacherId: string,
  startedOn: string,
  reason: string,
  holdSeat: boolean,
) {
  return prisma.$transaction(async (tx) => {
    const contract = await repo.findContractById(tx, contractId);
    if (!contract) contractNotFound();
    // ADR-009-ийн зарчмыг баримтлан гэрээг түгжиж, зэрэгцээ pause/resume/ирц
    // бүртгэлтэй мөргөлдөхөөс сэргийлнэ.
    await repo.lockContractForUpdate(tx, contractId);

    const ownedEnrollment = await findTeacherOwnedEnrollment(tx, contractId, teacherId);
    if (!ownedEnrollment) notOwner();

    if (contract.status !== ContractStatus.ACTIVE) {
      throw new DomainError({
        code: "contract-not-active",
        status: 409,
        title: "Гэрээ идэвхтэй биш байна",
        detail: "Зөвхөн идэвхтэй гэрээг түр зогсоох боломжтой.",
      });
    }

    const existingPause = await repo.findActivePause(tx, contractId);
    if (existingPause) {
      throw new DomainError({
        code: "contract-already-paused",
        status: 409,
        title: "Гэрээ аль хэдийн зогсоосон байна",
        detail: "Энэ гэрээнд идэвхтэй зогсолт байна.",
      });
    }

    // ФШ-72: өнгөрсөн огноогоор зогсоох боломжгүй (эхлэх огноо өнөөдөр эсвэл хойно).
    const startedOnDate = new Date(startedOn);
    if (startedOnDate.getTime() < todayInUlaanbaatar().getTime()) {
      throw new DomainError({
        code: "pause-start-in-past",
        status: 409,
        title: "Зогсоох огноо буруу байна",
        detail: "Гэрээг өнгөрсөн огноогоор түр зогсоох боломжгүй.",
      });
    }
    await repo.updateContractStatus(tx, contractId, ContractStatus.PAUSED);
    const pause = await repo.createContractPause(tx, {
      contractId,
      startedOn: startedOnDate,
      holdSeat,
      reason,
      pausedBy: teacherId,
    });

    if (!holdSeat) {
      await closeActiveEnrollmentsForContractInTx(tx, contractId, startedOnDate);
    }

    await writeAudit(tx, {
      entity: "contract",
      entityId: contractId,
      action: "PAUSE",
      after: { startedOn: startedOnDate.toISOString(), holdSeat, reason },
      reason,
      actorId: teacherId,
    });

    return pause;
  });
}

// ФШ-75, design 6.5: гэрээг үргэлжлүүлнэ. Суудал хадгалаагүй бол ядаж нэг
// ангид шинээр бүртгэнэ (6 суудлын хязгаар, ФШ-20 мөн үйлчилнэ).
export async function resumeContract(
  contractId: string,
  teacherId: string,
  resumedOn: string,
  classIds: string[] | undefined,
) {
  return prisma.$transaction(async (tx) => {
    const contract = await repo.findContractById(tx, contractId);
    if (!contract) contractNotFound();
    await repo.lockContractForUpdate(tx, contractId);

    if (contract.status !== ContractStatus.PAUSED) {
      throw new DomainError({
        code: "contract-not-paused",
        status: 409,
        title: "Гэрээ зогсоосон бус байна",
        detail: "Зөвхөн түр зогсоосон гэрээг үргэлжлүүлэх боломжтой.",
      });
    }

    const pause = await repo.findActivePause(tx, contractId);
    if (!pause) {
      throw new DomainError({
        code: "contract-pause-not-found",
        status: 409,
        title: "Идэвхтэй зогсолт олдсонгүй",
        detail: "Энэ гэрээнд идэвхтэй зогсолт бүртгэлгүй байна.",
      });
    }

    if (pause.pausedBy !== teacherId) {
      const ownedEnrollment = await findTeacherOwnedEnrollment(tx, contractId, teacherId);
      if (!ownedEnrollment) notOwner();
    }

    const resumedOnDate = new Date(resumedOn);

    if (!pause.holdSeat) {
      if (!classIds || classIds.length === 0) {
        throw new DomainError({
          code: "class-required-to-resume",
          status: 409,
          title: "Анги сонгох шаардлагатай",
          detail: "Суудал хадгалаагүй тул үргэлжлүүлэхдээ ядаж нэг анги сонгоно.",
        });
      }
      for (const classId of classIds) {
        const cls = await getClassInTx(tx, classId);
        if (cls.teacherId !== teacherId) notOwner();
        await enrollContractInClassInTx(tx, contractId, classId, resumedOnDate);
      }
    }

    await repo.closePause(tx, pause.id, resumedOnDate, teacherId);
    const updated = await repo.updateContractStatus(tx, contractId, ContractStatus.ACTIVE);

    await writeAudit(tx, {
      entity: "contract",
      entityId: contractId,
      action: "RESUME",
      after: { resumedOn: resumedOnDate.toISOString(), classIds: classIds ?? [] },
      actorId: teacherId,
    });

    return updated;
  });
}

// Нийтийн сайтаас ирсэн түвшин тогтоох цагийн хүсэлт (нэвтрэлтгүй).
export async function createPlacementRequest(input: {
  studentName: string;
  school?: string;
  grade?: string;
  phone: string;
  programInterest?: string;
  branchId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    if (input.branchId) await getBranchById(tx, input.branchId);
    const created = await repo.createPlacementRequest(tx, input);
    return { id: created.id };
  });
}

export function listPlacementRequests(status?: PlacementRequestStatus) {
  return repo.listPlacementRequests(prisma, status);
}

export function updatePlacementRequest(id: string, status: PlacementRequestStatus, note?: string) {
  return repo.updatePlacementRequest(prisma, id, { status, note });
}

// ---------------------------------------------------------------------------
// Порталын харагдац (эцэг эх, сурагч). Зөвхөн уншдаг, бизнесийн дүрэм агуулахгүй.
// ---------------------------------------------------------------------------

export interface PortalUser {
  id: string;
  role: Role;
}

export interface StudentOverview {
  studentId: string;
  fullName: string;
  school: string | null;
  grade: string | null;
  contracts: {
    id: string;
    programName: string;
    status: ContractStatus;
    totalVisits: number;
    remainingVisits: number;
    leavesLeft: number;
    freeReviewsLeft: number;
    classes: {
      id: string;
      weekday: number;
      startTime: string;
      durationMin: number;
      teacherName: string;
      branchName: string;
    }[];
  }[];
}

type StudentWithContracts = NonNullable<Awaited<ReturnType<typeof repo.findStudentForStudentUser>>>;

function toStudentOverview(student: StudentWithContracts): StudentOverview {
  return {
    studentId: student.id,
    fullName: student.fullName,
    school: student.school,
    grade: student.grade,
    contracts: student.contracts.map((contract) => ({
      id: contract.id,
      programName: contract.program.name,
      status: contract.status,
      totalVisits: contract.totalVisits,
      remainingVisits: contract.remainingVisits,
      leavesLeft: contract.leavesLeft,
      freeReviewsLeft: contract.freeReviewsLeft,
      classes: contract.enrollments.map((enrollment) => ({
        id: enrollment.class.id,
        weekday: enrollment.class.weekday,
        startTime: enrollment.class.startTime,
        durationMin: enrollment.class.durationMin,
        teacherName: enrollment.class.teacher.fullName,
        branchName: enrollment.class.branch.name,
      })),
    })),
  };
}

// ФШ-23, ФБШ-20: эцэг эх өөрийн хүүхдүүдийг, сурагч зөвхөн өөрийгөө харна.
export function listStudentsForUser(user: PortalUser): Promise<StudentOverview[]> {
  return prisma.$transaction(async (tx) => {
    if (user.role === Role.PARENT) {
      const students = await repo.findStudentsForParent(tx, user.id);
      return students.map(toStudentOverview);
    }
    if (user.role === Role.STUDENT) {
      const student = await repo.findStudentForStudentUser(tx, user.id);
      return student ? [toStudentOverview(student)] : [];
    }
    return [];
  });
}

function forbiddenStudent(): never {
  throw new DomainError({
    code: "forbidden-student",
    status: 403,
    title: "Эрх хүрэхгүй байна",
    detail: "Энэ сурагчийн мэдээллийг харах эрхгүй байна.",
  });
}

// ADR-008, BOLA: эцэг эх зөвхөн parent_students-д холбогдсон хүүхдэд, сурагч
// зөвхөн өөрт (students.user_id) хандана.
// Сурагчийн сургалтын мэдээллийг (дүн, явц) харах эрх: админ бүгд, багш өөрийн сурагч,
// эцэг эх өөрийн хүүхэд, сурагч өөрийгөө (Хүснэгт 2.2, ADR-008).
export async function assertStudentReadAccessInTx(
  tx: Tx,
  user: { id: string; role: Role },
  studentId: string,
) {
  if (user.role === Role.ADMIN) {
    if (!(await repo.findStudentById(tx, studentId))) studentNotFound();
    return;
  }
  if (user.role === Role.TEACHER) {
    if (!(await repo.findTeacherContractOfStudent(tx, studentId, user.id))) forbiddenStudent();
    return;
  }
  await assertStudentAccessInTx(tx, user, studentId);
}

export async function assertStudentAccessInTx(tx: Tx, user: PortalUser, studentId: string) {
  if (user.role === Role.PARENT) {
    const link = await repo.findParentStudentLink(tx, user.id, studentId);
    if (!link) forbiddenStudent();
    return;
  }
  if (user.role === Role.STUDENT) {
    const student = await repo.findStudentById(tx, studentId);
    if (!student || student.userId !== user.id) forbiddenStudent();
    return;
  }
  forbiddenStudent();
}

// Гэрээг эзэмшлийн шалгалттай буцаана: байхгүй бол 404, өөр хүнийх бол 403.
export async function getContractForUserInTx(tx: Tx, user: PortalUser, contractId: string) {
  const contract = await repo.findContractWithStudent(tx, contractId);
  if (!contract) {
    throw new DomainError({
      code: "contract-not-found",
      status: 404,
      title: "Гэрээ олдсонгүй",
      detail: "Заасан гэрээ бүртгэлгүй байна.",
    });
  }
  await assertStudentAccessInTx(tx, user, contract.studentId);
  return contract;
}

export function assertStudentAccess(user: PortalUser, studentId: string) {
  return prisma.$transaction((tx) => assertStudentAccessInTx(tx, user, studentId));
}

export function hasActiveEnrollmentInClassInTx(tx: Tx, contractId: string, classId: string) {
  return repo.findActiveEnrollmentInClass(tx, contractId, classId);
}

// ФШ-36, 60, 61: эцэг эх бүрт outbox-д мэдэгдэл бичнэ (эцэг эхийн сонгосон сувгаар,
// сонголтгүй бол PUSH). Үндсэн өөрчлөлттэй нэг транзакцад дуудна (ADR-006).
export async function notifyParentsInTx(
  tx: Tx,
  studentId: string,
  template: string,
  payload: Prisma.InputJsonValue,
) {
  const links = await repo.findParentsOfStudent(tx, studentId);
  for (const link of links) {
    const stored = link.parent.notifyChannels;
    const channels = (Array.isArray(stored) ? stored : []).filter(
      (c): c is "PUSH" | "EMAIL" | "SMS" => c === "PUSH" || c === "EMAIL" || c === "SMS",
    );
    for (const channel of channels.length > 0 ? channels : (["PUSH"] as const)) {
      await enqueue(tx, { recipientId: link.parentId, channel, template, payload });
    }
  }
}
