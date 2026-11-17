import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { AttendanceStatus, Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { effectsOf } from "../attendance/attendance.rules.js";
import { PAYROLL_COUNTED_STATUSES, applyDiscount } from "./payroll.service.js";
import { Prisma } from "../../generated/prisma/client.js";

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
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

let branchId: string | null = null;
async function getBranchId() {
  branchId ??= (await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } })).id;
  return branchId;
}

async function makeProgram(protocol: string | null = null) {
  return prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1800000.00", protocolHourlyRate: protocol },
  });
}

// Нэг багш, нэг анги, дууссан 2 цагийн хичээл (24 цагийн засах хугацаанд).
async function setup() {
  const teacher = await loginUser(Role.TEACHER);
  const cls = await prisma.class.create({
    data: { teacherId: teacher.userId, branchId: await getBranchId(), weekday: 1, startTime: "09:00", durationMin: 120, capacity: 6 },
  });
  const endsAt = new Date(Date.now() - HOUR);
  const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
  const lesson = await prisma.lesson.create({
    data: { classId: cls.id, teacherId: teacher.userId, startsAt, endsAt, originalStartsAt: startsAt },
  });
  return { teacher, cls, lesson };
}

async function enroll(classId: string, programId: string, name = `Сурагч ${randomUUID().slice(0, 6)}`) {
  const student = await prisma.student.create({ data: { fullName: name } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId,
      price: "1800000.00",
      totalHours: 75,
      remainingHours: 75,
      leavesLeft: 3,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId, fromDate: new Date("2026-01-01") } });
  return { student, contract };
}

const putRate = (token: string, contractId: string, body: object) =>
  request(app).put(`/api/v1/contracts/${contractId}/rate`).set("Authorization", `Bearer ${token}`).send(body);

const putDiscount = (token: string, contractId: string, percent: string) =>
  request(app).put(`/api/v1/contracts/${contractId}/discount`).set("Authorization", `Bearer ${token}`).send({ percent });

const markPresent = (token: string, lessonId: string, contractIds: string[]) =>
  request(app)
    .put(`/api/v1/lessons/${lessonId}/attendance`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", randomUUID())
    .send({ entries: contractIds.map((contractId) => ({ contractId, present: true })) });

async function earnedFor(lessonId: string) {
  const rows = await prisma.ledgerEntry.findMany({ where: { lessonId } });
  return rows.reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0)).toNumber();
}

