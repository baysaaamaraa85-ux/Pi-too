import type {
  PlacementForwardCandidateDto,
  PlacementRequestDto,
  TeacherPlacementRequestsDto,
} from "@pitoo/contracts";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { Role, type PlacementRequestStatus } from "../../generated/prisma/client.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { notifyUser } from "../../shared/outbox/notify-user.js";
import { getActiveBranchById, getBranchById, setBranchLeadInTx } from "../catalog/catalog.service.js";
import * as repo from "./placement.repository.js";

// D-102: түвшин тогтоох цагийн хүсэлт. Нийтийн сайтаас ирсэн хүсэлт тухайн салбарын ахлагч багшид очно.
// Ахлагч эцэг эхтэйгээ холбогдож төлөв, тэмдэглэл бичнэ, салбар дээрээ байхгүй бол салбарын өөр багшид шилжүүлнэ.
// Админ бүх хүсэлтийг хуучнаараа харна.

interface Actor {
  id: string;
  role: Role;
}

// Хүсэлт нээлттэй (хараахан дуусаагүй, цуцлаагүй) төлвүүд.
const OPEN_STATUSES: PlacementRequestStatus[] = ["NEW", "CONTACTED", "SCHEDULED"];

function toDto(r: repo.PlacementRequestRow): PlacementRequestDto {
  return {
    id: r.id,
    studentName: r.studentName,
    school: r.school,
    grade: r.grade,
    phone: r.phone,
    programInterest: r.programInterest,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    branch: r.branch ? { id: r.branch.id, name: r.branch.name } : null,
    assignedTeacher: r.assignedTeacher
      ? { id: r.assignedTeacher.userId, fullName: r.assignedTeacher.fullName }
      : null,
  };
}

function notFound(): never {
  throw new DomainError({
    code: "placement-request-not-found",
    status: 404,
    title: "Хүсэлт олдсонгүй",
    detail: "Заасан түвшин тогтоох хүсэлт бүртгэлгүй байна.",
  });
}

function forbidden(): never {
  throw new DomainError({
    code: "forbidden-placement-request",
    status: 403,
    title: "Эрх хүрэхгүй байна",
    detail: "Энэ хүсэлт танай салбарын эсвэл танд шилжүүлсэн хүсэлт биш байна.",
  });
}

// Эзэмшлийн шалгалт (BOLA): админ бүгдийг, багш зөвхөн өөрийн ахалдаг салбарын эсвэл өөрт нь шилжүүлсэн хүсэлтийг.
function assertCanAccess(actor: Actor, request: repo.PlacementRequestRow) {
  if (actor.role === Role.ADMIN) return;
  const isLead = request.branch?.leadTeacherId === actor.id;
  const isAssignee = request.assignedTeacherId === actor.id;
  if (!isLead && !isAssignee) forbidden();
}

// Шилжүүлэх эрх зөвхөн тухайн салбарын ахлагчид.
function assertIsBranchLead(actor: Actor, request: repo.PlacementRequestRow) {
  if (actor.role !== Role.TEACHER || request.branch?.leadTeacherId !== actor.id) {
    throw new DomainError({
      code: "forbidden-placement-forward",
      status: 403,
      title: "Эрх хүрэхгүй байна",
      detail: "Хүсэлтийг зөвхөн тухайн салбарын ахлагч өөр багшид шилжүүлнэ.",
    });
  }
}

async function loadRequest(tx: Tx, id: string) {
  const request = await repo.findPlacementRequest(tx, id);
  if (!request) notFound();
  return request;
}

