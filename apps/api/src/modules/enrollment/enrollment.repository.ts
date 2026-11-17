import type { Tx } from "../../shared/db/prisma.js";
import type {
  Prisma,
  AssessmentType,
  ContractStatus,
  PlacementRequestStatus,
} from "../../generated/prisma/client.js";

export function searchParentsByPhone(tx: Tx, phone: string) {
  return tx.parent.findMany({ where: { phone: { contains: phone } } });
}

export function findParentByPhone(tx: Tx, phone: string) {
  return tx.parent.findUnique({ where: { phone } });
}

export function createStudent(
  tx: Tx,
  data: {
    fullName: string;
    userId?: string;
    school?: string;
    grade?: string;
    consentAt?: Date;
  },
) {
  return tx.student.create({ data });
}

export function findStudentById(tx: Tx, id: string) {
  return tx.student.findUnique({ where: { id } });
}

export function linkParentStudent(tx: Tx, parentId: string, studentId: string) {
  return tx.parentStudent.create({ data: { parentId, studentId } });
}

export function createAssessment(
  tx: Tx,
  data: {
    studentId: string;
    contractId?: string;
    type: AssessmentType;
    takenOn: Date;
    totalPercent: string;
  },
) {
  return tx.assessment.create({ data });
}

export function createContract(
  tx: Tx,
  data: {
    studentId: string;
    programId: string;
    price: string;
    totalHours: number;
    remainingHours: number;
    leavesLeft: number;
    rulesAckAt: Date;
  },
) {
  return tx.contract.create({ data });
}

export function findContractById(tx: Tx, id: string) {
  return tx.contract.findUnique({ where: { id } });
}

