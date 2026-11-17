import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";

const app = createApp();
const HOUR = 3_600_000;

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

async function loginUser(role: Role) {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  if (role === Role.TEACHER) await prisma.teacher.create({ data: { userId: user.id, fullName: `Багш ${phone}` } });
  if (role === Role.PARENT) await prisma.parent.create({ data: { userId: user.id, fullName: "Эцэг", phone } });
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

let branchId: string | null = null;
async function getBranchId() {
  branchId ??= (await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } })).id;
  return branchId;
}

async function makeClass(teacherId: string) {
  return prisma.class.create({
    data: { teacherId, branchId: await getBranchId(), weekday: 1, startTime: "09:00", durationMin: 120, capacity: 6 },
  });
}

// Хичээл endedHoursAgo цагийн өмнө 120 минутын турш дууссан.
async function makeLesson(classId: string, teacherId: string, endedHoursAgo: number) {
  const endsAt = new Date(Date.now() - endedHoursAgo * HOUR);
  const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
  return prisma.lesson.create({ data: { classId, teacherId, startsAt, endsAt, originalStartsAt: startsAt } });
}

async function makeStudent(classId: string, name: string, opts: { parent?: boolean } = {}) {
  const program = await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1800000.00" } });
  const student = await prisma.student.create({ data: { fullName: name } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id, programId: program.id, price: "1800000.00", totalHours: 75, remainingHours: 75, leavesLeft: 3,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId, fromDate: new Date("2026-01-01") } });
  let parent: Awaited<ReturnType<typeof loginUser>> | null = null;
  if (opts.parent) {
    parent = await loginUser(Role.PARENT);
    await prisma.parentStudent.create({ data: { parentId: parent.userId, studentId: student.id } });
  }
  return { student, contract, parent };
}