// Нийтийн сайтаас ирсэн хүсэлт (нэвтрэлтгүй). Салбартай, ахлагч нь идэвхтэй бол хүсэлт түүнд хуваарилагдаж
// мэдэгдэл очно. Ахлагчгүй эсвэл салбар сонгоогүй бол хуваарилагдахгүй, зөвхөн админ харна.
export async function createPlacementRequest(input: {
  studentName: string;
  school?: string;
  grade?: string;
  phone: string;
  programInterest?: string;
  branchId?: string;
}) {
  return prisma.$transaction(async (tx) => {
    let leadId: string | undefined;
    let branchName = "";
    if (input.branchId) {
      await getActiveBranchById(tx, input.branchId);
      const branch = await repo.findBranchLead(tx, input.branchId);
      branchName = branch?.name ?? "";
      if (branch?.leadTeacherId && branch.leadTeacher?.user.isActive) leadId = branch.leadTeacherId;
    }
    const created = await repo.createPlacementRequest(tx, { ...input, assignedTeacherId: leadId });
    if (leadId) {
      // Мэдэгдэлд сурагч, эцэг эхийн хувийн мэдээлэл оруулахгүй (хүсэлтийг системээс нээж харна).
      await notifyUser(tx, leadId, "placement_request_new", { requestId: created.id, branchName });
    }
    return { id: created.id };
  });
}

export async function listPlacementRequests(status?: PlacementRequestStatus) {
  const rows = await repo.listAllPlacementRequests(prisma, status);
  return rows.map(toDto);
}

// Багшийн хуудас: ахлагч мөн эсэх, ахалж буй салбарууд, харж болох хүсэлтүүд.
export async function listMyPlacementRequests(actor: Actor): Promise<TeacherPlacementRequestsDto> {
  const [ledBranches, rows] = await Promise.all([
    repo.listBranchesLedBy(prisma, actor.id),
    repo.listPlacementRequestsForTeacher(prisma, actor.id),
  ]);
  return { isLead: ledBranches.length > 0, ledBranches, requests: rows.map(toDto) };
}

export async function updatePlacementRequest(
  actor: Actor,
  id: string,
  status: PlacementRequestStatus,
  note?: string,
) {
  return prisma.$transaction(async (tx) => {
    const request = await loadRequest(tx, id);
    assertCanAccess(actor, request);
    const updated = await repo.updatePlacementRequest(tx, id, { status, note });
    await writeAudit(tx, {
      entity: "placement_request",
      entityId: id,
      action: "UPDATE",
      before: { status: request.status },
      after: { status },
      actorId: actor.id,
    });
    return toDto(updated);
  });
}

