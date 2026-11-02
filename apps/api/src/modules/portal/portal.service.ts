import { getAttendanceOverview } from "../attendance/attendance.service.js";
import { listStudentsForUser, type PortalUser } from "../enrollment/enrollment.service.js";
import { getPaymentCard } from "../payments/payments.service.js";

// ФШ-23: эцэг эх хүүхдүүдээ, сурагч өөрийгөө. Төлбөрийн мэдээлэл энд орохгүй.
export async function getSummary(user: PortalUser) {
  return { students: await listStudentsForUser(user) };
}

export function getStudentAttendance(user: PortalUser, studentId: string) {
  return getAttendanceOverview(user, studentId);
}

// ФШ-49, 66, 77, ADR-016: зөвхөн эцэг эх (маршрутад PARENT) өөрийн хүүхдийн гэрээний
// төлбөрийн карт: үлдэгдэл, тооцоолсон төлөв, дансны мэдээлэл, гүйлгээний утга.
export function getPaymentInstructions(user: PortalUser, contractId: string) {
  return getPaymentCard(user, contractId);
}
