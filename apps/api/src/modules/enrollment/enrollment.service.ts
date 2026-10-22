import { prisma, type Tx } from "../../shared/db/prisma.js";
import {
  AssessmentType,
  ContractStatus,
  type PlacementRequestStatus,
} from "../../generated/prisma/client.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { createUserInTx } from "../auth/auth.service.js";
import { getBranchById, getContractDefaults, getProgramById } from "../catalog/catalog.service.js";
import {
  closeActiveEnrollmentsForContractInTx,
  enrollContractInClassInTx,
  getActiveEnrollmentsWithClassInTx,
  getClassInTx,
} from "../scheduling/scheduling.service.js";
import * as repo from "./enrollment.repository.js";

export function searchParentsByPhone(phone: string) {
  return repo.searchParentsByPhone(prisma, phone);
}

export interface RegisterStudentResult {
  studentId: string;
  parentId: string;
  tempPassword?: string;
}

// ФШ-12, 13: сурагч, эцэг эх, холбоосыг нэг транзакцаар үүсгэнэ. Ижил
// утастай эцэг эх байвал дахин ашиглана (шинэ User+Parent үүсгэхгүй).
export async function registerStudent(input: {
  parentPhone: string;
  parentFullName?: string;
  studentFullName: string;
  school?: string;
  grade?: string;
}): Promise<RegisterStudentResult> {
  return prisma.$transaction(async (tx) => {
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

    const student = await repo.createStudent(tx, {
      fullName: input.studentFullName,
      school: input.school,
      grade: input.grade,
    });
    await repo.linkParentStudent(tx, parentId, student.id);

    return { studentId: student.id, parentId, tempPassword };
  });
}

// ФШ-14: түвшин тогтоох шалгалт.
export function recordPlacementAssessment(
  studentId: string,
  takenOn: string,
  totalPercent: number,
) {
  return repo.createAssessment(prisma, {
    studentId,
    type: AssessmentType.PLACEMENT,
    takenOn: new Date(takenOn),
    totalPercent: totalPercent.toFixed(2),
  });
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
export async function createContract(
  studentId: string,
  programId: string,
  rulesAckAt: string,
) {
  return prisma.$transaction(async (tx) => {
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
  });
}

// ФШ-18
export async function updateContractPlan(
  contractId: string,
  items: { position: number; topic: string }[],
) {
  return prisma.$transaction(async (tx) => {
    const contract = await repo.findContractById(tx, contractId);
    if (!contract) contractNotFound();
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

    const startedOnDate = new Date(startedOn);
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
