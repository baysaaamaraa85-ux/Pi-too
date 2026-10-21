import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

async function loginAs(role: Role) {
  const phone = `c${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  await prisma.user.create({ data: { role, phone, passwordHash } });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return res.body.accessToken as string;
}

describe("М2 Суурь мэдээлэл", () => {
  it("ФШ-07: админ салбар үүсгэж, жагсаалтанд харагдана", async () => {
    const token = await loginAs(Role.ADMIN);
    const name = `Тест салбар ${randomUUID().slice(0, 8)}`;

    const createRes = await request(app)
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, address: "хаяг" });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((b: { name: string }) => b.name === name)).toBe(true);
  });

  it("Эрхийн матриц: эцэг эх салбарын жагсаалтыг харах эрхгүй (403)", async () => {
    const token = await loginAs(Role.PARENT);
    const res = await request(app)
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("Багш салбар, хөтөлбөр үүсгэх эрхгүй (403), харин GET хийж чадна", async () => {
    const token = await loginAs(Role.TEACHER);
    const createRes = await request(app)
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "x", address: "y" });
    expect(createRes.status).toBe(403);

    const listRes = await request(app)
      .get("/api/v1/branches")
      .set("Authorization", `Bearer ${token}`);
    expect(listRes.status).toBe(200);
  });

  it("ФШ-08, ADR-013: хөтөлбөрийн үнэ өөрчлөгдөхөд өмнөх гэрээний үнэ хэвээр үлдэнэ", async () => {
    const token = await loginAs(Role.ADMIN);
    const name = `Тест хөтөлбөр ${randomUUID().slice(0, 8)}`;

    const createRes = await request(app)
      .post("/api/v1/programs")
      .set("Authorization", `Bearer ${token}`)
      .send({ name, currentPrice: "500000.00" });
    expect(createRes.status).toBe(201);
    const programId = createRes.body.id as string;

    const student = await prisma.student.create({ data: { fullName: "Тест сурагч" } });
    const contract = await prisma.contract.create({
      data: {
        studentId: student.id,
        programId,
        price: "500000.00",
        totalVisits: 25,
        remainingVisits: 25,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });

    const updateRes = await request(app)
      .patch(`/api/v1/programs/${programId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPrice: "600000.00" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.currentPrice).toBe("600000");

    const unchangedContract = await prisma.contract.findUnique({ where: { id: contract.id } });
    expect(unchangedContract?.price.toString()).toBe("500000");
  });

  it("ФШ-09: settings унших, бичих (аудиттай)", async () => {
    const token = await loginAs(Role.ADMIN);

    const getRes = await request(app)
      .get("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.some((s: { key: string }) => s.key === "class_defaults")).toBe(true);

    const putRes = await request(app)
      .put("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ key: "class_defaults", value: { maxCapacity: 7 } });
    expect(putRes.status).toBe(200);
    expect(putRes.body.value.maxCapacity).toBe(7);

    const auditRows = await prisma.auditLog.findMany({
      where: { entity: "settings", entityId: "class_defaults" },
      orderBy: { createdAt: "desc" },
      take: 1,
    });
    expect(auditRows[0]?.action).toBe("UPDATE");

    // Анхны утгыг сэргээнэ, бусад тестэд нөлөөлэхгүй.
    await request(app)
      .put("/api/v1/settings")
      .set("Authorization", `Bearer ${token}`)
      .send({ key: "class_defaults", value: { maxCapacity: 6 } });
  });

  it("ФШ-10: багшийн цагийн үнэлгээ хүчинтэй огноотой нэмэгдэнэ", async () => {
    const adminToken = await loginAs(Role.ADMIN);
    const teacherPhone = `ct${randomUUID().replace(/-/g, "").slice(0, 9)}`;
    const teacherUser = await prisma.user.create({
      data: { role: Role.TEACHER, phone: teacherPhone, passwordHash: "x" },
    });
    await prisma.teacher.create({ data: { userId: teacherUser.id, fullName: "Тест багш" } });

    const res = await request(app)
      .post(`/api/v1/teachers/${teacherUser.id}/rates`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ hourlyRate: "18000.00", effectiveFrom: "2026-11-01" });

    expect(res.status).toBe(201);
    expect(res.body.hourlyRate).toBe("18000");
  });
});
