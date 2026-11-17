import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

function isoDaysFromNow(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

async function loginAsTeacher() {
  const phone = `e${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role: Role.TEACHER, phone, passwordHash } });
  await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, teacherId: user.id as string };
}

async function createBranchAndProgram() {
  const branch = await prisma.branch.create({
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  const program = await prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
  });
  return { branchId: branch.id, programId: program.id };
}

async function createClassAs(token: string, branchId: string, weekday: number, startTime: string) {
  const res = await request(app)
    .post("/api/v1/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ branchId, weekday, startTime });
  return res.body.id as string;
}

describe("М3 Элсэлт ба гэрээ", () => {
  it("ФШ-12, 13: шинэ сурагч бүртгэхэд эцэг эхийн шинэ данс үүснэ, ижил утастайг дахин ашиглана", async () => {
    const { token } = await loginAsTeacher();
    const parentPhone = `p${randomUUID().replace(/-/g, "").slice(0, 10)}`;

    const firstRes = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ parentPhone, parentFullName: "Эцэг эх 1", studentFullName: "Хүүхэд 1" });
    expect(firstRes.status).toBe(201);
    expect(firstRes.body.tempPassword).toBeTypeOf("string");
    const parentId = firstRes.body.parentId as string;

    const secondRes = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${token}`)
      .send({ parentPhone, studentFullName: "Хүүхэд 2 (ах дүү)" });
    expect(secondRes.status).toBe(201);
    expect(secondRes.body.parentId).toBe(parentId);
    expect(secondRes.body.tempPassword).toBeUndefined();
  });

  it("ФШ-16, 17, D-70: гэрээ үүсэхэд багц 75 академик цаг, 3 чөлөө settings-ээс", async () => {
    const { programId } = await createBranchAndProgram();
    const student = await prisma.student.create({ data: { fullName: "Сурагч" } });

    const res = await request(app)
      .post("/api/v1/contracts")
      .set("Authorization", `Bearer ${(await loginAsTeacher()).token}`)
      .send({ studentId: student.id, programId, rulesAckAt: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(Number(res.body.remainingHours)).toBe(75);
    expect(Number(res.body.totalHours)).toBe(75);
    expect(res.body.leavesLeft).toBe(3);
    expect(res.body.price).toBe("500000");
  });

  it("ФШ-72: давхар идэвхтэй зогсолт хориглогдоно (409)", async () => {
    const { token, teacherId } = await loginAsTeacher();
    const { branchId, programId } = await createBranchAndProgram();
    const classId = await createClassAs(token, branchId, 1, "09:00");

    const student = await prisma.student.create({ data: { fullName: "Сурагч" } });
    const contract = await prisma.contract.create({
      data: {
        studentId: student.id,
        programId,
        price: "500000.00",
        totalHours: 75,
        remainingHours: 75,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId, fromDate: new Date(isoDaysFromNow(0)) },
    });
    void teacherId;

    const firstPause = await request(app)
      .post(`/api/v1/contracts/${contract.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startedOn: isoDaysFromNow(3), reason: "Өвчтэй", holdSeat: true });
    expect(firstPause.status).toBe(201);

    const secondPause = await request(app)
      .post(`/api/v1/contracts/${contract.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startedOn: isoDaysFromNow(4), reason: "Дахин", holdSeat: true });
    expect(secondPause.status).toBe(409);
    expect(secondPause.body.type).toContain("contract-not-active");
  });

  it("ФШ-75: суудал хадгалаагүй үргэлжлүүлэхэд анги сонгохгүй бол 409", async () => {
    const { token } = await loginAsTeacher();
    const { branchId, programId } = await createBranchAndProgram();
    const classId = await createClassAs(token, branchId, 5, "11:00");

    const student = await prisma.student.create({ data: { fullName: "Сурагч" } });
    const contract = await prisma.contract.create({
      data: {
        studentId: student.id,
        programId,
        price: "500000.00",
        totalHours: 75,
        remainingHours: 75,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId, fromDate: new Date(isoDaysFromNow(0)) },
    });

    const pauseRes = await request(app)
      .post(`/api/v1/contracts/${contract.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startedOn: isoDaysFromNow(3), reason: "Шилжсэн", holdSeat: false });
    expect(pauseRes.status).toBe(201);

    const resumeWithoutClass = await request(app)
      .post(`/api/v1/contracts/${contract.id}/resume`)
      .set("Authorization", `Bearer ${token}`)
      .send({ resumedOn: isoDaysFromNow(10) });
    expect(resumeWithoutClass.status).toBe(409);
    expect(resumeWithoutClass.body.type).toContain("class-required-to-resume");

    const resumeWithClass = await request(app)
      .post(`/api/v1/contracts/${contract.id}/resume`)
      .set("Authorization", `Bearer ${token}`)
      .send({ resumedOn: isoDaysFromNow(10), classIds: [classId] });
    expect(resumeWithClass.status).toBe(200);
    expect(resumeWithClass.body.status).toBe("ACTIVE");
  });
});
