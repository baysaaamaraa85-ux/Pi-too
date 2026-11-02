import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { ContractStatus, Role } from "../../generated/prisma/client.js";
import { todayInUlaanbaatar } from "../scheduling/scheduling.service.js";

const app = createApp();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

async function loginUser(role: Role) {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: `Багш ${phone}` } });
    await prisma.teacherRate.create({
      data: { teacherId: user.id, hourlyRate: "5000.00", effectiveFrom: new Date("2026-01-01") },
    });
  }
  if (role === Role.PARENT) await prisma.parent.create({ data: { userId: user.id, fullName: "Эцэг", phone } });
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

let programId: string | null = null;
async function getProgramId() {
  programId ??= (
    await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" } })
  ).id;
  return programId;
}

const makeBranch = () => prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } });
const makeClass = (teacherId: string, branchId: string, weekday: number, capacity = 6) =>
  prisma.class.create({ data: { teacherId, branchId, weekday, startTime: "09:00", durationMin: 120, capacity } });

const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const tomorrowKey = () => dayKey(new Date(todayInUlaanbaatar().getTime() + DAY));

async function makeContract(classId: string, opts: { status?: ContractStatus } = {}) {
  const student = await prisma.student.create({ data: { fullName: `Сурагч ${randomUUID().slice(0, 6)}` } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId: await getProgramId(),
      price: "500000.00",
      totalVisits: 25,
      remainingVisits: 25,
      leavesLeft: 3,
      status: opts.status ?? ContractStatus.ACTIVE,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId, fromDate: new Date("2026-01-01") } });
  return { contract, student };
}

const transfer = (token: string, contractId: string, body: object) =>
  request(app).post(`/api/v1/contracts/${contractId}/transfer`).set("Authorization", `Bearer ${token}`).send(body);

async function world() {
  const admin = await loginUser(Role.ADMIN);
  const oldTeacher = await loginUser(Role.TEACHER);
  const newTeacher = await loginUser(Role.TEACHER);
  const oldBranch = await makeBranch();
  const newBranch = await makeBranch();
  const oldClass = await makeClass(oldTeacher.userId, oldBranch.id, 1);
  const newClass = await makeClass(newTeacher.userId, newBranch.id, 2);
  const { contract, student } = await makeContract(oldClass.id);
  return { admin, oldTeacher, newTeacher, oldBranch, newBranch, oldClass, newClass, contract, student };
}