describe("D-67 Цагийн үнэлгээ хүүхэд тус бүрт", () => {
  it("ФШ-54: цалинд тооцогдох төлөв нь ирцийн дүрмийн effectsOf().counted-тай ижил (PRESENT, OVER_LIMIT, MAKEUP)", () => {
    for (const status of Object.values(AttendanceStatus)) {
      expect(PAYROLL_COUNTED_STATUSES.includes(status), status).toBe(effectsOf(status).counted);
    }
  });

  it("ФШ-53: хөнгөлөлт 10%: 5 000 -> 4 500, 0% үед өөрчлөгдөхгүй, 100% үед 0, дугуйлалт 2 орноор", () => {
    const d = (rate: string, pct: string) => applyDiscount(new Prisma.Decimal(rate), new Prisma.Decimal(pct)).toFixed(2);
    expect(d("5000.00", "10.00")).toBe("4500.00");
    expect(d("5000.00", "0.00")).toBe("5000.00");
    expect(d("5000.00", "100.00")).toBe("0.00");
    expect(d("3333.33", "10.00")).toBe("3000.00");
  });

  it("багш өөрийн ангийн хүүхдэд үнэлгээ оруулж, аудитад бичигдэнэ; дахин оруулахад шинэчлэгдэнэ", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    const first = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ hourlyRate: "40000.00", adjusted: 0 });
    const second = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "45000.00" });
    expect(second.status).toBe(200);
    const rows = await prisma.contractRate.findMany({ where: { contractId: c.contract.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hourlyRate.toFixed(2)).toBe("45000.00");
    expect(await prisma.auditLog.count({ where: { entity: "contract_rate", entityId: rows[0]!.id } })).toBe(2);
  });

  it("BOLA: багш өөр багшийн хүүхдэд үнэлгээ оруулж чадахгүй (403), админ, эцэг эх, нэвтрээгүй хүн ч үгүй", async () => {
    const mine = await setup();
    const other = await setup();
    const c = await enroll(other.cls.id, (await makeProgram()).id);
    expect((await putRate(mine.teacher.token, c.contract.id, { hourlyRate: "40000.00" })).status).toBe(403);
    const admin = await loginUser(Role.ADMIN);
    expect((await putRate(admin.token, c.contract.id, { hourlyRate: "40000.00" })).status).toBe(403);
    const parent = await loginUser(Role.PARENT);
    expect((await putRate(parent.token, c.contract.id, { hourlyRate: "40000.00" })).status).toBe(403);
    const anon = await request(app).put(`/api/v1/contracts/${c.contract.id}/rate`).send({ hourlyRate: "40000.00" });
    expect(anon.status).toBe(401);
    expect(await prisma.contractRate.count({ where: { contractId: c.contract.id } })).toBe(0);
  });

  it("буруу хэлбэр: мөнгө '40000' (аравтын бутархайгүй) эсвэл сөрөг тоо 422", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    expect((await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000" })).status).toBe(422);
    expect((await putRate(s.teacher.token, c.contract.id, { hourlyRate: "-5.00" })).status).toBe(422);
  });

  it("ФШ-53: цалин = хүүхдийн үнэлгээ x 2 цаг. 40 000 x 2 = 80 000", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    expect((await markPresent(s.teacher.token, s.lesson.id, [c.contract.id])).status).toBe(200);
    expect(await earnedFor(s.lesson.id)).toBe(80000);
  });

  it("үнэлгээгүй байхад ирц бүртгэгдэж 0 ₮, дараа нь цалин оруулахад нөхөн бодогдож ADJUSTMENT нэмэгдэнэ (EARNING засагдахгүй)", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    expect((await markPresent(s.teacher.token, s.lesson.id, [c.contract.id])).status).toBe(200);
    expect(await earnedFor(s.lesson.id)).toBe(0);

    const res = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    expect(res.status).toBe(200);
    expect(res.body.adjusted).toBe(1);
    expect(await earnedFor(s.lesson.id)).toBe(80000);
    const rows = await prisma.ledgerEntry.findMany({ where: { lessonId: s.lesson.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.type)).toEqual(["EARNING", "ADJUSTMENT"]);
    expect(rows[0]!.amount.toFixed(2)).toBe("0.00");
    expect(rows[1]!.rateUsed?.toFixed(2)).toBe("40000.00");

    // Ижил цалинг дахин оруулахад зөрүү 0: мөр нэмэгдэхгүй.
    const again = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    expect(again.body.adjusted).toBe(0);
    expect(await earnedFor(s.lesson.id)).toBe(80000);
  });

  it("D-68: цагийн цалинг хэзээ ч засна, засвар өмнө тооцогдсон хичээлд ч үйлчилнэ: 40 000 -> 50 000, 80 000 -> 100 000", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    await markPresent(s.teacher.token, s.lesson.id, [c.contract.id]);
    expect(await earnedFor(s.lesson.id)).toBe(80000);

    const up = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "50000.00" });
    expect(up.body.adjusted).toBe(1);
    expect(await earnedFor(s.lesson.id)).toBe(100000);
    const rows = await prisma.ledgerEntry.findMany({ where: { lessonId: s.lesson.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.type, r.amount.toNumber()])).toEqual([
      ["EARNING", 80000],
      ["ADJUSTMENT", 20000],
    ]);

    const down = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "30000.00" });
    expect(down.body.adjusted).toBe(1);
    expect(await earnedFor(s.lesson.id)).toBe(60000);
    // Түүхэн мөр үлдэхгүй, нэг утга; өөрчлөлт бүр аудитад.
    expect(await prisma.contractRate.count({ where: { contractId: c.contract.id } })).toBe(1);
  });

  it("нөхөн бодолт цалинд тооцогддоггүй төлвийн (Чөлөөтэй) мөрийг хөнддөггүй", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    const att = await prisma.attendance.create({
      data: { lessonId: s.lesson.id, contractId: c.contract.id, marked: true, status: "EXCUSED", updatedBy: s.teacher.userId },
    });
    await prisma.ledgerEntry.create({
      data: {
        teacherId: s.teacher.userId, type: "EARNING", amount: "0.00", lessonId: s.lesson.id, attendanceId: att.id,
        createdBy: s.teacher.userId,
      },
    });
    const res = await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    expect(res.body.adjusted).toBe(0);
    expect(await earnedFor(s.lesson.id)).toBe(0);
  });
});

