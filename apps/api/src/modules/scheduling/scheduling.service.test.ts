import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

async function loginAsTeacher() {
  const phone = `s${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role: Role.TEACHER, phone, passwordHash } });
  await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, teacherId: user.id as string };
}

async function createBranch() {
  const branch = await prisma.branch.create({
    data: { name: `Тест салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  return branch.id;
}

describe("М4 Хуваарь ба анги (суурь)", () => {
  it("ФШ-19: багш анги үүсгэнэ, 120 минут (3 цаг × 40 мин) үргэлжилнэ", async () => {
    const { token } = await loginAsTeacher();
    const branchId = await createBranch();

    const res = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, weekday: 2, startTime: "10:00" });

    expect(res.status).toBe(201);
    expect(res.body.durationMin).toBe(120);
    expect(res.body.capacity).toBe(6);
  });

  it("ФШ-25: нэг багшийн давхцсан цагтай анги хадгалагдахгүй (409)", async () => {
    const { token } = await loginAsTeacher();
    const branchId = await createBranch();

    const first = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, weekday: 3, startTime: "14:00" });
    expect(first.status).toBe(201);

    const overlapping = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, weekday: 3, startTime: "15:00" }); // 14:00-16:00 ба 15:00-17:00 давхцана
    expect(overlapping.status).toBe(409);
    expect(overlapping.body.type).toContain("class-time-conflict");

    const nonOverlapping = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, weekday: 3, startTime: "17:00" });
    expect(nonOverlapping.status).toBe(201);
  });

  it("ФШ-20: 6 сурагчтай ангид 7 дахийг нэмэхэд 409", async () => {
    const { token, teacherId } = await loginAsTeacher();
    const branchId = await createBranch();
    const classRes = await request(app)
      .post("/api/v1/classes")
      .set("Authorization", `Bearer ${token}`)
      .send({ branchId, weekday: 4, startTime: "09:00" });
    const classId = classRes.body.id as string;
    void teacherId;

    const program = await prisma.program.create({
      data: { name: `П ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
    });

    async function newContract() {
      const student = await prisma.student.create({ data: { fullName: "Сурагч" } });
      return prisma.contract.create({
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
    }

    for (let i = 0; i < 6; i++) {
      const contract = await newContract();
      const res = await request(app)
        .post(`/api/v1/classes/${classId}/enrollments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ contractId: contract.id, fromDate: "2026-11-02" });
      expect(res.status).toBe(201);
    }

    const seventhContract = await newContract();
    const res = await request(app)
      .post(`/api/v1/classes/${classId}/enrollments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ contractId: seventhContract.id, fromDate: "2026-11-02" });
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("class-full");
  });
});
