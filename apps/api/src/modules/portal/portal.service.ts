import { prisma } from "../../shared/db/prisma.js";
import { getAttendanceOverview } from "../attendance/attendance.service.js";
import { getPaymentAccount } from "../catalog/catalog.service.js";
import {
  getContractForUserInTx,
  listStudentsForUser,
  type PortalUser,
} from "../enrollment/enrollment.service.js";

// ФШ-23: эцэг эх хүүхдүүдээ, сурагч өөрийгөө. Төлбөрийн мэдээлэл энд орохгүй.
export async function getSummary(user: PortalUser) {
  return { students: await listStudentsForUser(user) };
}

export function getStudentAttendance(user: PortalUser, studentId: string) {
  return getAttendanceOverview(user, studentId);
}

// ФШ-49, 66, ADR-016: зөвхөн эцэг эх (маршрутад PARENT) өөрийн хүүхдийн гэрээний
// төлбөрийн зааврыг авна. Сурагч 403 авна. Төлөх үлдэгдэл, төлбөрийн төлөв
// (ФШ-47, 77) төлбөрийн модуль (М7) хийгдсэний дараа нэмэгдэнэ, одоогоор гэрээний
// үнийг харуулна.
export function getPaymentInstructions(user: PortalUser, contractId: string) {
  return prisma.$transaction(async (tx) => {
    const contract = await getContractForUserInTx(tx, user, contractId);
    const account = await getPaymentAccount(tx);
    const teacherNames = [
      ...new Set(contract.enrollments.map((enrollment) => enrollment.class.teacher.fullName)),
    ];
    return {
      contractId: contract.id,
      studentName: contract.student.fullName,
      programName: contract.program.name,
      price: contract.price.toFixed(2),
      account,
      // ФШ-49: гүйлгээний утгад хүүхдийн нэр, багшийн нэр.
      transferNote: [contract.student.fullName, ...teacherNames].join(" - "),
    };
  });
}
