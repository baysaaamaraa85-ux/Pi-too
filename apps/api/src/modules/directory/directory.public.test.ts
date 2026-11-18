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

async function loginAdmin() {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role: Role.ADMIN, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

async function makeTeacher(fullName: string, opts: { active?: boolean } = {}) {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role: Role.TEACHER, phone, passwordHash: "x", isActive: opts.active ?? true },
  });
  await prisma.teacher.create({ data: { userId: user.id, fullName } });
  return { userId: user.id, phone };
}

describe("ФШ-78 Нийтийн сайт: багш нар, хөтөлбөр, салбар", () => {
  it("админы шинээр нэмсэн идэвхтэй багш нэвтрэлтгүйгээр нийтийн жагсаалтад гарч, утас, имэйл гарахгүй", async () => {
    const admin = await loginAdmin();
    const name = `Нийтийн багш ${randomUUID().slice(0, 6)}`;
    const created = await request(app)
      .post("/api/v1/teachers")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: name, phone: phone8() });
    expect(created.status).toBe(201);

    const list = await request(app).get("/api/v1/public/teachers");
    expect(list.status).toBe(200);
    const found = (list.body as Record<string, unknown>[]).find((t) => t.fullName === name);
    expect(found).toBeDefined();
    expect(Object.keys(found!).sort()).toEqual(["branches", "fullName", "id", "photoUrl", "specialties"]);
    expect(JSON.stringify(list.body)).not.toMatch(/phone|email|passwordHash|rate/i);
  });

  it("идэвхгүй болгосон багш нийтийн жагсаалтаас алга болно", async () => {
    const admin = await loginAdmin();
    const name = `Идэвхгүй ${randomUUID().slice(0, 6)}`;
    const t = await makeTeacher(name);
    const before = await request(app).get("/api/v1/public/teachers");
    expect((before.body as { fullName: string }[]).some((x) => x.fullName === name)).toBe(true);

    const off = await request(app)
      .patch(`/api/v1/users/${t.userId}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(off.status).toBe(204);
    const after = await request(app).get("/api/v1/public/teachers");
    expect((after.body as { fullName: string }[]).some((x) => x.fullName === name)).toBe(false);
  });

  it("админ багшийн мэргэшил, зургийг засаж, нийтийн жагсаалтад салбарын нэртэй гарна; аудитад бичигдэнэ", async () => {
    const admin = await loginAdmin();
    const t = await makeTeacher(`Профайл ${randomUUID().slice(0, 6)}`);
    const branch = await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 6)}`, address: "Хаяг 1" } });
    await prisma.class.create({
      data: { teacherId: t.userId, branchId: branch.id, weekday: 3, startTime: "10:00", durationMin: 120, capacity: 6 },
    });

    const patch = await request(app)
      .patch(`/api/v1/teachers/${t.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ specialties: ["AS & A Level", "IGCSE"], photoUrl: "/images/teachers/x.jpg" });
    expect(patch.status).toBe(200);
    expect(patch.body).toMatchObject({ specialties: ["AS & A Level", "IGCSE"], photoUrl: "/images/teachers/x.jpg" });

    const list = await request(app).get("/api/v1/public/teachers");
    const found = (list.body as { id: string; specialties: string[]; photoUrl: string | null; branches: string[] }[]).find(
      (x) => x.id === t.userId,
    )!;
    expect(found).toMatchObject({ specialties: ["AS & A Level", "IGCSE"], photoUrl: "/images/teachers/x.jpg", branches: [branch.name] });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "teacher", entityId: t.userId, action: "UPDATE" } });
    expect(audit.actorId).toBe(admin.userId);
  });

  it("зургийн хаяг зөвхөн /images/ эсвэл https:// байх ёстой (javascript: 422), мэргэшил 8-аас олон бол 422", async () => {
    const admin = await loginAdmin();
    const t = await makeTeacher(`Хаяг ${randomUUID().slice(0, 6)}`);
    const patch = (body: object) =>
      request(app).patch(`/api/v1/teachers/${t.userId}`).set("Authorization", `Bearer ${admin.token}`).send(body);
    expect((await patch({ photoUrl: "javascript:alert(1)" })).status).toBe(422);
    expect((await patch({ photoUrl: "http://example.com/a.jpg" })).status).toBe(422);
    expect((await patch({ photoUrl: "https://example.com/a.jpg" })).status).toBe(200);
    expect((await patch({ photoUrl: "" })).status).toBe(200);
    expect((await patch({ specialties: Array.from({ length: 9 }, (_, i) => `М${i}`) })).status).toBe(422);
  });

  it("багш нарын профайлыг зөвхөн админ засна (багш 403)", async () => {
    const t = await makeTeacher(`Эрх ${randomUUID().slice(0, 6)}`);
    const other = await makeTeacher(`Эрх2 ${randomUUID().slice(0, 6)}`);
    await prisma.user.update({ where: { id: t.userId }, data: { passwordHash: await bcrypt.hash("Correct123!", 10) } });
    const login = await request(app).post("/api/v1/auth/login").send({ identifier: t.phone, password: "Correct123!" });
    const res = await request(app)
      .patch(`/api/v1/teachers/${other.userId}`)
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ specialties: ["Хакер"] });
    expect(res.status).toBe(403);
  });

  it("нийтийн хөтөлбөрийн үнэ DB-тэй нэг: админ үнэ өөрчлөхөд шууд харагдана, мөнгө тэмдэгт мөр", async () => {
    const admin = await loginAdmin();
    const program = await prisma.program.create({
      data: { name: `Нийтийн хөтөлбөр ${randomUUID().slice(0, 6)}`, currentPrice: "1200000.00" },
    });
    const first = await request(app).get("/api/v1/public/programs");
    expect((first.body as { id: string; price: string }[]).find((p) => p.id === program.id)?.price).toBe("1200000.00");

    const upd = await request(app)
      .patch(`/api/v1/programs/${program.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ currentPrice: "1500000.00" });
    expect(upd.status).toBe(200);
    const second = await request(app).get("/api/v1/public/programs");
    expect((second.body as { id: string; price: string }[]).find((p) => p.id === program.id)?.price).toBe("1500000.00");
  });

  it("нийтийн салбар хаягтай, нүүрний тоон мэдээлэл settings-ээс (салбарын тоо, 6 суудал, 75 цаг, 3 чөлөө, 93%)", async () => {
    const branch = await prisma.branch.create({ data: { name: `Нийтийн салбар ${randomUUID().slice(0, 6)}`, address: "Баянгол, 1-р хороо" } });
    const branches = await request(app).get("/api/v1/public/branches");
    expect((branches.body as { id: string; address: string }[]).find((b) => b.id === branch.id)?.address).toBe("Баянгол, 1-р хороо");

    const overview = await request(app).get("/api/v1/public/overview");
    expect(overview.status).toBe(200);
    expect(overview.body).toEqual({
      branchCount: await prisma.branch.count({ where: { isActive: true } }),
      classCapacity: 6,
      packageHours: 75,
      leaves: 3,
      reviewThresholdPercent: 93,
    });
  });
});
