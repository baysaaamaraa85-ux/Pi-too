import { randomInt } from "node:crypto";
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

const patch = (token: string, id: string, specialties: unknown) =>
  request(app).patch(`/api/v1/teachers/${id}/specialties`).set("Authorization", `Bearer ${token}`).send({ specialties });

describe("D-69 Багш өөрийн заах чиглэлийг өөрөө бичнэ", () => {
  it("багш өөрийн мэргэшлийг засахад нийтийн жагсаалтад шинэчлэгдэж, аудитад бичигдэнэ", async () => {
    const t = await loginUser(Role.TEACHER);
    const res = await patch(t.token, t.userId, ["AS & A Level", "Олимпиад"]);
    expect(res.status).toBe(200);
    const list = await request(app).get("/api/v1/public/teachers");
    expect((list.body as { id: string; specialties: string[] }[]).find((x) => x.id === t.userId)?.specialties).toEqual(["AS & A Level", "Олимпиад"]);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "teacher", entityId: t.userId, action: "UPDATE" } });
    expect(audit.actorId).toBe(t.userId);
  });

  it("BOLA: багш өөр багшийнхыг засаж чадахгүй (403), админ чадна, эцэг эх 403, нэвтрээгүй 401", async () => {
    const a = await loginUser(Role.TEACHER);
    const b = await loginUser(Role.TEACHER);
    const admin = await loginUser(Role.ADMIN);
    const parent = await loginUser(Role.PARENT);
    expect((await patch(a.token, b.userId, ["Хакер"])).status).toBe(403);
    expect((await patch(admin.token, b.userId, ["ЭЕШ"])).status).toBe(200);
    expect((await patch(parent.token, b.userId, ["ЭЕШ"])).status).toBe(403);
    expect((await request(app).patch(`/api/v1/teachers/${b.userId}/specialties`).send({ specialties: [] })).status).toBe(401);
  });

  it("8-аас олон чиглэл, хоосон нэр 422", async () => {
    const t = await loginUser(Role.TEACHER);
    expect((await patch(t.token, t.userId, Array.from({ length: 9 }, (_, i) => `Чиглэл ${i}`))).status).toBe(422);
    expect((await patch(t.token, t.userId, ["  "])).status).toBe(422);
    expect((await patch(t.token, t.userId, [])).status).toBe(200);
  });
});