describe("D-67 Ах дүүгийн хөнгөлөлт", () => {
  it("админ хөнгөлөлт тавихад төлөх үнэ буурч, хуучин үнэ хадгалагдана; 0.00 болговол сэргэнэ; аудитад бичигдэнэ", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);

    const res = await putDiscount(admin.token, c.contract.id, "10.00");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ discountPercent: "10.00", listPrice: "1800000.00", price: "1620000.00" });
    const row = await prisma.contract.findUniqueOrThrow({ where: { id: c.contract.id } });
    expect(row.price.toFixed(2)).toBe("1620000.00");

    // 20% болгоход хөнгөлөлт давхардахгүй: үргэлж анхны үнэнээс тооцно.
    const second = await putDiscount(admin.token, c.contract.id, "20.00");
    expect(second.body.price).toBe("1440000.00");

    const reset = await putDiscount(admin.token, c.contract.id, "0.00");
    expect(reset.body.price).toBe("1800000.00");
    expect(await prisma.auditLog.count({ where: { entity: "contract", entityId: c.contract.id, action: "SET_SIBLING_DISCOUNT" } })).toBe(3);
  });

  it("хөнгөлөлтийг зөвхөн админ тавина (багш, эцэг эх 403); 100-аас их хувь, буруу хэлбэр 422; DB-ийн CHECK 0-100", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    expect((await putDiscount(s.teacher.token, c.contract.id, "10.00")).status).toBe(403);
    const parent = await loginUser(Role.PARENT);
    expect((await putDiscount(parent.token, c.contract.id, "10.00")).status).toBe(403);
    expect((await putDiscount(admin.token, c.contract.id, "100.01")).status).toBe(422);
    expect((await putDiscount(admin.token, c.contract.id, "10")).status).toBe(422);
    expect((await putDiscount(admin.token, c.contract.id, "100.00")).body.price).toBe("0.00");
    await expect(
      prisma.contract.update({ where: { id: c.contract.id }, data: { siblingDiscountPercent: "120.00" } }),
    ).rejects.toThrow();
  });

  it("ФШ-53: 10% хөнгөлөлттэй хүүхдийн цалин ижил хувиар буурна: 40 000 -> 36 000, x 2 цаг = 72 000; үнэлгээний rate_used 36 000", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    await putDiscount(admin.token, c.contract.id, "10.00");
    expect((await markPresent(s.teacher.token, s.lesson.id, [c.contract.id])).status).toBe(200);
    expect(await earnedFor(s.lesson.id)).toBe(72000);
    const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { lessonId: s.lesson.id } });
    expect(entry.rateUsed?.toFixed(2)).toBe("36000.00");
  });

  it("D-68: хөнгөлөлт дараа тавигдахад өмнө тооцогдсон цалин ч тулгагдана (ADJUSTMENT), анхны EARNING засагдахгүй", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram()).id);
    await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    await markPresent(s.teacher.token, s.lesson.id, [c.contract.id]);
    expect(await earnedFor(s.lesson.id)).toBe(80000);
    await putDiscount(admin.token, c.contract.id, "50.00");
    expect(await earnedFor(s.lesson.id)).toBe(40000);
    const rows = await prisma.ledgerEntry.findMany({ where: { lessonId: s.lesson.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => [r.type, r.amount.toNumber()])).toEqual([
      ["EARNING", 80000],
      ["ADJUSTMENT", -40000],
    ]);
    // Хөнгөлөлтийг 0 болговол цалин сэргэнэ.
    await putDiscount(admin.token, c.contract.id, "0.00");
    expect(await earnedFor(s.lesson.id)).toBe(80000);
  });

  it("хөнгөлөлт зөвхөн тухайн хүүхдийн цалинд: нэг ангийн хоёр хүүхдийн нэг нь 10% хөнгөлөлттэй, нөгөө нь үгүй", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const program = await makeProgram();
    const a = await enroll(s.cls.id, program.id);
    const b = await enroll(s.cls.id, program.id);
    for (const c of [a, b]) await putRate(s.teacher.token, c.contract.id, { hourlyRate: "40000.00" });
    await putDiscount(admin.token, b.contract.id, "10.00");
    await markPresent(s.teacher.token, s.lesson.id, [a.contract.id, b.contract.id]);
    expect(await earnedFor(s.lesson.id)).toBe(80000 + 72000);
  });
});

