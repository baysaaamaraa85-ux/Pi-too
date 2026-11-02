import { prisma } from "../../shared/db/prisma.js";
import { ContractStatus, LessonStatus } from "../../generated/prisma/client.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { enqueue } from "../../shared/outbox/enqueue.js";
import {
  assertStudentAccessInTx,
  getContractForUserInTx,
  hasActiveEnrollmentInClassInTx,
  type PortalUser,
} from "../enrollment/enrollment.service.js";
import * as repo from "./attendance.repository.js";

function leaveRejected(code: string, title: string, detail: string): never {
  throw new DomainError({ code, status: 409, title, detail });
}

// ФШ-30: эцэг эх, сурагч хичээл эхлэхээс өмнө чөлөө хүснэ. Чөлөөний эрхийн
// тооцоо энд хийгдэхгүй, ирц бүртгэхэд ФШ-28, 29-өөр явна. Энд зөвхөн хүсэлтийг
// хадгалж, хариуцсан багшид мэдэгдэнэ.
export async function createLeaveRequest(user: PortalUser, contractId: string, lessonId: string) {
  return prisma.$transaction(async (tx) => {
    // Эзэмшлийн шалгалт: гэрээ тухайн эцэг эхийн хүүхдийнх / сурагч өөрийнх байх ёстой.
    const contract = await getContractForUserInTx(tx, user, contractId);

    const lesson = await repo.findLessonById(tx, lessonId);
    if (!lesson) {
      throw new DomainError({
        code: "lesson-not-found",
        status: 404,
        title: "Хичээл олдсонгүй",
        detail: "Заасан хичээл бүртгэлгүй байна.",
      });
    }

    if (lesson.status !== LessonStatus.SCHEDULED) {
      leaveRejected(
        "lesson-not-open",
        "Хичээл товлогдоогүй байна",
        "Цуцлагдсан эсвэл шилжсэн хичээлд чөлөө хүсэх шаардлагагүй.",
      );
    }
    // ФШ-30: хичээл эхлэхээс өмнө.
    if (lesson.startsAt.getTime() <= Date.now()) {
      leaveRejected(
        "leave-too-late",
        "Чөлөө хүсэх хугацаа өнгөрсөн",
        "Хичээл эхэлсэн тул чөлөөг системээр хүсэх боломжгүй. Багштайгаа холбогдоно уу.",
      );
    }
    if (contract.status !== ContractStatus.ACTIVE) {
      leaveRejected(
        "contract-not-active",
        "Гэрээ идэвхгүй байна",
        "Зөвхөн идэвхтэй гэрээнд чөлөө хүсэх боломжтой.",
      );
    }
    const enrolled = await hasActiveEnrollmentInClassInTx(tx, contract.id, lesson.classId);
    if (!enrolled) {
      leaveRejected(
        "not-enrolled-in-lesson",
        "Энэ хичээлд бүртгэлгүй байна",
        "Сурагч энэ хичээлийн ангид бүртгэлгүй тул чөлөө хүсэх боломжгүй.",
      );
    }
    const existing = await repo.findLeaveRequest(tx, contract.id, lesson.id);
    if (existing) {
      leaveRejected(
        "leave-request-exists",
        "Чөлөө аль хэдийн хүссэн байна",
        "Энэ хичээлд чөлөөний хүсэлт өгсөн байна.",
      );
    }

    const created = await repo.createLeaveRequest(tx, {
      contractId: contract.id,
      lessonId: lesson.id,
      requestedBy: user.id,
    });

    // ФШ-30: хариуцсан багшид мэдэгдэл (outbox, ADR-006).
    await enqueue(tx, {
      recipientId: lesson.teacherId,
      channel: "PUSH",
      template: "leave_requested",
      payload: {
        lessonId: lesson.id,
        studentName: contract.student.fullName,
        startsAt: lesson.startsAt.toISOString(),
      },
    });
    await writeAudit(tx, {
      entity: "leave_request",
      entityId: created.id,
      action: "CREATE",
      after: { contractId: contract.id, lessonId: lesson.id },
      actorId: user.id,
    });

    return {
      id: created.id,
      contractId: created.contractId,
      lessonId: created.lessonId,
      createdAt: created.createdAt.toISOString(),
    };
  });
}

// Порталын "Миний ирц": ирцийн түүх ба ирээдүйн чөлөөний хүсэлтүүд.
export async function getAttendanceOverview(user: PortalUser, studentId: string) {
  return prisma.$transaction(async (tx) => {
    await assertStudentAccessInTx(tx, user, studentId);
    const rows = await repo.findAttendanceForStudent(tx, studentId);
    const leaveRequests = await repo.findUpcomingLeaveRequestsForStudent(
      tx,
      studentId,
      new Date(),
    );
    return {
      records: rows.map((row) => ({
        id: row.id,
        lessonId: row.lessonId,
        contractId: row.contractId,
        startsAt: row.lesson.startsAt.toISOString(),
        programName: row.contract.program.name,
        status: row.status,
        isMakeup: row.isMakeup,
      })),
      leaveRequests,
    };
  });
}
