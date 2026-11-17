import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";

const app = createApp();

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

function makeClass(teacherId: string, weekday: number, startTime: string, capacity = 6) {
  return getBranchId().then((b) =>
    prisma.class.create({ data: { teacherId, branchId: b, weekday, startTime, durationMin: 120, capacity } }),
  );
}

async function enroll(classId: string, name: string, paid = false) {
  const program = await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1800000.00" } });
  const student = await prisma.student.create({ data: { fullName: name } });
  const contract = await prisma.contract.create({
    data: { studentId: student.id, programId: program.id, price: "1800000.00", totalHours: 75, remainingHours: 75, leavesLeft: 3, rulesAckAt: new Date() },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId, fromDate: new Date("2026-01-01") } });
  if (paid) {
    const admin = await loginUser(Role.ADMIN);
    await prisma.payment.create({
      data: { contractId: contract.id, amount: "1800000.00", paidAt: new Date(), channel: "CASH", createdBy: admin.userId },
    });
  }
  return { student, contract };
}

const call = (method: "get" | "post" | "delete", token: string, path: string, body?: object) =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`).send(body);

describe("D-69 Долоо хоногийн хуваарь гаригаар", () => {
  it("анги бүр эхлэх-дуусах цаг (24 цаг), бүртгэлтэй/суудлын ачаалалтай; зөвхөн өөрийн анги", async () => {
    const t = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const mon = await makeClass(t.userId, 1, "09:00");
    const wedLate = await makeClass(t.userId, 3, "18:30");
    await makeClass(other.userId, 1, "09:00");
    await enroll(mon.id, "Анхаа");
    await enroll(mon.id, "Бат");

    const res = await call("get", t.token, "/classes/week");
    expect(res.status).toBe(200);
    const list = res.body as { id: string; weekday: number; startTime: string; endTime: string; capacity: number; enrolled: number }[];
    expect(list.map((c) => c.id).sort()).toEqual([mon.id, wedLate.id].sort());
    expect(list.find((c) => c.id === mon.id)).toMatchObject({ weekday: 1, startTime: "09:00", endTime: "11:00", capacity: 6, enrolled: 2 });
    expect(list.find((c) => c.id === wedLate.id)).toMatchObject({ weekday: 3, startTime: "18:30", endTime: "20:30", enrolled: 0 });
  });

  it("ангийн сурагчид төлбөрийн төлөвтэй (дүнгүй); өөр багшийн анги 403, эцэг эх 403", async () => {
    const t = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const cls = await makeClass(t.userId, 2, "10:00");
    await enroll(cls.id, "Төлсөн", true);
    await enroll(cls.id, "Төлөөгүй");

    const res = await call("get", t.token, `/classes/${cls.id}/students`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ weekday: 2, startTime: "10:00", endTime: "12:00", capacity: 6 });
    const flags = new Map((res.body.students as { studentName: string; paymentFlag: string }[]).map((s) => [s.studentName, s.paymentFlag]));
    expect(flags.get("Төлсөн")).toBe("FULL");
    expect(flags.get("Төлөөгүй")).toBe("DEBT");
    expect(JSON.stringify(res.body)).not.toContain("1800000");

    expect((await call("get", other.token, `/classes/${cls.id}/students`)).status).toBe(403);
    const parent = await loginUser(Role.PARENT);
    expect((await call("get", parent.token, `/classes/${cls.id}/students`)).status).toBe(403);
    expect((await call("get", t.token, `/classes/${randomUUID()}/students`)).status).toBe(404);
  });
});

describe("D-69 Анги устгахын өмнө сурагч зөөх", () => {
  const move = (token: string, contractId: string, from: string, to: string) => {
    const tomorrow = new Date(Date.now() + 86_400_000 + 8 * 3_600_000).toISOString().slice(0, 10);
    return call("post", token, `/contracts/${contractId}/transfer`, { fromClassId: from, toClassId: to, effectiveFrom: tomorrow, reason: "Анги устгахаар зөөв" });
  };

  it("багш өөрийн ангиас сурагчаа сул зайтай өөр анги руу зөөж, хоосорсон ангийг устгана", async () => {
    const t = await loginUser(Role.TEACHER);
    const from = await makeClass(t.userId, 1, "09:00");
    const to = await makeClass(t.userId, 4, "15:00");
    const a = await enroll(from.id, "Анхаа");

    // Сурагчтай анги устахгүй.
    expect((await call("delete", t.token, `/classes/${from.id}`)).status).toBe(409);
    expect((await move(t.token, a.contract.id, from.id, to.id)).status).toBe(200);
    expect((await call("get", t.token, `/classes/${from.id}/students`)).body.students).toEqual([]);
    expect((await call("get", t.token, `/classes/${to.id}/students`)).body.students).toHaveLength(1);
    expect((await call("delete", t.token, `/classes/${from.id}`)).status).toBe(204);
  });

  it("дүүрсэн анги руу зөөвөл 409; өөр багшийн ангиас зөөх 403; эцэг эх 403", async () => {
    const t = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const from = await makeClass(t.userId, 1, "09:00");
    const full = await makeClass(t.userId, 2, "09:00", 1);
    await enroll(full.id, "Суудал эзэлсэн");
    const a = await enroll(from.id, "Анхаа");
    const toFull = await move(t.token, a.contract.id, from.id, full.id);
    expect(toFull.status).toBe(409);

    const free = await makeClass(t.userId, 5, "09:00");
    expect((await move(other.token, a.contract.id, from.id, free.id)).status).toBe(403);
    const parent = await loginUser(Role.PARENT);
    expect((await move(parent.token, a.contract.id, from.id, free.id)).status).toBe(403);
    // Алдаатай оролдлогуудын дараа сурагч хуучин ангидаа хэвээр.
    expect((await call("get", t.token, `/classes/${from.id}/students`)).body.students).toHaveLength(1);
  });
});