describe("D-67 Захирлын протокол ба тулгалт", () => {
  it("протоколын үнэлгээг зөвхөн админ тавина; багш үүнийг /payroll/rate-protocol-оор харахгүй (403)", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    const denied = await request(app).get("/api/v1/payroll/rate-protocol").set("Authorization", `Bearer ${teacher.token}`);
    expect(denied.status).toBe(403);
    const ok = await request(app).get("/api/v1/payroll/rate-protocol").set("Authorization", `Bearer ${admin.token}`);
    expect(ok.status).toBe(200);
    expect(Array.isArray(ok.body.programs)).toBe(true);
  });

  it("тулгалт: таарсан, зөрсөн, оруулаагүй, протоколгүй дөрвөн төлөв; хөнгөлөлтийн хувь харагдана", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const withProtocol = await makeProgram("40000.00");
    const noProtocol = await makeProgram(null);
    const match = await enroll(s.cls.id, withProtocol.id, "Таарсан");
    const diff = await enroll(s.cls.id, withProtocol.id, "Зөрсөн");
    const missing = await enroll(s.cls.id, withProtocol.id, "Оруулаагүй");
    const none = await enroll(s.cls.id, noProtocol.id, "Протоколгүй");
    await putRate(s.teacher.token, match.contract.id, { hourlyRate: "40000.00" });
    await putRate(s.teacher.token, diff.contract.id, { hourlyRate: "35000.00" });
    await putDiscount(admin.token, match.contract.id, "10.00");

    const res = await request(app)
      .get(`/api/v1/payroll/rate-protocol?teacherId=${s.teacher.userId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const byName = new Map((res.body.rows as { studentName: string }[]).map((r) => [r.studentName, r]));
    expect(byName.get("Таарсан")).toMatchObject({ status: "MATCH", enteredRate: "40000.00", protocolRate: "40000.00", discountPercent: "10.00" });
    expect(byName.get("Зөрсөн")).toMatchObject({ status: "DIFFERENT", enteredRate: "35000.00", protocolRate: "40000.00" });
    expect(byName.get("Оруулаагүй")).toMatchObject({ status: "MISSING", enteredRate: null, protocolRate: "40000.00" });
    expect(byName.get("Протоколгүй")).toMatchObject({ status: "NO_PROTOCOL", protocolRate: null });
    expect(match.contract.id && none.contract.id && missing.contract.id).toBeTruthy();

    const onlyDiff = await request(app)
      .get(`/api/v1/payroll/rate-protocol?teacherId=${s.teacher.userId}&status=DIFFERENT`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(onlyDiff.body.rows).toHaveLength(1);
    const byProgram = await request(app)
      .get(`/api/v1/payroll/rate-protocol?teacherId=${s.teacher.userId}&programId=${noProtocol.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(byProgram.body.rows).toHaveLength(1);
  });

  it("протокол цалинд нөлөөлөхгүй: багшийн оруулсан үнэлгээ протоколоос өөр ч цалин багшийн үнэлгээгээр бодогдоно", async () => {
    const s = await setup();
    const c = await enroll(s.cls.id, (await makeProgram("40000.00")).id);
    await putRate(s.teacher.token, c.contract.id, { hourlyRate: "35000.00" });
    await markPresent(s.teacher.token, s.lesson.id, [c.contract.id]);
    expect(await earnedFor(s.lesson.id)).toBe(70000);
  });
});

describe("D-67 Багшийн өөрийн үнэлгээний жагсаалт ба сануулга", () => {
  it("багш өөрийн сурагчдыг үнэлгээ, хөнгөлөлттэй нь харна; протоколыг харахгүй; өөр багшийн сурагч харагдахгүй", async () => {
    const admin = await loginUser(Role.ADMIN);
    const s = await setup();
    const other = await setup();
    const program = await makeProgram("40000.00");
    const rated = await enroll(s.cls.id, program.id, "Үнэлгээтэй");
    const unrated = await enroll(s.cls.id, program.id, "Үнэлгээгүй");
    await enroll(other.cls.id, program.id, "Бусдын");
    await putRate(s.teacher.token, rated.contract.id, { hourlyRate: "40000.00" });
    await putDiscount(admin.token, rated.contract.id, "10.00");

    const res = await request(app).get("/api/v1/payroll/my-rates").set("Authorization", `Bearer ${s.teacher.token}`);
    expect(res.status).toBe(200);
    const list = res.body as { studentName: string; hourlyRate: string | null; discountPercent: string; effectiveRate: string | null }[];
    expect(list.map((r) => r.studentName).sort()).toEqual(["Үнэлгээгүй", "Үнэлгээтэй"]);
    expect(list.find((r) => r.studentName === "Үнэлгээтэй")).toMatchObject({ hourlyRate: "40000.00", discountPercent: "10.00", effectiveRate: "36000.00" });
    expect(list.find((r) => r.studentName === "Үнэлгээгүй")).toMatchObject({ hourlyRate: null, effectiveRate: null });
    expect(JSON.stringify(res.body)).not.toContain("protocol");
    expect(unrated.contract.id).toBeTruthy();

    const dash = await request(app).get("/api/v1/dashboard").set("Authorization", `Bearer ${s.teacher.token}`);
    expect(dash.status).toBe(200);
    expect((dash.body.unratedStudents as { studentName: string }[]).map((u) => u.studentName)).toEqual(["Үнэлгээгүй"]);

    const adminDenied = await request(app).get("/api/v1/payroll/my-rates").set("Authorization", `Bearer ${admin.token}`);
    expect(adminDenied.status).toBe(403);
  });
});
