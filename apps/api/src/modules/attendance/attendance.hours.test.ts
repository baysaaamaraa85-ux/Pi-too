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
  const user = await prisma.user.create({ data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) } });
  if (role === Role.TEACHER) await prisma.teacher.create({ data: { userId: user.id, fullName: `Багш ${phone}` } });
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

let branchId: string | null = null;
async function getBranchId() {
  branchId ??= (await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } })).id;
  return branchId;
}

const hm = (d: Date) => {
  const local = new Date(d.getTime() + 8 * HOUR);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
};
// "HH:MM" + минут (Улаанбаатарын цаг), өдөр шилжихгүй гэж үзнэ.
const addMin = (time: string, minutes: number) => {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};

// 120 минутын хичээл (төлөвлөсөн 3 академик цаг). Өдөр шилжихээс сэргийлж эхлэх цагийг сонгоно.
async function setup(remainingHours = 75) {
  const teacher = await loginUser(Role.TEACHER);
  const cls = await prisma.class.create({
    data: { teacherId: teacher.userId, branchId: await getBranchId(), weekday: 1, startTime: "09:00", durationMin: 120, capacity: 6 },
  });
  let startsAt = new Date(Date.now() - 4 * HOUR);
  const local = new Date(startsAt.getTime() + 8 * HOUR);
  if (local.getUTCHours() * 60 + local.getUTCMinutes() + 300 > 1439) startsAt = new Date(startsAt.getTime() - 5 * HOUR);
  const lesson = await prisma.lesson.create({
    data: { classId: cls.id, teacherId: teacher.userId, startsAt, endsAt: new Date(startsAt.getTime() + 2 * HOUR), originalStartsAt: startsAt },
  });
  const program = await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1800000.00" } });
  const parent = await loginUser(Role.PARENT);
  const student = await prisma.student.create({ data: { fullName: `Сурагч ${randomUUID().slice(0, 6)}` } });
  await prisma.parent.create({ data: { userId: parent.userId, fullName: "Эцэг", phone: phone8() } });
  await prisma.parentStudent.create({ data: { parentId: parent.userId, studentId: student.id } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id, programId: program.id, price: "1800000.00", totalHours: 75, remainingHours, leavesLeft: 3,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId: cls.id, fromDate: new Date("2026-01-01") } });
  await prisma.contractRate.create({
    data: { contractId: contract.id, teacherId: teacher.userId, hourlyRate: "6000.00", effectiveFrom: new Date("2000-01-01"), createdBy: teacher.userId },
  });
  return { teacher, lesson, contract, parent, from: hm(startsAt) };
}

const put = (token: string, lessonId: string, entries: object[]) =>
  request(app)
    .put(`/api/v1/lessons/${lessonId}/attendance`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ entries });
const patch = (token: string, id: string, body: object) =>
  request(app).patch(`/api/v1/attendance/${id}`).set("Authorization", `Bearer ${token}`).send(body);

async function state(contractId: string, lessonId: string) {
  const c = await prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
  const earned = (await prisma.ledgerEntry.findMany({ where: { lessonId } })).reduce((s, l) => s + l.amount.toNumber(), 0);
  return { remaining: c.remainingHours.toNumber(), status: c.status, earned };
}