// FOR UPDATE: тоолуур/төлөвт нөлөөлөх үйлдлийн өмнө гэрээг түгжинэ (CLAUDE.md 6.3, ADR-009).
export async function lockContractForUpdate(tx: Tx, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM contracts WHERE id = ${id}::uuid FOR UPDATE
  `;
  return rows[0];
}

// tx нь аль хэдийн транзакц дотор байгаа тул дараалсан дуудлага хангалттай
// (tx.$transaction гэж дахин нээх шаардлагагүй, TransactionClient-д ч байхгүй).
export async function replacePlanItems(
  tx: Tx,
  contractId: string,
  items: { position: number; topic: string }[],
) {
  await tx.planItem.deleteMany({ where: { contractId } });
  if (items.length > 0) {
    await tx.planItem.createMany({ data: items.map((item) => ({ contractId, ...item })) });
  }
}

export function updateContractStatus(tx: Tx, id: string, status: ContractStatus) {
  return tx.contract.update({ where: { id }, data: { status } });
}

export function findActivePause(tx: Tx, contractId: string) {
  return tx.contractPause.findFirst({ where: { contractId, endedOn: null } });
}

export function createContractPause(
  tx: Tx,
  data: { contractId: string; startedOn: Date; holdSeat: boolean; reason: string; pausedBy: string },
) {
  return tx.contractPause.create({ data });
}

export function closePause(tx: Tx, id: string, endedOn: Date, resumedBy: string) {
  return tx.contractPause.update({ where: { id }, data: { endedOn, resumedBy } });
}

export function createPlacementRequest(
  tx: Tx,
  data: {
    studentName: string;
    school?: string;
    grade?: string;
    phone: string;
    programInterest?: string;
    branchId?: string;
  },
) {
  return tx.placementRequest.create({ data });
}

export function listPlacementRequests(tx: Tx, status?: PlacementRequestStatus) {
  return tx.placementRequest.findMany({
    where: status ? { status } : undefined,
    include: { branch: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export function updatePlacementRequest(
  tx: Tx,
  id: string,
  data: { status: PlacementRequestStatus; note?: string },
) {
  return tx.placementRequest.update({ where: { id }, data });
}

// Порталын харагдац: хэрэглэгчтэй холбоотой сурагчид, тэдний гэрээ, одоогийн анги.
// PARENT бол parent_students-ээр, STUDENT бол students.user_id-аар холбогдоно.
const studentWithContracts = {
  contracts: {
    orderBy: { createdAt: "desc" },
    include: {
      program: true,
      enrollments: {
        where: { toDate: null },
        include: { class: { include: { teacher: true, branch: true } } },
      },
    },
  },
} as const;

export function findStudentsForParent(tx: Tx, parentUserId: string) {
  return tx.student.findMany({
    where: { parentStudents: { some: { parentId: parentUserId } } },
    include: studentWithContracts,
    orderBy: { fullName: "asc" },
  });
}

export function findStudentForStudentUser(tx: Tx, studentUserId: string) {
  return tx.student.findUnique({
    where: { userId: studentUserId },
    include: studentWithContracts,
  });
}

export function findParentStudentLink(tx: Tx, parentUserId: string, studentId: string) {
  return tx.parentStudent.findUnique({
    where: { parentId_studentId: { parentId: parentUserId, studentId } },
  });
}

export function findContractWithStudent(tx: Tx, contractId: string) {
  return tx.contract.findUnique({
    where: { id: contractId },
    include: {
      student: true,
      program: true,
      enrollments: {
        where: { toDate: null },
        include: { class: { include: { teacher: true } } },
      },
    },
  });
}

export function findActiveEnrollmentInClass(tx: Tx, contractId: string, classId: string) {
  return tx.enrollment.findFirst({ where: { contractId, classId, toDate: null } });
}

const contractListInclude = {
  _count: { select: { meetings: true } },
  student: true,
  program: true,
  planItems: { orderBy: { position: "asc" } },
  pauses: { where: { endedOn: null } },
  enrollments: {
    where: { toDate: null },
    include: { class: { include: { branch: true, teacher: true } } },
  },
} satisfies Prisma.ContractInclude;

// Багшид: өөрийн ангид идэвхтэй бүртгэлтэй, эсвэл өөрийн зогсоосон гэрээнүүд.
// Админд: бүх гэрээ.
function contractListWhere(f: {
  teacherId?: string;
  status?: ContractStatus;
  search?: string;
}): Prisma.ContractWhereInput {
  return {
    ...(f.status ? { status: f.status } : {}),
    ...(f.search
      ? { student: { fullName: { contains: f.search, mode: "insensitive" } } }
      : {}),
    ...(f.teacherId
      ? {
          OR: [
            { enrollments: { some: { toDate: null, class: { teacherId: f.teacherId } } } },
            { pauses: { some: { endedOn: null, pausedBy: f.teacherId } } },
          ],
        }
      : {}),
  };
}

export async function listContracts(
  tx: Tx,
  f: { teacherId?: string; status?: ContractStatus; search?: string; page: number; limit: number },
) {
  const where = contractListWhere(f);
  const [items, total] = await Promise.all([
    tx.contract.findMany({
      where,
      include: contractListInclude,
      orderBy: [{ createdAt: "desc" }],
      skip: (f.page - 1) * f.limit,
      take: f.limit,
    }),
    tx.contract.count({ where }),
  ]);
  return { items, total };
}

export function findContractWithPauses(tx: Tx, id: string) {
  return tx.contract.findUnique({
    where: { id },
    include: { pauses: { where: { endedOn: null } } },
  });
}

export function findParentsOfStudent(tx: Tx, studentId: string) {
  return tx.parentStudent.findMany({
    where: { studentId },
    include: { parent: true },
  });
}

// Багшийн сурагчид хандах эрх: өөрийн ангид идэвхтэй бүртгэлтэй, өөрийн зогсоосон,
// эсвэл өөрийн хичээлд ирцтэй гэрээ байх.
export function findTeacherContractOfStudent(tx: Tx, studentId: string, teacherId: string) {
  return tx.contract.findFirst({
    where: {
      studentId,
      OR: [
        { enrollments: { some: { toDate: null, class: { teacherId } } } },
        { pauses: { some: { pausedBy: teacherId } } },
        { attendance: { some: { lesson: { teacherId } } } },
      ],
    },
    select: { id: true },
  });
}

// D-67: ах дүүгийн хөнгөлөлт. listPrice нь хөнгөлөлт тавихаас өмнөх үнэ, price нь төлөх (хөнгөлсөн) үнэ.
export function updateContractDiscount(
  tx: Tx,
  id: string,
  data: { siblingDiscountPercent: string; price: string; listPrice: string },
) {
  return tx.contract.update({ where: { id }, data });
}
