import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

// Систем Улаанбаатарын огноог (UTC+8) ашигладаг: шөнийн 00:00-08:00-д UTC огноо өчигдөр байдаг.
function today(): string {
  return new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);
}

async function loginAsTeacher() {
  const phone = phone8();
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role: Role.TEACHER, phone, passwordHash } });
  await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, teacherId: user.id };
}

async function setup() {
  const branch = await prisma.branch.create({
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  const program = await prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
  });
  const teacher = await loginAsTeacher();
  const classIds: string[] = [];
  for (const weekday of [1, 2, 3]) {
    const res = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send({ branchId: branch.id, weekday, startTime: "09:00" });
    classIds.push(res.body.id as string);
  }
  return { branch, program, teacher, classIds };
}

function body(programId: string, classIds: string[], extra: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    parentPhone: phone8(),
    parentFullName: "Эцэг",
    studentFullName: `Сурагч ${randomUUID().slice(0, 6)}`,
    programId,
    classIds,
    fromDate: today(),
    rulesAckAt: now,
    consentAt: now,
    ...extra,
  };
}

describe("Багшаас сурагч бүртгэх, нэг транзакц (шинэ шаардлага 1.4)", () => {
  it("ФШ-12, 16, 17, ФБШ-23: сурагч, эцэг эх, гэрээ, бүртгэл нэг дор үүснэ, зөвшөөрлийн огноо хадгалагдана", async () => {
    const { program, teacher, classIds } = await setup();
    const payload = body(program.id, classIds.slice(0, 2), { placementPercent: 71.5 });

    const res = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(payload);
    expect(res.status).toBe(201);
    expect(res.body.tempPassword).toBeTypeOf("string");
    expect(res.body.remainingHours).toBe(75);
    expect(res.body.leavesLeft).toBe(3);

    const student = await prisma.student.findUniqueOrThrow({
      where: { id: res.body.studentId },
      include: { contracts: { include: { enrollments: true } }, assessments: true },
    });
    expect(student.consentAt).not.toBeNull();
    expect(student.contracts).toHaveLength(1);
    expect(student.contracts[0]?.enrollments).toHaveLength(2);
    expect(student.assessments[0]?.totalPercent.toString()).toBe("71.5");
  });

  it("ФШ-13: бүртгэлтэй эцэг эхийн утсаар дахин бүртгэхэд шинэ данс үүсэхгүй", async () => {
    const { program, teacher, classIds } = await setup();
    const parentPhone = phone8();
    const first = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, classIds.slice(0, 2), { parentPhone }));
    const second = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, classIds.slice(0, 2), { parentPhone, parentFullName: undefined }));
    expect(second.status).toBe(201);
    expect(second.body.parentId).toBe(first.body.parentId);
    expect(second.body.tempPassword).toBeUndefined();
  });

  it("ФШ-20, ФБШ-17: анги дүүрсэн бол бүх бичилт буцна (сурагч, эцэг эх, гэрээ үүсэхгүй)", async () => {
    const { program, teacher, classIds } = await setup();
    const fullClass = classIds[0]!;
    for (let i = 0; i < 6; i++) {
      const student = await prisma.student.create({ data: { fullName: `Суудал ${i}` } });
      const contract = await prisma.contract.create({
        data: {
          studentId: student.id,
          programId: program.id,
          price: "500000.00",
          totalHours: 75,
          remainingHours: 75,
          leavesLeft: 3,
          rulesAckAt: new Date(),
        },
      });
      await prisma.enrollment.create({
        data: { contractId: contract.id, classId: fullClass, fromDate: new Date(today()) },
      });
    }
    const payload = body(program.id, [fullClass, classIds[1]!]);

    const res = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(payload);
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("class-full");

    expect(await prisma.student.count({ where: { fullName: payload.studentFullName } })).toBe(0);
    expect(await prisma.parent.count({ where: { phone: payload.parentPhone } })).toBe(0);
  });

  it("ADR-008, ФБШ-20: багш бусад багшийн ангид сурагч бүртгэхэд 403, юу ч үүсэхгүй", async () => {
    const { program, classIds } = await setup();
    const other = await loginAsTeacher();
    const payload = body(program.id, classIds.slice(0, 2));

    const res = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${other.token}`)
      .send(payload);
    expect(res.status).toBe(403);
    expect(await prisma.student.count({ where: { fullName: payload.studentFullName } })).toBe(0);
  });

  it("ФШ-22: долоо хоногийн хичээл 1 (хүрээнээс бага) бол 409 анхааруулга, баталвал хадгална; 4 ба 5 хил", async () => {
    const { program, teacher, classIds } = await setup();
    const warn = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, [classIds[0]!]));
    expect(warn.status).toBe(409);
    expect(warn.body.type).toContain("weekly-lessons-out-of-range");
    expect(warn.body.min).toBe(2);
    expect(warn.body.max).toBe(4);

    const confirmed = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, [classIds[0]!], { weeklyWarningAcknowledged: true }));
    expect(confirmed.status).toBe(201);

    const ok = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, classIds));
    expect(ok.status).toBe(201);
  });

  it("ФШ-12: зөвшөөрлийн огноо, журмын огноо дутуу бол 422", async () => {
    const { program, teacher, classIds } = await setup();
    const payload = body(program.id, classIds.slice(0, 2));
    const { consentAt: _consent, ...withoutConsent } = payload;
    void _consent;
    const res = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(withoutConsent);
    expect(res.status).toBe(422);
  });

  it("ФШ-18, ФБШ-20: багш өөр багшийн сурагчийн төлөвлөгөөг засахад 403", async () => {
    const { program, teacher, classIds } = await setup();
    const created = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, classIds.slice(0, 2)));
    const other = await loginAsTeacher();

    const denied = await request(app)
      .put(`/api/v1/contracts/${created.body.contractId}/plan`)
      .set("Authorization", `Bearer ${other.token}`)
      .send({ items: [{ position: 1, topic: "Хулгай" }] });
    expect(denied.status).toBe(403);

    const allowed = await request(app)
      .put(`/api/v1/contracts/${created.body.contractId}/plan`)
      .set("Authorization", `Bearer ${teacher.token}`)
      .send({ items: [{ position: 1, topic: "Тоо" }] });
    expect(allowed.status).toBe(200);
  });

  it("ФШ-72, 75: GET /contracts багшид зөвхөн өөрийн гэрээг (зогссоныг ч) харуулна", async () => {
    const { program, teacher, classIds } = await setup();
    const created = await request(app)
      .post("/api/v1/enrollments")
      .set("Authorization", `Bearer ${teacher.token}`)
      .send(body(program.id, classIds.slice(0, 2)));
    const other = await loginAsTeacher();

    const pause = await request(app)
      .post(`/api/v1/contracts/${created.body.contractId}/pause`)
      .set("Authorization", `Bearer ${teacher.token}`)
      .send({ startedOn: today(), reason: "Аялал", holdSeat: false });
    expect(pause.status).toBe(201);

    const mine = await request(app)
      .get("/api/v1/contracts?status=PAUSED")
      .set("Authorization", `Bearer ${teacher.token}`);
    expect(mine.status).toBe(200);
    const ids = (mine.body.items as { id: string }[]).map((c) => c.id);
    expect(ids).toContain(created.body.contractId);
    expect(mine.body.items[0].activePause.holdSeat).toBe(false);

    const theirs = await request(app)
      .get("/api/v1/contracts?status=PAUSED")
      .set("Authorization", `Bearer ${other.token}`);
    expect((theirs.body.items as { id: string }[]).map((c) => c.id)).not.toContain(
      created.body.contractId,
    );
  });

  it("ФШ-15: сул суудалтай ангийг салбар, гарагаар шүүж, багшийн нэр, суудлын тоотой нь буцаана", async () => {
    const { branch, teacher, classIds } = await setup();
    const res = await request(app)
      .get(`/api/v1/classes/available?branchId=${branch.id}&weekday=2`)
      .set("Authorization", `Bearer ${teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(classIds[1]);
    expect(res.body[0].teacherName).toBe("Тест багш");
    expect(res.body[0].branchName).toBe(branch.name);
    expect(res.body[0].availableSeats).toBe(6);
  });
});