describe("М12 Салбар, багш шилжилт (ФШ-71)", () => {
  it("ФШ-71: шилжилтийн өмнөх ба дараах үлдэгдэл, чөлөөний эрх, дүнгийн түүх ижил; хуучин багшийн цалингийн түүх өөрчлөгдөхгүй", async () => {
    const w = await world();

    // Хуучин багш өнгөрсөн хичээлийн ирц бүртгэж, цалингийн мөр үүснэ.
    const endsAt = new Date(Date.now() - HOUR);
    const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
    const lesson = await prisma.lesson.create({
      data: { classId: w.oldClass.id, teacherId: w.oldTeacher.userId, startsAt, endsAt, originalStartsAt: startsAt },
    });
    const save = await request(app)
      .put(`/api/v1/lessons/${lesson.id}/attendance`)
      .set("Authorization", `Bearer ${w.oldTeacher.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ entries: [{ contractId: w.contract.id, present: true }] });
    expect(save.status).toBe(200);
    await prisma.assessment.create({
      data: { studentId: w.student.id, contractId: w.contract.id, type: "QUIZ", takenOn: new Date("2026-10-01"), totalPercent: "75.00" },
    });

    const before = await prisma.contract.findUniqueOrThrow({ where: { id: w.contract.id } });
    const ledgerBefore = await prisma.ledgerEntry.findMany({ where: { teacherId: w.oldTeacher.userId }, orderBy: { id: "asc" } });
    const assessmentsBefore = await prisma.assessment.count({ where: { studentId: w.student.id } });
    expect(before.remainingVisits).toBe(24);
    expect(ledgerBefore.length).toBeGreaterThan(0);

    const res = await transfer(w.admin.token, w.contract.id, {
      fromClassId: w.oldClass.id,
      toClassId: w.newClass.id,
      effectiveFrom: tomorrowKey(),
      reason: "Гэр бүл нүүсэн",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ remainingVisits: 24, leavesLeft: 3, fromClassId: w.oldClass.id, toClassId: w.newClass.id });

    const after = await prisma.contract.findUniqueOrThrow({ where: { id: w.contract.id } });
    expect([after.remainingVisits, after.leavesLeft, after.freeReviewsLeft, after.status]).toEqual([
      before.remainingVisits,
      before.leavesLeft,
      before.freeReviewsLeft,
      before.status,
    ]);
    expect(await prisma.assessment.count({ where: { studentId: w.student.id } })).toBe(assessmentsBefore);
    const ledgerAfter = await prisma.ledgerEntry.findMany({ where: { teacherId: w.oldTeacher.userId }, orderBy: { id: "asc" } });
    expect(ledgerAfter).toEqual(ledgerBefore);
    expect(await prisma.ledgerEntry.count({ where: { teacherId: w.newTeacher.userId } })).toBe(0);

    // Бүртгэл: хуучин нь өнөөдрөөр хаагдаж, шинэ нь маргаашаас нээгдсэн.
    const enrollments = await prisma.enrollment.findMany({ where: { contractId: w.contract.id }, orderBy: { fromDate: "asc" } });
    expect(enrollments).toHaveLength(2);
    expect(dayKey(enrollments[0]!.toDate!)).toBe(dayKey(todayInUlaanbaatar()));
    expect(enrollments[1]).toMatchObject({ classId: w.newClass.id, toDate: null });
    expect(dayKey(enrollments[1]!.fromDate)).toBe(tomorrowKey());

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "contract", entityId: w.contract.id, action: "TRANSFER" } });
    expect(audit.reason).toBe("Гэр бүл нүүсэн");
    expect(audit.actorId).toBe(w.admin.userId);
  });

  it("ФШ-71: шилжсэний дараах хичээлийн ирцийн жагсаалтад сурагч шинэ багшийнхад гарч, хуучин анги дээр гарахаа больно", async () => {
    const w = await world();
    const res = await transfer(w.admin.token, w.contract.id, {
      fromClassId: w.oldClass.id,
      toClassId: w.newClass.id,
      effectiveFrom: tomorrowKey(),
      reason: "Багш солих",
    });
    expect(res.status).toBe(200);

    const start = new Date(`${tomorrowKey()}T04:00:00Z`);
    const lessonOf = (classId: string, teacherId: string) =>
      prisma.lesson.create({
        data: { classId, teacherId, startsAt: start, endsAt: new Date(start.getTime() + 2 * HOUR), originalStartsAt: start },
      });
    const oldLesson = await lessonOf(w.oldClass.id, w.oldTeacher.userId);
    const newLesson = await lessonOf(w.newClass.id, w.newTeacher.userId);

    const sheetOf = (token: string, lessonId: string) =>
      request(app).get(`/api/v1/lessons/${lessonId}/attendance`).set("Authorization", `Bearer ${token}`);
    const onNew = await sheetOf(w.newTeacher.token, newLesson.id);
    expect(onNew.status).toBe(200);
    expect((onNew.body.rows as { contractId: string }[]).map((r) => r.contractId)).toContain(w.contract.id);
    const onOld = await sheetOf(w.oldTeacher.token, oldLesson.id);
    expect((onOld.body.rows as { contractId: string }[]).map((r) => r.contractId)).not.toContain(w.contract.id);
  });

  it("ФШ-71, ФШ-20: шинэ анги дүүрсэн (6 суудал) бол 409 ба өөрчлөлт бүрэн буцна", async () => {
    const w = await world();
    const full = await makeClass(w.newTeacher.userId, w.newBranch.id, 3, 1);
    await makeContract(full.id);

    const res = await transfer(w.admin.token, w.contract.id, {
      fromClassId: w.oldClass.id,
      toClassId: full.id,
      effectiveFrom: tomorrowKey(),
      reason: "Дүүрсэн анги",
    });
    expect(res.status).toBe(409);
    const enrollments = await prisma.enrollment.findMany({ where: { contractId: w.contract.id } });
    expect(enrollments).toHaveLength(1);
    expect(enrollments[0]).toMatchObject({ classId: w.oldClass.id, toDate: null });
    expect(await prisma.auditLog.count({ where: { entity: "contract", entityId: w.contract.id, action: "TRANSFER" } })).toBe(0);
  });

  it("ФШ-71: өнгөрсөн огноо, ижил анги, бүртгэлгүй анги, идэвхгүй гэрээ, эрт огноо бүгд 409; шалтгаангүй бол 422", async () => {
    const w = await world();
    const body = (over: object) => ({
      fromClassId: w.oldClass.id,
      toClassId: w.newClass.id,
      effectiveFrom: tomorrowKey(),
      reason: "шалтгаан",
      ...over,
    });

    const yesterday = dayKey(new Date(todayInUlaanbaatar().getTime() - DAY));
    expect((await transfer(w.admin.token, w.contract.id, body({ effectiveFrom: yesterday }))).status).toBe(409);
    expect((await transfer(w.admin.token, w.contract.id, body({ toClassId: w.oldClass.id }))).status).toBe(409);
    expect((await transfer(w.admin.token, w.contract.id, body({ fromClassId: w.newClass.id, toClassId: w.oldClass.id }))).status).toBe(409);
    // Хуучин бүртгэл 2026-01-01-ээс эхэлсэн тул түүнтэй ижил өдрөөс шилжих боломжгүй.
    expect((await transfer(w.admin.token, w.contract.id, body({ effectiveFrom: "2026-01-01" }))).status).toBe(409);
    expect((await transfer(w.admin.token, w.contract.id, body({ reason: "" }))).status).toBe(422);

    await prisma.contract.update({ where: { id: w.contract.id }, data: { status: ContractStatus.COMPLETED } });
    expect((await transfer(w.admin.token, w.contract.id, body({}))).status).toBe(409);
    expect((await transfer(w.admin.token, randomUUID(), body({}))).status).toBe(404);
  });

  it("Эрхийн матриц: багш, эцэг эх шилжилт хийхэд 403; нэвтрээгүй бол 401", async () => {
    const w = await world();
    const parent = await loginUser(Role.PARENT);
    const body = { fromClassId: w.oldClass.id, toClassId: w.newClass.id, effectiveFrom: tomorrowKey(), reason: "х" };
    expect((await transfer(w.oldTeacher.token, w.contract.id, body)).status).toBe(403);
    expect((await transfer(parent.token, w.contract.id, body)).status).toBe(403);
    expect((await request(app).post(`/api/v1/contracts/${w.contract.id}/transfer`).send(body)).status).toBe(401);
    expect(await prisma.enrollment.count({ where: { contractId: w.contract.id } })).toBe(1);
  });
});