const get = (token: string, path: string) => request(app).get(`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
const setRate = (token: string, contractId: string, hourlyRate: string) =>
  request(app).put(`/api/v1/contracts/${contractId}/rate`).set("Authorization", `Bearer ${token}`).send({ hourlyRate });
const mark = (token: string, lessonId: string, entries: { contractId: string; present: boolean }[]) =>
  request(app)
    .put(`/api/v1/lessons/${lessonId}/attendance`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ entries });

type Row = {
  contractId: string; studentName: string; academicHoursExpected: string; academicHoursDone: string; payrollHours: string;
  hourlyRate: string | null; discountPercent: string; effectiveRate: string | null; earned: string; paymentFlag: string;
  lastReminderAt: string | null;
};

describe("D-68 Багшийн цалин сурагч бүрээр", () => {
  it("сурагч бүрт: багцын академик цаг 75, орсон академик цаг 3 (120 мин / 40), цалингийн цаг 2.00, цагийн цалин, авах цалин = 2 x цагийн цалин", async () => {
    const t = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const lesson = await makeLesson(cls.id, t.userId, 1);
    const a = await makeStudent(cls.id, "Анхаа");
    const b = await makeStudent(cls.id, "Бат");
    const c = await makeStudent(cls.id, "Цэцэг");
    await setRate(t.token, a.contract.id, "40000.00");
    await setRate(t.token, b.contract.id, "25000.00");
    await mark(t.token, lesson.id, [
      { contractId: a.contract.id, present: true },
      { contractId: b.contract.id, present: true },
      { contractId: c.contract.id, present: true },
    ]);

    const res = await get(t.token, "/payroll/my-students");
    expect(res.status).toBe(200);
    const rows = new Map((res.body.rows as Row[]).map((r) => [r.studentName, r]));
    expect(rows.get("Анхаа")).toMatchObject({
      academicHoursExpected: "75", academicHoursDone: "3.00", payrollHours: "2.00",
      hourlyRate: "40000.00", effectiveRate: "40000.00", earned: "80000.00", discountPercent: "0.00",
    });
    expect(rows.get("Бат")).toMatchObject({ hourlyRate: "25000.00", earned: "50000.00" });
    // Цагийн цалин оруулаагүй хүүхэд: цаг орсон ч цалин 0.
    expect(rows.get("Цэцэг")).toMatchObject({ payrollHours: "2.00", hourlyRate: null, effectiveRate: null, earned: "0.00" });
    expect(res.body.totalEarned).toBe("130000.00");
  });

  it("Чөлөөтэй ирц цалингийн цагт тооцогдохгүй; өөр багшийн хүүхэд жагсаалтад харагдахгүй", async () => {
    const t = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const otherCls = await makeClass(other.userId);
    const lesson = await makeLesson(cls.id, t.userId, 1);
    const present = await makeStudent(cls.id, "Ирсэн");
    const excused = await makeStudent(cls.id, "Чөлөөтэй");
    await makeStudent(otherCls.id, "Бусдын");
    await setRate(t.token, present.contract.id, "40000.00");
    await setRate(t.token, excused.contract.id, "40000.00");
    await mark(t.token, lesson.id, [
      { contractId: present.contract.id, present: true },
      { contractId: excused.contract.id, present: false },
    ]);
    const res = await get(t.token, "/payroll/my-students");
    const rows = res.body.rows as Row[];
    expect(rows.map((r) => r.studentName).sort()).toEqual(["Ирсэн", "Чөлөөтэй"]);
    expect(rows.find((r) => r.studentName === "Чөлөөтэй")).toMatchObject({ payrollHours: "0.00", academicHoursDone: "0.00", earned: "0.00" });
  });

  it("ах дүүгийн хөнгөлөлттэй хүүхэд: хөнгөлсөн цагийн цалин, авах цалин 10% бага", async () => {
    const admin = await loginUser(Role.ADMIN);
    const t = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const lesson = await makeLesson(cls.id, t.userId, 1);
    const a = await makeStudent(cls.id, "Хөнгөлөлттэй");
    await setRate(t.token, a.contract.id, "40000.00");
    await request(app).put(`/api/v1/contracts/${a.contract.id}/discount`).set("Authorization", `Bearer ${admin.token}`).send({ percent: "10.00" });
    await mark(t.token, lesson.id, [{ contractId: a.contract.id, present: true }]);
    const res = await get(t.token, "/payroll/my-students");
    expect((res.body.rows as Row[])[0]).toMatchObject({ discountPercent: "10.00", hourlyRate: "40000.00", effectiveRate: "36000.00", earned: "72000.00" });
  });

  it("төлбөрийн төлөв: төлөөгүй бол DEBT, бүрэн төлсөн бол FULL (дүнгүй, ФШ-51)", async () => {
    const t = await loginUser(Role.TEACHER);
    const admin = await loginUser(Role.ADMIN);
    const cls = await makeClass(t.userId);
    const unpaid = await makeStudent(cls.id, "Төлөөгүй");
    const paid = await makeStudent(cls.id, "Төлсөн");
    await prisma.payment.create({
      data: { contractId: paid.contract.id, amount: "1800000.00", paidAt: new Date(), channel: "CASH", createdBy: admin.userId },
    });
    const res = await get(t.token, "/payroll/my-students");
    const rows = new Map((res.body.rows as Row[]).map((r) => [r.studentName, r]));
    expect(rows.get("Төлөөгүй")?.paymentFlag).toBe("DEBT");
    expect(rows.get("Төлсөн")?.paymentFlag).toBe("FULL");
    expect(JSON.stringify(res.body)).not.toContain("1800000");
    expect(unpaid.contract.id).toBeTruthy();
  });

  it("хугацаагаар шүүнэ: өнгөрсөн сарын хугацаанд цаг 0, өнөөдрийг хамарсан хугацаанд цаг орсон", async () => {
    const t = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const lesson = await makeLesson(cls.id, t.userId, 1);
    const a = await makeStudent(cls.id, "Хугацаа");
    await setRate(t.token, a.contract.id, "40000.00");
    await mark(t.token, lesson.id, [{ contractId: a.contract.id, present: true }]);
    const old = await get(t.token, "/payroll/my-students?from=2020-01-01&to=2020-01-31");
    expect((old.body.rows as Row[])[0]).toMatchObject({ payrollHours: "0.00", earned: "0.00" });
    const year = new Date().getUTCFullYear();
    const now = await get(t.token, `/payroll/my-students?from=${year}-01-01&to=${year}-12-31`);
    expect((now.body.rows as Row[])[0]).toMatchObject({ payrollHours: "2.00", earned: "80000.00" });
  });

  it("зөвхөн багш: админ, эцэг эх 403, нэвтрээгүй 401", async () => {
    const admin = await loginUser(Role.ADMIN);
    const parent = await loginUser(Role.PARENT);
    expect((await get(admin.token, "/payroll/my-students")).status).toBe(403);
    expect((await get(parent.token, "/payroll/my-students")).status).toBe(403);
    expect((await request(app).get("/api/v1/payroll/my-students")).status).toBe(401);
  });
});

describe("D-68 Орсон цаг дээр дарахад: хичээл бүрийн дэлгэрэнгүй", () => {
  it("хичээл бүр: огноо, анги, хугацаа, академик цаг, цалингийн цаг, төлөв, цагийн цалин, дүн; Чөлөөтэй нь 0", async () => {
    const t = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const l1 = await makeLesson(cls.id, t.userId, 20);
    const l2 = await makeLesson(cls.id, t.userId, 2);
    const a = await makeStudent(cls.id, "Дэлгэрэнгүй");
    await setRate(t.token, a.contract.id, "40000.00");
    await mark(t.token, l1.id, [{ contractId: a.contract.id, present: true }]);
    await mark(t.token, l2.id, [{ contractId: a.contract.id, present: false }]);

    const res = await get(t.token, `/payroll/my-students/${a.contract.id}/entries`);
    expect(res.status).toBe(200);
    const entries = res.body as {
      status: string; durationMin: number; academicHours: string; payrollHours: string; counted: boolean; rateUsed: string | null;
      amount: string; classLabel: string; branchName: string; date: string;
    }[];
    expect(entries).toHaveLength(2);
    // Хамгийн сүүлийн хичээл эхэнд (Чөлөөтэй).
    expect(entries[0]).toMatchObject({ status: "EXCUSED", counted: false, payrollHours: "0.00", academicHours: "0.00", amount: "0.00" });
    expect(entries[1]).toMatchObject({
      status: "PRESENT", counted: true, durationMin: 120, academicHours: "3.00", payrollHours: "2.00",
      rateUsed: "40000.00", amount: "80000.00", classLabel: "Даваа 09:00",
    });
    expect(entries[1]!.date).toMatch(/^\d{4}\.\d{2}\.\d{2}$/);
    // Дүнгийн нийлбэр = хүүхдийн жагсаалтын авах цалин.
    const list = await get(t.token, "/payroll/my-students");
    const sum = entries.reduce((s, e) => s + Number(e.amount), 0);
    expect(Number((list.body.rows as Row[])[0]!.earned)).toBe(sum);
  });

  it("BOLA: багш өөр багшийн хүүхдийн дэлгэрэнгүйг харж чадахгүй (403)", async () => {
    const t = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const otherCls = await makeClass(other.userId);
    const theirs = await makeStudent(otherCls.id, "Бусдын");
    expect((await get(t.token, `/payroll/my-students/${theirs.contract.id}/entries`)).status).toBe(403);
    expect((await get(other.token, `/payroll/my-students/${theirs.contract.id}/entries`)).status).toBe(200);
    const admin = await loginUser(Role.ADMIN);
    expect((await get(admin.token, `/payroll/my-students/${theirs.contract.id}/entries`)).status).toBe(403);
    expect((await get(t.token, "/payroll/my-students/not-a-uuid/entries")).status).toBe(422);
  });
});

describe("D-68 Төлөгдөөгүй эцэг эхэд мэдэгдэл, нэхэмжлэл", () => {
  const remind = (token: string, contractId: string) =>
    request(app).post(`/api/v1/contracts/${contractId}/payment-reminder`).set("Authorization", `Bearer ${token}`);

  it("багш өөрийн хүүхдийн төлөгдөөгүй гэрээнд мэдэгдэл илгээхэд эцэг эхэд outbox мөр бичигдэж, сүүлд илгээсэн огноо харагдана", async () => {
    const t = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const a = await makeStudent(cls.id, "Нэхэмжлэл", { parent: true });
    const res = await remind(t.token, a.contract.id);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ contractId: a.contract.id, notified: 1 });

    const outbox = await prisma.notificationOutbox.findMany({ where: { recipientId: a.parent!.userId, template: "payment_reminder" } });
    expect(outbox.length).toBeGreaterThan(0);
    expect(outbox[0]!.payload).toMatchObject({ studentName: "Нэхэмжлэл", balance: "1800000.00" });
    expect(await prisma.auditLog.count({ where: { entity: "contract", entityId: a.contract.id, action: "PAYMENT_REMINDER" } })).toBe(1);

    const list = await get(t.token, "/payroll/my-students");
    expect((list.body.rows as Row[])[0]!.lastReminderAt).not.toBeNull();
  });

  it("өдөрт нэг удаа: хоёр дахь оролдлого 409; төлбөр бүрэн төлөгдсөн бол 409", async () => {
    const t = await loginUser(Role.TEACHER);
    const admin = await loginUser(Role.ADMIN);
    const cls = await makeClass(t.userId);
    const a = await makeStudent(cls.id, "Давхар", { parent: true });
    expect((await remind(t.token, a.contract.id)).status).toBe(200);
    const again = await remind(t.token, a.contract.id);
    expect(again.status).toBe(409);
    expect(again.body.type).toContain("payment-reminder-already-sent");

    const b = await makeStudent(cls.id, "Төлсөн", { parent: true });
    await prisma.payment.create({
      data: { contractId: b.contract.id, amount: "1800000.00", paidAt: new Date(), channel: "CASH", createdBy: admin.userId },
    });
    const paid = await remind(t.token, b.contract.id);
    expect(paid.status).toBe(409);
    expect(paid.body.type).toContain("contract-fully-paid");
  });

  it("эцэг эхийн данс холбогдоогүй бол 409; өөр багшийн хүүхэд 403; эцэг эх 403; нэвтрээгүй 401", async () => {
    const t = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId);
    const noParent = await makeStudent(cls.id, "Эцэг эхгүй");
    const res = await remind(t.token, noParent.contract.id);
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("no-parent-account");
    expect(await prisma.auditLog.count({ where: { entity: "contract", entityId: noParent.contract.id, action: "PAYMENT_REMINDER" } })).toBe(0);

    const mine = await makeStudent(cls.id, "Миний", { parent: true });
    expect((await remind(other.token, mine.contract.id)).status).toBe(403);
    const parent = await loginUser(Role.PARENT);
    expect((await remind(parent.token, mine.contract.id)).status).toBe(403);
    expect((await request(app).post(`/api/v1/contracts/${mine.contract.id}/payment-reminder`)).status).toBe(401);
    expect(await prisma.notificationOutbox.count({ where: { recipientId: mine.parent!.userId, template: "payment_reminder" } })).toBe(0);
  });
});
