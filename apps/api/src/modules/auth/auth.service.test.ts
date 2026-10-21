import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

function extractRefreshCookie(res: request.Response): string {
  const raw = res.headers["set-cookie"];
  const cookies: string[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const match = cookies.map((c) => /refreshToken=([^;]+)/.exec(c)).find(Boolean);
  if (!match) throw new Error("refreshToken cookie олдсонгүй");
  return match[1]!;
}

async function createTestUser(params: {
  role: Role;
  password: string;
  isActive?: boolean;
}) {
  const phone = `t${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const passwordHash = await bcrypt.hash(params.password, 10);
  const user = await prisma.user.create({
    data: {
      role: params.role,
      phone,
      passwordHash,
      isActive: params.isActive ?? true,
    },
  });
  return { ...user, phone, rawPassword: params.password };
}

describe("М1 Нэвтрэлт ба эрх", () => {
  it("ФШ-01: зөв мэдээлэлтэй хэрэглэгч амжилттай нэвтэрнэ", async () => {
    const user = await createTestUser({ role: Role.ADMIN, password: "Correct123!" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: user.phone, password: "Correct123!" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.user.id).toBe(user.id);
    expect(extractRefreshCookie(res)).toBeTypeOf("string");
  });

  it("ФШ-01: буруу нууц үгээр нэвтэрэх боломжгүй", async () => {
    const user = await createTestUser({ role: Role.ADMIN, password: "Correct123!" });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: user.phone, password: "Wrong123!" });

    expect(res.status).toBe(401);
    expect(res.body.type).toContain("invalid-credentials");
  });

  it("ФБШ-22: 5 удаа дараалан буруу нэвтэрвэл данс түгжигдэнэ", async () => {
    const user = await createTestUser({ role: Role.ADMIN, password: "Correct123!" });

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ identifier: user.phone, password: "Wrong123!" });
      expect(res.status).toBe(401);
    }

    // 6 дахь оролдлого зөв нууц үгтэй ч түгжигдсэн тул татгалзагдана.
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: user.phone, password: "Correct123!" });

    expect(res.status).toBe(401);
    expect(res.body.type).toContain("account-locked");
  });

  it("ФШ-06: идэвхгүй данс нэвтэрч чадахгүй", async () => {
    const user = await createTestUser({
      role: Role.ADMIN,
      password: "Correct123!",
      isActive: false,
    });

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: user.phone, password: "Correct123!" });

    expect(res.status).toBe(401);
    expect(res.body.type).toContain("account-inactive");
  });

  it("ADR-004: refresh token rotation, ашиглагдсан token дахин ирвэл бүх token хүчингүй", async () => {
    const user = await createTestUser({ role: Role.ADMIN, password: "Correct123!" });

    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: user.phone, password: "Correct123!" });
    const firstRefreshToken = extractRefreshCookie(loginRes);

    const refreshRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${firstRefreshToken}`);
    expect(refreshRes.status).toBe(200);
    const secondRefreshToken = extractRefreshCookie(refreshRes);
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // Хуучин (аль хэдийн ашиглагдсан) token-оор дахин оролдвол 401 ба бүх token цуцлагдана.
    const reuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${firstRefreshToken}`);
    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.type).toContain("refresh-token-reused");

    // Хоёрдугаар (цоо шинэ, зүгээр ашиглагдаагүй байсан) token ч одоо хүчингүй.
    const afterReuseRes = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${secondRefreshToken}`);
    expect(afterReuseRes.status).toBe(401);
  });

  it("ФБШ-20: багш админд зориулсан /users endpoint-д хандах эрхгүй (403)", async () => {
    const teacher = await createTestUser({ role: Role.TEACHER, password: "Correct123!" });
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: teacher.phone, password: "Correct123!" });

    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
      .send({ role: "TEACHER", phone: "90000001", fullName: "Шинэ багш" });

    expect(res.status).toBe(403);
  });

  it("ФШ-02, 03: админ багшийн данс түр нууц үгтэй үүсгэнэ", async () => {
    const admin = await createTestUser({ role: Role.ADMIN, password: "Correct123!" });
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ identifier: admin.phone, password: "Correct123!" });

    const phone = `nt${randomUUID().replace(/-/g, "").slice(0, 9)}`;
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`)
      .send({ role: "TEACHER", phone, fullName: "Шинэ багш" });

    expect(res.status).toBe(201);
    expect(res.body.tempPassword).toBeTypeOf("string");

    const created = await prisma.user.findUnique({ where: { phone } });
    expect(created?.mustChangePassword).toBe(true);
  });
});