// Шилжүүлэх боломжтой багш нар: салбарт идэвхтэй анги заадаг багш нар ба ахлагч өөрөө (өөртөө буцаах), одоогийн
// хариуцагчаас бусад.
async function forwardCandidatesOf(tx: Tx, request: repo.PlacementRequestRow): Promise<PlacementForwardCandidateDto[]> {
  if (!request.branch) return [];
  const teachers = await repo.listBranchTeachers(tx, request.branch.id);
  const byId = new Map<string, PlacementForwardCandidateDto>(
    teachers.map((t) => [t.userId, { id: t.userId, fullName: t.fullName }]),
  );
  const leadId = request.branch.leadTeacherId;
  if (leadId && request.branch.leadTeacher) {
    byId.set(leadId, { id: leadId, fullName: request.branch.leadTeacher.fullName });
  }
  if (request.assignedTeacherId) byId.delete(request.assignedTeacherId);
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function listForwardCandidates(actor: Actor, id: string) {
  return prisma.$transaction(async (tx) => {
    const request = await loadRequest(tx, id);
    assertIsBranchLead(actor, request);
    return forwardCandidatesOf(tx, request);
  });
}

// Ахлагч хүсэлтийг салбарын өөр багшид шилжүүлнэ: тэр багш хариуцагч болж, мэдэгдэл авч, хүсэлтийг өөрийн
// хуудаснаас харж төлөв, тэмдэглэл бичнэ. Ахлагч мөн л харсаар байна.
export async function forwardPlacementRequest(actor: Actor, id: string, teacherId: string) {
  return prisma.$transaction(async (tx) => {
    const request = await loadRequest(tx, id);
    assertIsBranchLead(actor, request);

    if (!OPEN_STATUSES.includes(request.status)) {
      throw new DomainError({
        code: "placement-request-closed",
        status: 409,
        title: "Хүсэлт хаагдсан байна",
        detail: "Түвшин тогтоосон эсвэл цуцалсан хүсэлтийг шилжүүлэх боломжгүй.",
      });
    }
    const candidates = await forwardCandidatesOf(tx, request);
    if (!candidates.some((c) => c.id === teacherId)) {
      throw new DomainError({
        code: "forward-target-invalid",
        status: 409,
        title: "Энэ багшид шилжүүлэх боломжгүй",
        detail: "Хүсэлтийг зөвхөн тухайн салбарт анги заадаг, идэвхтэй багшид шилжүүлнэ.",
      });
    }

    const updated = await repo.setPlacementAssignee(tx, id, teacherId);
    if (teacherId !== actor.id) {
      await notifyUser(tx, teacherId, "placement_request_forwarded", {
        requestId: id,
        branchName: request.branch?.name ?? "",
      });
    }
    await writeAudit(tx, {
      entity: "placement_request",
      entityId: id,
      action: "FORWARD",
      before: { assignedTeacherId: request.assignedTeacherId },
      after: { assignedTeacherId: teacherId },
      actorId: actor.id,
    });
    return toDto(updated);
  });
}

// Салбарын ахлагчаар тухайн салбарт идэвхтэй анги заадаг, идэвхтэй багшийг л томилно.
async function assertEligibleLead(tx: Tx, branchId: string, teacherId: string) {
  const teacher = await repo.findTeacherWithAccount(tx, teacherId);
  if (!teacher) {
    throw new DomainError({
      code: "teacher-not-found",
      status: 404,
      title: "Багш олдсонгүй",
      detail: "Заасан багш бүртгэлгүй байна.",
    });
  }
  if (!teacher.user.isActive) {
    throw new DomainError({
      code: "lead-inactive",
      status: 409,
      title: "Багш идэвхгүй байна",
      detail: "Идэвхгүй болсон багшийг салбарын ахлагчаар томилох боломжгүй.",
    });
  }
  if ((await repo.countActiveClassesOfTeacherInBranch(tx, teacherId, branchId)) === 0) {
    throw new DomainError({
      code: "lead-not-in-branch",
      status: 409,
      title: "Энэ салбарын багш биш байна",
      detail: "Салбарын ахлагчаар тухайн салбарт идэвхтэй анги заадаг багшийг томилно.",
    });
  }
}

// Админ салбарын ахлагчийг томилно, солино (teacherId = null бол хасна). Нээлттэй хүсэлтүүд шинэ ахлагчид шилжинэ.
export async function setBranchLead(actor: Actor, branchId: string, teacherId: string | null) {
  return prisma.$transaction(async (tx) => {
    const branch = await getBranchById(tx, branchId);
    if (teacherId) await assertEligibleLead(tx, branchId, teacherId);

    const previous = branch.leadTeacherId;
    if (previous === teacherId) return { branchId, leadTeacherId: teacherId, reassigned: 0 };

    await setBranchLeadInTx(tx, branchId, teacherId);
    // Томилох үед хуучин ахлагчийнх болон хуваарилагдаагүй нээлттэй хүсэлтүүд шинэ ахлагчид очно.
    // Хасах үед хуучин ахлагчийн хүсэлтүүд хуваарилагдаагүй болно. Бусад багшид шилжүүлсэн хүсэлт хөндөгдөхгүй.
    const reassigned = await repo.reassignOpenPlacementRequests(tx, {
      branchId,
      from: teacherId ? [previous, null] : [previous],
      to: teacherId,
      openStatuses: OPEN_STATUSES,
    });
    if (teacherId) {
      await notifyUser(tx, teacherId, "branch_lead_assigned", {
        branchName: branch.name,
        openRequests: reassigned.count,
      });
    }
    await writeAudit(tx, {
      entity: "branch",
      entityId: branchId,
      action: "SET_LEAD",
      before: { leadTeacherId: previous },
      after: { leadTeacherId: teacherId, reassignedRequests: reassigned.count },
      actorId: actor.id,
    });
    return { branchId, leadTeacherId: teacherId, reassigned: reassigned.count };
  });
}
