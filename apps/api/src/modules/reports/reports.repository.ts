import { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../../shared/db/prisma.js";

// М11: зөвхөн унших асуулгууд (design 5.2: reports бусдыг зөвхөн уншина).
//
// Салбарт хуваарилах дүрэм (decisions-log D-50): сурагч бүр ЯГ НЭГ салбарт хамаарна, тэр нь
// сурагчийн хамгийн сүүлд эхэлсэн бүртгэлийн (enrollment) ангийн салбар. Ингэснээр сурагч,
// төлбөр, өр, багц үргэлжлүүлэлт салбар бүрт давхардахгүй, салбаруудын нийлбэр байгууллагын
// нийлбэртэй тэнцүү байна (ФШ-69). Ирц, цалин нь хичээлийн ангийн салбараар.
// Бүртгэлгүй сурагч branchId = null ("Салбаргүй").
const studentBranch = Prisma.sql`
  student_branch AS (
    SELECT DISTINCT ON (ct.student_id) ct.student_id, cl.branch_id
    FROM enrollments e
    JOIN contracts ct ON ct.id = e.contract_id
    JOIN classes cl ON cl.id = e.class_id
    ORDER BY ct.student_id, e.from_date DESC, e.id DESC
  )`;

export interface MonthRange {
  start: Date; // Улаанбаатарын сарын эхлэл (UTC цагаар)
  end: Date; // дараа сарын эхлэл
  startDate: string; // ОООО-СС-01
  endDate: string; // дараа сарын 01
}

type CountRow = { branchId: string | null; value: number };
type MoneyRow = { branchId: string | null; value: Prisma.Decimal };

export function listBranches(tx: Tx) {
  return tx.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}

// "Идэвхтэй сурагч" = тухайн сард ирцийн мөртэй (ямар ч төлөвтэй) өвөрмөц сурагч.
export function activeStudents(tx: Tx, m: MonthRange) {
  return tx.$queryRaw<CountRow[]>`
    WITH ${studentBranch}
    SELECT sb.branch_id AS "branchId", COUNT(DISTINCT ct.student_id)::int AS value
    FROM attendance a
    JOIN lessons l ON l.id = a.lesson_id
    JOIN contracts ct ON ct.id = a.contract_id
    LEFT JOIN student_branch sb ON sb.student_id = ct.student_id
    WHERE l.starts_at >= ${m.start} AND l.starts_at < ${m.end}
    GROUP BY sb.branch_id`;
}

// Ирцийн хувь = ирсэн (Ирсэн, Нөхөлт, Үнэгүй давтлага) / нийт ирцийн мөр.
export function attendanceCounts(tx: Tx, m: MonthRange) {
  return tx.$queryRaw<{ branchId: string | null; total: number; attended: number }[]>`
    SELECT cl.branch_id AS "branchId",
           COUNT(*)::int AS total,
           (COUNT(*) FILTER (WHERE a.status IN ('PRESENT', 'MAKEUP', 'FREE_REVIEW')))::int AS attended
    FROM attendance a
    JOIN lessons l ON l.id = a.lesson_id
    JOIN classes cl ON cl.id = l.class_id
    WHERE l.starts_at >= ${m.start} AND l.starts_at < ${m.end}
    GROUP BY cl.branch_id`;
}

// Орсон төлбөр: хүчинтэй (ACTIVE) төлбөр, төлсөн огноо тухайн сард.
export function paymentsReceived(tx: Tx, m: MonthRange) {
  return tx.$queryRaw<MoneyRow[]>`
    WITH ${studentBranch}
    SELECT sb.branch_id AS "branchId", COALESCE(SUM(p.amount), 0) AS value
    FROM payments p
    JOIN contracts ct ON ct.id = p.contract_id
    LEFT JOIN student_branch sb ON sb.student_id = ct.student_id
    WHERE p.status = 'ACTIVE'
      AND p.paid_at >= ${m.startDate}::date AND p.paid_at < ${m.endDate}::date
    GROUP BY sb.branch_id`;
}

// Нийт өрийн гэрээг салбарт хуваарилна (өрийн дүнг payments модуль өгнө).
export function branchOfContracts(tx: Tx, contractIds: string[]) {
  if (contractIds.length === 0) return Promise.resolve<{ contractId: string; branchId: string | null }[]>([]);
  return tx.$queryRaw<{ contractId: string; branchId: string | null }[]>`
    WITH ${studentBranch}
    SELECT ct.id AS "contractId", sb.branch_id AS "branchId"
    FROM contracts ct
    LEFT JOIN student_branch sb ON sb.student_id = ct.student_id
    WHERE ct.id = ANY(${contractIds}::uuid[])`;
}

// Цалингийн зардал = олсон цалин (EARNING) + ирц засварын зөрүү (ADJUSTMENT), хичээлийн огноогоор
// (D-28). Олголт (PAYOUT) зардал биш, шилжүүлэг.
export function payrollCost(tx: Tx, m: MonthRange) {
  return tx.$queryRaw<MoneyRow[]>`
    SELECT cl.branch_id AS "branchId", COALESCE(SUM(le.amount), 0) AS value
    FROM ledger_entries le
    LEFT JOIN lessons l ON l.id = le.lesson_id
    LEFT JOIN classes cl ON cl.id = l.class_id
    WHERE le.type IN ('EARNING', 'ADJUSTMENT')
      AND COALESCE(l.starts_at, le.created_at) >= ${m.start}
      AND COALESCE(l.starts_at, le.created_at) < ${m.end}
    GROUP BY cl.branch_id`;
}

// Багц үргэлжлүүлсэн хувь: тухайн сард дууссан (сүүлийн ирэлт нь тэр сард) багцуудаас, дараа нь
// ижил сурагчийн шинэ гэрээ үүссэн нь (D-51).
export function continuation(tx: Tx, m: MonthRange) {
  return tx.$queryRaw<{ branchId: string | null; completed: number; continued: number }[]>`
    WITH ${studentBranch},
    completed AS (
      SELECT ct.id, ct.student_id, ct.created_at, MAX(l.starts_at) AS done_at
      FROM contracts ct
      JOIN attendance a ON a.contract_id = ct.id
      JOIN lessons l ON l.id = a.lesson_id
      WHERE ct.status = 'COMPLETED'
      GROUP BY ct.id
    )
    SELECT sb.branch_id AS "branchId",
           COUNT(*)::int AS completed,
           (COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM contracts n
             WHERE n.student_id = c.student_id AND n.id <> c.id AND n.created_at > c.created_at
           )))::int AS continued
    FROM completed c
    LEFT JOIN student_branch sb ON sb.student_id = c.student_id
    WHERE c.done_at >= ${m.start} AND c.done_at < ${m.end}
    GROUP BY sb.branch_id`;
}

// ---- Аудитын жагсаалт (админ унших)
export function listAudit(
  tx: Tx,
  f: {
    entity?: string;
    action?: string;
    actor?: string;
    from?: Date;
    to?: Date;
    page: number;
    limit: number;
  },
) {
  const where: Prisma.AuditLogWhereInput = {
    ...(f.entity ? { entity: f.entity } : {}),
    ...(f.action ? { action: f.action } : {}),
    ...(f.actor
      ? { actor: { OR: [{ phone: { contains: f.actor } }, { email: { contains: f.actor, mode: "insensitive" } }] } }
      : {}),
    ...(f.from || f.to
      ? { createdAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } }
      : {}),
  };
  return Promise.all([
    tx.auditLog.findMany({
      where,
      include: { actor: { select: { phone: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (f.page - 1) * f.limit,
      take: f.limit,
    }),
    tx.auditLog.count({ where }),
  ]);
}
