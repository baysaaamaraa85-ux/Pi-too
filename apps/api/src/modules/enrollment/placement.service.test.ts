import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

async function tokenFor(role: Role) {
  const phone = `pr${randomUUID().replace(/-/g, "").slice(0, 9)}`;
  await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return res.body.accessToken as string;
}

describe("Нийтийн сайтын түвшин тогтоох цагийн хүсэлт", () => {
  it("нэвтрэлтгүйгээр хүсэлт илгээж болно, утасны хоосон зай хасагдана", async () => {
    const res = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Тест сурагч", phone: "9911 1234", grade: "9-р анги" });
    expect(res.status).toBe(201);

    const saved = await prisma.placementRequest.findUnique({ where: { id: res.body.id } });
    expect(saved?.phone).toBe("99111234");
    expect(saved?.status).toBe("NEW");
  });

  it("буруу утасны дугаарт 422", async () => {
    const res = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Тест", phone: "123" });
    expect(res.status).toBe(422);
  });

  it("байхгүй салбар заавал 404", async () => {
    const res = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Тест", phone: "99112233", branchId: randomUUID() });
    expect(res.status).toBe(404);
  });

  it("жагсаалтыг зөвхөн админ харна, багш 403, нэвтрээгүй 401", async () => {
    const anonymous = await request(app).get("/api/v1/placement-requests");
    expect(anonymous.status).toBe(401);

    const teacher = await request(app)
      .get("/api/v1/placement-requests")
      .set("Authorization", `Bearer ${await tokenFor(Role.TEACHER)}`);
    expect(teacher.status).toBe(403);

    const admin = await request(app)
      .get("/api/v1/placement-requests")
      .set("Authorization", `Bearer ${await tokenFor(Role.ADMIN)}`);
    expect(admin.status).toBe(200);
    expect(Array.isArray(admin.body)).toBe(true);
  });

  it("админ хүсэлтийн төлөв шинэчилнэ", async () => {
    const created = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Төлөв тест", phone: "99112244" });
    const res = await request(app)
      .patch(`/api/v1/placement-requests/${created.body.id}`)
      .set("Authorization", `Bearer ${await tokenFor(Role.ADMIN)}`)
      .send({ status: "SCHEDULED", note: "Баасан 17:00" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("SCHEDULED");
  });
});

describe("Нийтийн салбарын жагсаалт", () => {
  // ФШ-78 (D-65, D-66): нийтийн сайт салбарын нэр, хаяг, тайлбар, утас, зургийг харуулна. Бусад талбар (үүсгэсэн огноо гэх мэт) гарахгүй.
  it("нэвтрэлтгүй зөвхөн нийтийн талбаруудыг буцаана", async () => {
    const res = await request(app).get("/api/v1/public/branches");
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
    expect(Object.keys(res.body[0]).sort()).toEqual(["address", "description", "id", "name", "phones", "photoUrl"]);
  });
});
