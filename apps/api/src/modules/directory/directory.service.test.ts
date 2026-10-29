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

async function loginAs(role: Role) {
  const phone = phone8();
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role, phone, passwordHash } });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  }
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id, phone };
}

describe("Админы хэрэглэгчийн удирдлага (шинэ шаардлага 1.2)", () => {
  it("ФШ-03: багш үүсгэхэд профайл, түр нууц үг нэг дор үүсч, жагсаалтад шууд гарна", async () => {
    const admin = await loginAs(Role.ADMIN);
    const phone = phone8();

    const created = await request(app)
      .post("/api/v1/teachers")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: "Шинэ Багш", phone });
    expect(created.status).toBe(201);
    expect(created.body.tempPassword).toBeTypeOf("string");

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: created.body.id },
      include: { teacher: true },
    });
    expect(user.mustChangePassword).toBe(true);
    expect(user.teacher?.fullName).toBe("Шинэ Багш");

    const list = await request(app)
      .get(`/api/v1/teachers?search=${phone}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].fullName).toBe("Шинэ Багш");
  });

  it("ФШ-03: ижил утастай хоёр дахь данс 409, утас буруу бол 422", async () => {
    const admin = await loginAs(Role.ADMIN);
    const phone = phone8();
    const body = { fullName: "Эцэг", phone };
    expect(
      (await request(app).post("/api/v1/parents").set("Authorization", `Bearer ${admin.token}`).send(body)).status,
    ).toBe(201);
    const dup = await request(app)
      .post("/api/v1/parents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send(body);
    expect(dup.status).toBe(409);

    const bad = await request(app)
      .post("/api/v1/parents")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: "Эцэг", phone: "123" });
    expect(bad.status).toBe(422);
  });

  it("ФШ-03: түр нууц үгээр нэвтэрч, шинэ нууц үг тохируулна", async () => {
    const admin = await loginAs(Role.ADMIN);
    const phone = phone8();
    const created = await request(app)
      .post("/api/v1/teachers")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ fullName: "Багш Нэг", phone });

    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: phone, password: created.body.tempPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    const change = await request(app)
      .post("/api/v1/auth/password/change")
      .set("Authorization", `Bearer ${login.body.accessToken}`)
      .send({ currentPassword: created.body.tempPassword, newPassword: "NewPass123!" });
    expect(change.status).toBe(204);
  });

  it("ФШ-03: нууц үг шинээр үүсгэхэд хуучин нууц үг хүчингүй болж, дахин солих шаардлагатай", async () => {
    const admin = await loginAs(Role.ADMIN);
    const target = await loginAs(Role.TEACHER);

    const reset = await request(app)
      .post(`/api/v1/users/${target.userId}/reset-password`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(reset.status).toBe(200);

    const old = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: target.phone, password: "Correct123!" });
    expect(old.status).toBe(401);

    const fresh = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: target.phone, password: reset.body.tempPassword });
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.mustChangePassword).toBe(true);
  });

  it("ФШ-06: идэвхгүй болгосон багш нэвтэрч чадахгүй, өөрийн дансыг идэвхгүй болгох боломжгүй", async () => {
    const admin = await loginAs(Role.ADMIN);
    const target = await loginAs(Role.TEACHER);

    const off = await request(app)
      .patch(`/api/v1/users/${target.userId}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(off.status).toBe(204);
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: target.phone, password: "Correct123!" });
    expect(login.status).not.toBe(200);

    const self = await request(app)
      .patch(`/api/v1/users/${admin.userId}/status`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ isActive: false });
    expect(self.status).toBe(409);

    const inactive = await request(app)
      .get(`/api/v1/teachers?status=inactive&search=${target.phone}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(inactive.body.total).toBe(1);
  });

  it("ФШ-04, 13: сурагч үүсгэхэд эцэг эх холбогдож, эцэг эхийн дэлгэрэнгүйд хүүхэд нь гарна", async () => {
    const admin = await loginAs(Role.ADMIN);
    const parentPhone = phone8();

    const student = await request(app)
      .post("/api/v1/students")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ parentPhone, parentFullName: "Эх", studentFullName: "Хүү", grade: "5-р анги" });
    expect(student.status).toBe(201);

    const students = await request(app)
      .get(`/api/v1/students?search=${parentPhone}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(students.body.total).toBe(1);
    expect(students.body.items[0].parents[0].phone).toBe(parentPhone);

    const parent = await request(app)
      .get(`/api/v1/parents/${student.body.parentId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(parent.status).toBe(200);
    expect(parent.body.children.map((c: { fullName: string }) => c.fullName)).toEqual(["Хүү"]);

    const detail = await request(app)
      .get(`/api/v1/students/${student.body.studentId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.parents).toHaveLength(1);
  });

  it("ФШ-12: хуудаслалт хязгаар 100-аас хэтэрвэл 422", async () => {
    const admin = await loginAs(Role.ADMIN);
    const res = await request(app)
      .get("/api/v1/teachers?limit=101")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(422);
  });

  it("ФБШ-20: админ биш үүрэг жагсаалт, дэлгэрэнгүй, засварт 403 авна", async () => {
    const teacher = await loginAs(Role.TEACHER);
    const parent = await loginAs(Role.PARENT);
    const id = randomUUID();
    for (const token of [teacher.token, parent.token]) {
      for (const path of ["/teachers", "/students", `/teachers/${id}`, `/students/${id}`]) {
        const res = await request(app).get(`/api/v1${path}`).set("Authorization", `Bearer ${token}`);
        expect(res.status, path).toBe(403);
      }
      const reset = await request(app)
        .post(`/api/v1/users/${id}/reset-password`)
        .set("Authorization", `Bearer ${token}`);
      expect(reset.status).toBe(403);
    }
    // Багш эцэг эхийн жагсаалтыг харахгүй, харин утсаар хайна (ФШ-13).
    const list = await request(app)
      .get("/api/v1/parents")
      .set("Authorization", `Bearer ${teacher.token}`);
    expect(list.status).toBe(403);
    const search = await request(app)
      .get("/api/v1/parents?phone=1234")
      .set("Authorization", `Bearer ${teacher.token}`);
    expect(search.status).toBe(200);
  });

  it("ФШ-11: тохиргооны шидтэний алхам дараалалтай, өмнөх алхам дуусаагүй бол түгжигдэнэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const res = await request(app)
      .get("/api/v1/setup/status")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    const steps = res.body as { key: string; done: boolean; unlocked: boolean }[];
    expect(steps.map((s) => s.key)).toEqual(["branches", "programs", "teachers", "classes", "students"]);
    expect(steps[0]?.unlocked).toBe(true);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]?.unlocked).toBe(steps[i - 1]?.done);
    }

    const teacher = await loginAs(Role.TEACHER);
    const denied = await request(app)
      .get("/api/v1/setup/status")
      .set("Authorization", `Bearer ${teacher.token}`);
    expect(denied.status).toBe(403);
  });
});