describe("D-70 Багц академик цагаар: сурагч төлөвлөснөөс их, бага сууж болно", () => {
  it("төлөвлөсөн цагаар (120 мин): багцаас 3 академик цаг, цалин 6 000 x 2 цаг = 12 000", async () => {
    const f = await setup();
    const res = await put(f.teacher.token, f.lesson.id, [{ contractId: f.contract.id, present: true }]);
    expect(res.status).toBe(200);
    expect(res.body.entries[0]).toMatchObject({ remainingHours: 72, packageHours: 3 });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 72, earned: 12000 });
  });

  it("цаг нэмэгдсэн: 160 мин = 4 академик цаг багцаас хасагдаж, цалин бодит 160 минутаар (6 000 x 2.67 цаг = 16 000)", async () => {
    const f = await setup();
    const res = await put(f.teacher.token, f.lesson.id, [
      { contractId: f.contract.id, present: true, actualFrom: f.from, actualTo: addMin(f.from, 160) },
    ]);
    expect(res.status).toBe(200);
    expect(res.body.entries[0]).toMatchObject({ remainingHours: 71, packageHours: 4 });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 71, earned: 16000 });
    const row = await prisma.attendance.findFirstOrThrow({ where: { lessonId: f.lesson.id } });
    expect(row.packageHours.toNumber()).toBe(4);
    expect(row.actualEndsAt!.getTime() - row.actualStartsAt!.getTime()).toBe(160 * 60_000);
  });

  it("төлөвлөснөөс бага: 80 мин = 2 академик цаг, цалин 6 000 x 80/60 = 8 000", async () => {
    const f = await setup();
    await put(f.teacher.token, f.lesson.id, [
      { contractId: f.contract.id, present: true, actualFrom: f.from, actualTo: addMin(f.from, 80) },
    ]);
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 73, earned: 8000 });
  });

  it("бутархай академик цаг: 170 мин = 4.25, багц 75 - 4.25 = 70.75", async () => {
    const f = await setup();
    const res = await put(f.teacher.token, f.lesson.id, [
      { contractId: f.contract.id, present: true, actualFrom: f.from, actualTo: addMin(f.from, 170) },
    ]);
    expect(res.body.entries[0]).toMatchObject({ remainingHours: 70.75, packageHours: 4.25 });
  });

  it("засвар: цагийг төлөвлөсөн рүү буцаахад багц, цалин тулгагдана; Чөлөөтэй болговол хасагдсан цаг бүтнээр буцна", async () => {
    const f = await setup();
    const saved = await put(f.teacher.token, f.lesson.id, [
      { contractId: f.contract.id, present: true, actualFrom: f.from, actualTo: addMin(f.from, 160) },
    ]);
    const id = saved.body.entries[0].attendanceId as string;
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 71, earned: 16000 });

    // Төлөвлөсөн цаг руу буцаана: 4 -> 3 цаг, цалин 16 000 -> 12 000 (ADJUSTMENT -4 000).
    const reset = await patch(f.teacher.token, id, { present: true, actualFrom: null, actualTo: null });
    expect(reset.status).toBe(200);
    expect(reset.body).toMatchObject({ remainingHours: 72, packageHours: 3 });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 72, earned: 12000 });

    // Цагийг дахин сунгана, дараа нь цагийг өөрчлөхгүй төлвийг л засахад бодит цаг хэвээр.
    await patch(f.teacher.token, id, { present: true, actualFrom: f.from, actualTo: addMin(f.from, 200) });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 70, earned: 20000 });
    const keep = await patch(f.teacher.token, id, { present: true });
    expect(keep.body.packageHours).toBe(5);

    // Ирээгүй (Чөлөөтэй) болговол багц бүтнээрээ буцна (75), цалин 0.
    const excused = await patch(f.teacher.token, id, { present: false });
    expect(excused.body).toMatchObject({ status: "EXCUSED", remainingHours: 75, packageHours: 0 });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 75, earned: 0 });
    const row = await prisma.attendance.findUniqueOrThrow({ where: { id } });
    expect(row.actualStartsAt).toBeNull();
  });

  it("үлдэгдлээс их цаг орвол багц 0 болж дуусна (сөрөг болохгүй), цалин бүтэн орсон цагаар; гэрээ Дууссан", async () => {
    const f = await setup(2);
    const res = await put(f.teacher.token, f.lesson.id, [{ contractId: f.contract.id, present: true }]);
    expect(res.status).toBe(200);
    expect(res.body.entries[0]).toMatchObject({ remainingHours: 0, packageHours: 2 });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 0, status: "COMPLETED", earned: 12000 });
    // Засвараар Чөлөөтэй болговол яг хасагдсан 2 цаг буцаж, гэрээ дахин идэвхтэй.
    const id = res.body.entries[0].attendanceId as string;
    await patch(f.teacher.token, id, { present: false });
    expect(await state(f.contract.id, f.lesson.id)).toMatchObject({ remaining: 2, status: "ACTIVE" });
  });

  it("ФШ-36: багцын үлдэгдэл 9 цагаас доош орвол эцэг эхэд нэг мэдэгдэл (10 - 3 = 7)", async () => {
    const f = await setup(10);
    await put(f.teacher.token, f.lesson.id, [{ contractId: f.contract.id, present: true }]);
    const mails = await prisma.notificationOutbox.findMany({ where: { recipientId: f.parent.userId, template: "package_ending" } });
    expect(mails.length).toBeGreaterThan(0);
    expect(mails[0]!.payload).toMatchObject({ remainingHours: 7 });
    const att = await prisma.notificationOutbox.findFirst({ where: { recipientId: f.parent.userId, template: "attendance_recorded" } });
    expect(att?.payload).toMatchObject({ remainingHours: 7 });
  });

  it("буруу цаг: дуусах нь эхлэхээс өмнө 422, нэг нь л өгвөл 422, формат буруу 422, ирээгүй сурагчид цаг 422", async () => {
    const f = await setup();
    const to = (entry: object) => put(f.teacher.token, f.lesson.id, [{ contractId: f.contract.id, ...entry }]);
    expect((await to({ present: true, actualFrom: "12:00", actualTo: "11:00" })).status).toBe(422);
    expect((await to({ present: true, actualFrom: "12:00", actualTo: "12:00" })).status).toBe(422);
    expect((await to({ present: true, actualFrom: "12:00" })).status).toBe(422);
    expect((await to({ present: true, actualFrom: "12:00", actualTo: "7pm" })).status).toBe(422);
    expect((await to({ present: true, actualFrom: "24:00", actualTo: "25:00" })).status).toBe(422);
    expect((await to({ present: false, actualFrom: "10:00", actualTo: "12:00" })).status).toBe(422);
    // Бүх алдаатай оролдлогын дараа юу ч бүртгэгдээгүй.
    expect(await prisma.attendance.count({ where: { lessonId: f.lesson.id } })).toBe(0);
    expect((await state(f.contract.id, f.lesson.id)).remaining).toBe(75);
  });

  it("ирцийн дэлгэц: багц цагаар (75), бодит цаг, багцаас хасагдсан цаг харагдана", async () => {
    const f = await setup();
    await put(f.teacher.token, f.lesson.id, [
      { contractId: f.contract.id, present: true, actualFrom: f.from, actualTo: addMin(f.from, 160) },
    ]);
    const sheet = await request(app).get(`/api/v1/lessons/${f.lesson.id}/attendance`).set("Authorization", `Bearer ${f.teacher.token}`);
    expect(sheet.status).toBe(200);
    expect(sheet.body.rows[0]).toMatchObject({
      remainingHours: 71, totalHours: 75, actualFrom: f.from, actualTo: addMin(f.from, 160), packageHours: 4, status: "PRESENT",
    });
  });

  it("багшийн цалин: орсон цаг бодит минутаар (160 мин = 2.67 цалингийн цаг, 4 академик цаг)", async () => {
    const f = await setup();
    await put(f.teacher.token, f.lesson.id, [
      { contractId: f.contract.id, present: true, actualFrom: f.from, actualTo: addMin(f.from, 160) },
    ]);
    const res = await request(app).get("/api/v1/payroll/my-students").set("Authorization", `Bearer ${f.teacher.token}`);
    expect(res.body.rows[0]).toMatchObject({ academicHoursExpected: "75", academicHoursDone: "4.00", payrollHours: "2.67", earned: "16000.00" });
    const entries = await request(app)
      .get(`/api/v1/payroll/my-students/${f.contract.id}/entries`)
      .set("Authorization", `Bearer ${f.teacher.token}`);
    expect(entries.body[0]).toMatchObject({ durationMin: 160, academicHours: "4.00", payrollHours: "2.67", amount: "16000.00" });
  });
});
