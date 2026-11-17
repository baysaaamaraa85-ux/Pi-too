import { randomInt, randomUUID } from "node:crypto";
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

let branchId: string | null = null;
async function getBranchId() {
  branchId ??= (await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } })).id;
  return branchId;
}

async function makeStudent(teacherId: string, name: string) {
  const cls = await prisma.class.create({
    data: { teacherId, branchId: await getBranchId(), weekday: 2, startTime: "10:00", durationMin: 120, capacity: 6 },
  });
  const program = await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1800000.00" } });
  const student = await prisma.student.create({ data: { fullName: name } });
  const contract = await prisma.contract.create({
    data: { studentId: student.id, programId: program.id, price: "1800000.00", totalHours: 75, remainingHours: 75, leavesLeft: 3, rulesAckAt: new Date() },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId: cls.id, fromDate: new Date("2026-01-01") } });
  return student;
}

const call = (method: "get" | "post" | "patch" | "put" | "delete", token: string, path: string, body?: object) =>
  request(app)[method](`/api/v1${path}`).set("Authorization", `Bearer ${token}`).send(body);

describe("D-69 Багшийн өөрийн категори", () => {
  it("багш категори үүсгэж, нэрийг нь өөрчилж, сурагчаа нэг категорид нэмнэ; нэг сурагч нэг категорид л байна", async () => {
    const t = await loginUser(Role.TEACHER);
    const s = await makeStudent(t.userId, "Анхаа");
    const as = await call("post", t.token, "/teacher/categories", { name: "AS" });
    const ib = await call("post", t.token, "/teacher/categories", { name: "IB" });
    expect(as.status).toBe(201);

    expect((await call("put", t.token, `/teacher/students/${s.id}/category`, { categoryId: as.body.id })).status).toBe(200);
    // Өөр категорид нэмэхэд шилжинэ (давхар ангилахгүй).
    expect((await call("put", t.token, `/teacher/students/${s.id}/category`, { categoryId: ib.body.id })).status).toBe(200);
    const list = await call("get", t.token, "/teacher/categories");
    expect(list.body.assignments).toEqual([{ studentId: s.id, categoryId: ib.body.id }]);
    const counts = new Map((list.body.categories as { name: string; students: number }[]).map((c) => [c.name, c.students]));
    expect(counts.get("IB")).toBe(1);
    expect(counts.get("AS")).toBe(0);

    const renamed = await call("patch", t.token, `/teacher/categories/${ib.body.id}`, { name: "IB DP" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe("IB DP");
  });

  it("нэр давхардвал 409, хоосон нэр 422; ижил нэрийг өөр багш ашиглаж болно", async () => {
    const a = await loginUser(Role.TEACHER);
    const b = await loginUser(Role.TEACHER);
    expect((await call("post", a.token, "/teacher/categories", { name: "ЭЕШ" })).status).toBe(201);
    const dup = await call("post", a.token, "/teacher/categories", { name: "ЭЕШ" });
    expect(dup.status).toBe(409);
    expect(dup.body.type).toContain("category-exists");
    expect((await call("post", a.token, "/teacher/categories", { name: "   " })).status).toBe(422);
    expect((await call("post", b.token, "/teacher/categories", { name: "ЭЕШ" })).status).toBe(201);
  });

  it("категори устгахад сурагчид Ангилаагүй болно, сурагч өөрөө устахгүй", async () => {
    const t = await loginUser(Role.TEACHER);
    const s = await makeStudent(t.userId, "Бат");
    const cat = await call("post", t.token, "/teacher/categories", { name: "SAT" });
    await call("put", t.token, `/teacher/students/${s.id}/category`, { categoryId: cat.body.id });
    expect((await call("delete", t.token, `/teacher/categories/${cat.body.id}`)).status).toBe(204);
    const list = await call("get", t.token, "/teacher/categories");
    expect(list.body.categories).toEqual([]);
    expect(list.body.assignments).toEqual([]);
    expect(await prisma.student.count({ where: { id: s.id } })).toBe(1);
  });

  it("BOLA: багш өөр багшийн категориг засах, устгах, ашиглах, өөр багшийн сурагчийг ангилах боломжгүй (403)", async () => {
    const mine = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const theirs = await makeStudent(other.userId, "Бусдын");
    const mineStudent = await makeStudent(mine.userId, "Миний");
    const theirCat = await call("post", other.token, "/teacher/categories", { name: "Бусдын категори" });
    const myCat = await call("post", mine.token, "/teacher/categories", { name: "Миний" });

    expect((await call("patch", mine.token, `/teacher/categories/${theirCat.body.id}`, { name: "Хакер" })).status).toBe(403);
    expect((await call("delete", mine.token, `/teacher/categories/${theirCat.body.id}`)).status).toBe(403);
    expect((await call("put", mine.token, `/teacher/students/${mineStudent.id}/category`, { categoryId: theirCat.body.id })).status).toBe(403);
    expect((await call("put", mine.token, `/teacher/students/${theirs.id}/category`, { categoryId: myCat.body.id })).status).toBe(403);
    // Өөр багшийн жагсаалт харагдахгүй.
    const list = await call("get", mine.token, "/teacher/categories");
    expect((list.body.categories as { name: string }[]).map((c) => c.name)).toEqual(["Миний"]);
  });

  it("зөвхөн багш: админ, эцэг эх 403, нэвтрээгүй 401", async () => {
    const admin = await loginUser(Role.ADMIN);
    const parent = await loginUser(Role.PARENT);
    expect((await call("get", admin.token, "/teacher/categories")).status).toBe(403);
    expect((await call("get", parent.token, "/teacher/categories")).status).toBe(403);
    expect((await request(app).get("/api/v1/teacher/categories")).status).toBe(401);
  });

  it("самбар: категори бүрийн идэвхтэй сурагчийн тоо, ангилаагүй нь Ангилаагүй гэж гарна", async () => {
    const t = await loginUser(Role.TEACHER);
    const a = await makeStudent(t.userId, "Анхаа");
    const b = await makeStudent(t.userId, "Бат");
    await makeStudent(t.userId, "Цэцэг");
    const cat = await call("post", t.token, "/teacher/categories", { name: "IGCSE" });
    await call("put", t.token, `/teacher/students/${a.id}/category`, { categoryId: cat.body.id });
    await call("put", t.token, `/teacher/students/${b.id}/category`, { categoryId: cat.body.id });

    const dash = await call("get", t.token, "/dashboard");
    expect(dash.status).toBe(200);
    expect(dash.body.categories).toEqual([
      { categoryId: cat.body.id, name: "IGCSE", students: 2 },
      { categoryId: null, name: "Ангилаагүй", students: 1 },
    ]);
  });
});
