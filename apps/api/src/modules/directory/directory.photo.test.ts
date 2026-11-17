import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { Role } from "../../generated/prisma/client.js";
import { prisma } from "../../shared/db/prisma.js";
import { removeUploadedImage } from "../../shared/uploads/image-upload.js";

const app = createApp();
const uploaded: string[] = [];

afterAll(async () => {
  for (const url of uploaded) await removeUploadedImage(url);
});

// Зөвхөн PNG-ийн толгой (magic bytes) байхад хангалттай: сервер файлын эхний байтыг шалгана.
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

async function login(role: Role) {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: `Зурагтай ${randomUUID().slice(0, 6)}` } });
  }
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

const putTeacherPhoto = (id: string, token: string, body: Buffer, type = "image/png") =>
  request(app).put(`/api/v1/teachers/${id}/photo`).set("Authorization", `Bearer ${token}`).set("Content-Type", type).send(body);

describe("ФШ-78 Багшийн зураг оруулах", () => {
  it("багш өөрийн зургийг оруулж, нийтийн жагсаалт ба статик замаар харагдана; хуучин файл устна", async () => {
    const t = await login(Role.TEACHER);
    const first = await putTeacherPhoto(t.userId, t.token, PNG);
    expect(first.status).toBe(200);
    const url1 = first.body.photoUrl as string;
    uploaded.push(url1);
    expect(url1).toMatch(/^\/uploads\/teachers\/[0-9a-f-]+\.png$/);

    const file = await request(app).get(url1);
    expect(file.status).toBe(200);
    expect(file.headers["x-content-type-options"]).toBe("nosniff");

    const list = await request(app).get("/api/v1/public/teachers");
    expect((list.body as { id: string; photoUrl: string | null }[]).find((x) => x.id === t.userId)?.photoUrl).toBe(url1);

    // Дахин оруулахад шинэ зам, хуучин файл устсан.
    const second = await putTeacherPhoto(t.userId, t.token, JPG, "image/jpeg");
    expect(second.status).toBe(200);
    uploaded.push(second.body.photoUrl as string);
    expect(second.body.photoUrl).toMatch(/\.jpg$/);
    expect((await request(app).get(url1)).status).toBe(404);
  });

  it("BOLA: багш өөр багшийн зургийг солиж чадахгүй (403), админ чадна", async () => {
    const a = await login(Role.TEACHER);
    const b = await login(Role.TEACHER);
    const admin = await login(Role.ADMIN);
    expect((await putTeacherPhoto(b.userId, a.token, PNG)).status).toBe(403);
    const ok = await putTeacherPhoto(b.userId, admin.token, PNG);
    expect(ok.status).toBe(200);
    uploaded.push(ok.body.photoUrl as string);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "teacher", entityId: b.userId, action: "UPDATE" } });
    expect(audit.actorId).toBe(admin.userId);
  });

  it("эцэг эх, нэвтрээгүй хүн зураг оруулж чадахгүй (403, 401)", async () => {
    const t = await login(Role.TEACHER);
    const parent = await login(Role.PARENT);
    expect((await putTeacherPhoto(t.userId, parent.token, PNG)).status).toBe(403);
    const anon = await request(app).put(`/api/v1/teachers/${t.userId}/photo`).set("Content-Type", "image/png").send(PNG);
    expect(anon.status).toBe(401);
  });

  it("зураг биш файл (Content-Type PNG гэж хуурсан ч) 422, хоосон бие 422, 3 MB-аас том 413", async () => {
    const t = await login(Role.TEACHER);
    const fake = await putTeacherPhoto(t.userId, t.token, Buffer.from("<script>alert(1)</script>"));
    expect(fake.status).toBe(422);
    expect(fake.body.type).toMatch(/invalid-image$/);
    const noBody = await request(app).put(`/api/v1/teachers/${t.userId}/photo`).set("Authorization", `Bearer ${t.token}`);
    expect(noBody.status).toBe(422);
    const wrongType = await putTeacherPhoto(t.userId, t.token, PNG, "text/plain");
    expect(wrongType.status).toBe(422);
    const big = await putTeacherPhoto(t.userId, t.token, Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]));
    expect(big.status).toBe(413);
    const row = await prisma.teacher.findUniqueOrThrow({ where: { userId: t.userId } });
    expect(row.photoUrl).toBeNull();
  });
});

describe("ФШ-78 Салбарын мэдээлэл ба зураг", () => {
  it("админ салбарын тайлбар, утас, зураг оруулна; нийтийн жагсаалтад гарна, багш зураг оруулж чадахгүй", async () => {
    const admin = await login(Role.ADMIN);
    const teacher = await login(Role.TEACHER);
    const created = await request(app)
      .post("/api/v1/branches")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: `Салбар ${randomUUID().slice(0, 6)}`, address: "Баянгол, 3-р хороо", description: "Метроны хажууд", phones: ["99112233", "88112233"] });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const put = (token: string) =>
      request(app).put(`/api/v1/branches/${id}/photo`).set("Authorization", `Bearer ${token}`).set("Content-Type", "image/png").send(PNG);
    expect((await put(teacher.token)).status).toBe(403);
    const ok = await put(admin.token);
    expect(ok.status).toBe(200);
    uploaded.push(ok.body.photoUrl as string);

    const list = await request(app).get("/api/v1/public/branches");
    const found = (list.body as Record<string, unknown>[]).find((b) => b.id === id);
    expect(found).toMatchObject({
      address: "Баянгол, 3-р хороо",
      description: "Метроны хажууд",
      phones: ["99112233", "88112233"],
      photoUrl: ok.body.photoUrl,
    });

    const bad = await request(app)
      .patch(`/api/v1/branches/${id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ phones: Array.from({ length: 7 }, () => "99112233") });
    expect(bad.status).toBe(422);
  });
});
