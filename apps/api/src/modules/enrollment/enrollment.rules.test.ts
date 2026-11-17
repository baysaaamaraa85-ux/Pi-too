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
  const phone = `r${randomUUID().replace(/-/g, "").slice(0, 10)}`;
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
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  return branch.id;
}

async function createProgram() {
  const program = await prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
  });
  return program.id;
}

async function createContractFor(programId: string, studentName = "Сурагч") {
  const student = await prisma.student.create({ data: { fullName: studentName } });
  return prisma.contract.create({
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
}

async function createClassAs(token: string, branchId: string, weekday: number, startTime: string) {
  const res = await request(app)
    .post("/api/v1/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ branchId, weekday, startTime });
  return res.body.id as string;
}

async function enroll(token: string, classId: string, contractId: string) {
  return request(app)
    .post(`/api/v1/classes/${classId}/enrollments`)
    .set("Authorization", `Bearer ${token}`)
    .send({ contractId, fromDate: isoDaysFromNow(0) });
}

describe("М3 ба М4 нэмэлт дүрмүүд", () => {
  it("ФШ-15: сул суудалтай ангийг суудлын тоотой нь харуулж, дүүрсэн ангийг оруулахгүй", async () => {
    const { token } = await loginAsTeacher();
    const branchId = await createBranch();
    const programId = await createProgram();
    const openClass = await createClassAs(token, branchId, 1, "09:00");
    const fullClass = await createClassAs(token, branchId, 2, "09:00");

    const enrollOne = await enroll(token, openClass, (await createContractFor(programId)).id);
    expect(enrollOne.status).toBe(201);
    for (let i = 0; i < 6; i++) {
      const res = await enroll(token, fullClass, (await createContractFor(programId)).id);
      expect(res.status).toBe(201);
    }

    const res = await request(app)
      .get(`/api/v1/classes/available?branchId=${branchId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    const ids = (res.body as { id: string }[]).map((c) => c.id);
    expect(ids).toContain(openClass);
    expect(ids).not.toContain(fullClass);
    const open = (res.body as { id: string; availableSeats: number }[]).find(
      (c) => c.id === openClass,
    );
    expect(open?.availableSeats).toBe(5);
  });

  it("ФШ-18: хувийн төлөвлөгөө сэдвийн дарааллаар хадгалагдаж, дахин илгээхэд солигдоно", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, await createBranch(), 6, "09:00");
    const contract = await createContractFor(await createProgram());
    await enroll(token, classId, contract.id);

    const first = await request(app)
      .put(`/api/v1/contracts/${contract.id}/plan`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        items: [
          { position: 1, topic: "Тоо" },
          { position: 2, topic: "Тэгшитгэл" },
        ],
      });
    expect(first.status).toBe(200);

    const second = await request(app)
      .put(`/api/v1/contracts/${contract.id}/plan`)
      .set("Authorization", `Bearer ${token}`)
      .send({ items: [{ position: 1, topic: "Геометр" }] });
    expect(second.status).toBe(200);

    const items = await prisma.planItem.findMany({
      where: { contractId: contract.id },
      orderBy: { position: "asc" },
    });
    expect(items.map((i) => i.topic)).toEqual(["Геометр"]);
  });

  it("ФШ-21: нэг ангид өөр өөр хөтөлбөрийн сурагч суугаад тус бүр өөрийн гэрээний үнэтэй байна", async () => {
    const { token } = await loginAsTeacher();
    const branchId = await createBranch();
    const classId = await createClassAs(token, branchId, 3, "09:00");

    const programA = await createProgram();
    const programB = await prisma.program.create({
      data: { name: `Олон улс ${randomUUID().slice(0, 8)}`, currentPrice: "700000.00" },
    });
    const contractA = await createContractFor(programA);
    const contractB = await prisma.contract.create({
      data: {
        studentId: (await prisma.student.create({ data: { fullName: "Б" } })).id,
        programId: programB.id,
        price: "700000.00",
        totalHours: 75,
        remainingHours: 75,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });

    expect((await enroll(token, classId, contractA.id)).status).toBe(201);
    expect((await enroll(token, classId, contractB.id)).status).toBe(201);

    const enrollments = await prisma.enrollment.findMany({
      where: { classId, toDate: null },
      include: { contract: true },
    });
    const prices = enrollments.map((e) => e.contract.price.toString()).sort();
    expect(prices).toEqual(["500000", "700000"]);
  });

  it("ФШ-74: суудал хадгалахгүй зогсоход бүртгэл хаагдаж сул суудал нэмэгдэнэ, хадгалбал суудал хэвээр", async () => {
    const { token } = await loginAsTeacher();
    const branchId = await createBranch();
    const programId = await createProgram();
    const classId = await createClassAs(token, branchId, 4, "09:00");

    const keep = await createContractFor(programId, "Суудал хадгалах");
    const release = await createContractFor(programId, "Суудал чөлөөлөх");
    await enroll(token, classId, keep.id);
    await enroll(token, classId, release.id);

    const seatsLeft = async () => {
      const res = await request(app)
        .get(`/api/v1/classes/available?branchId=${branchId}`)
        .set("Authorization", `Bearer ${token}`);
      return (res.body as { id: string; availableSeats: number }[]).find((c) => c.id === classId)
        ?.availableSeats;
    };
    expect(await seatsLeft()).toBe(4);

    const keepPause = await request(app)
      .post(`/api/v1/contracts/${keep.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startedOn: isoDaysFromNow(1), reason: "Аялал", holdSeat: true });
    expect(keepPause.status).toBe(201);
    expect(await seatsLeft()).toBe(4);

    const releasePause = await request(app)
      .post(`/api/v1/contracts/${release.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startedOn: isoDaysFromNow(1), reason: "Гадаад", holdSeat: false });
    expect(releasePause.status).toBe(201);
    expect(await seatsLeft()).toBe(5);
  });

  it("ФШ-72: өнгөрсөн огноогоор зогсоох боломжгүй (409)", async () => {
    const { token } = await loginAsTeacher();
    const branchId = await createBranch();
    const classId = await createClassAs(token, branchId, 5, "09:00");
    const contract = await createContractFor(await createProgram());
    await enroll(token, classId, contract.id);

    const res = await request(app)
      .post(`/api/v1/contracts/${contract.id}/pause`)
      .set("Authorization", `Bearer ${token}`)
      .send({ startedOn: isoDaysFromNow(-3), reason: "Өвчтэй", holdSeat: true });

    expect(res.status).toBe(409);
    expect(res.body.type).toContain("pause-start-in-past");
  });
});
