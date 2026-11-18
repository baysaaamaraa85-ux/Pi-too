import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

async function loginAs(role: Role) {
  const phone = `d${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role, phone, passwordHash } });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  }
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

function newBranch() {
  return prisma.branch.create({
    data: { name: `Устгах салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
}

describe("ФШ-07: салбар устгах", () => {
  it("түүхгүй салбарыг админ устгаж, жагсаалтаас арилж, аудитад бичигдэнэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const branch = await newBranch();

    const res = await request(app)
      .delete(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    expect(await prisma.branch.findUnique({ where: { id: branch.id } })).toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { entity: "branch", entityId: branch.id, action: "DELETE" },
    });
    expect(audit?.actorId).toBe(admin.userId);
  });

  async function addClass(branchId: string, teacherId: string, isActive: boolean) {
    return prisma.class.create({
      data: { teacherId, branchId, weekday: 2, startTime: "17:00", isActive },
    });
  }

  async function addLesson(classId: string, teacherId: string) {
    const startsAt = new Date(Date.now() - 24 * 3600_000);
    return prisma.lesson.create({
      data: {
        classId,
        teacherId,
        startsAt,
        endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
        originalStartsAt: startsAt,
      },
    });
  }

  it("ФБШ-12: идэвхтэй анги байгаа салбар 409 (branch-has-active-classes), салбар хэвээр", async () => {
    const admin = await loginAs(Role.ADMIN);
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    await addClass(branch.id, teacher.userId, true);

    const res = await request(app)
      .delete(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
    expect(String(res.body.type).endsWith("/branch-has-active-classes")).toBe(true);
    expect(await prisma.branch.findUnique({ where: { id: branch.id } })).not.toBeNull();
  });

  it("ФШ-07: бүх ангиа устгасан (идэвхгүй, түүхгүй) салбар устаж, ангиуд хичээлтэйгээ цэвэрлэгдэнэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    const klass = await addClass(branch.id, teacher.userId, false);
    const lesson = await addLesson(klass.id, teacher.userId);

    const res = await request(app)
      .delete(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    expect(await prisma.branch.findUnique({ where: { id: branch.id } })).toBeNull();
    expect(await prisma.class.findUnique({ where: { id: klass.id } })).toBeNull();
    expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).toBeNull();
    // Багш өөрөө хэвээр.
    expect(await prisma.teacher.findUnique({ where: { userId: teacher.userId } })).not.toBeNull();
  });

  it("ФБШ-24: идэвхгүй ангид ирцийн түүх байвал салбар 409 (branch-has-classes), юу ч устахгүй", async () => {
    const admin = await loginAs(Role.ADMIN);
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    const klass = await addClass(branch.id, teacher.userId, false);
    const lesson = await addLesson(klass.id, teacher.userId);
    const student = await prisma.student.create({ data: { fullName: "Ирцтэй" } });
    const program = await prisma.program.create({
      data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1000.00" },
    });
    const contract = await prisma.contract.create({
      data: {
        studentId: student.id,
        programId: program.id,
        price: "1000.00",
        totalHours: "75",
        remainingHours: "75",
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });
    await prisma.attendance.create({
      data: {
        lessonId: lesson.id,
        contractId: contract.id,
        marked: true,
        status: "PRESENT",
        updatedBy: teacher.userId,
      },
    });

    const res = await request(app)
      .delete(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
    expect(String(res.body.type).endsWith("/branch-has-classes")).toBe(true);
    expect(await prisma.branch.findUnique({ where: { id: branch.id } })).not.toBeNull();
    expect(await prisma.lesson.findUnique({ where: { id: lesson.id } })).not.toBeNull();
  });

  it("ФШ-07: салбарын нэр, хаягийг админ засна, давхардсан нэр 409, багш 403", async () => {
    const admin = await loginAs(Role.ADMIN);
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    const other = await newBranch();
    const newName = `Төв салбар ${randomUUID().slice(0, 8)}`;

    const ok = await request(app)
      .patch(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: newName, address: "Шинэ хаяг" });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe(newName);
    expect(ok.body.address).toBe("Шинэ хаяг");

    const dup = await request(app)
      .patch(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: other.name });
    expect(dup.status).toBe(409);

    const denied = await request(app)
      .patch(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${teacher.token}`)
      .send({ name: "Хакер" });
    expect(denied.status).toBe(403);
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).name).toBe(newName);
  });

  it("түвшин тогтоох хүсэлт устахгүй, зөвхөн салбартай холбоо тасарна", async () => {
    const admin = await loginAs(Role.ADMIN);
    const branch = await newBranch();
    const placement = await prisma.placementRequest.create({
      data: { studentName: "Хүсэлт", phone: "99112233", branchId: branch.id },
    });

    const res = await request(app)
      .delete(`/api/v1/branches/${branch.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    const after = await prisma.placementRequest.findUniqueOrThrow({ where: { id: placement.id } });
    expect(after.branchId).toBeNull();
  });

  it("олдохгүй салбар 404", async () => {
    const admin = await loginAs(Role.ADMIN);
    const res = await request(app)
      .delete(`/api/v1/branches/${randomUUID()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it("Эрхийн матриц: багш, эцэг эх салбар устгах эрхгүй (403), нэвтрээгүй 401", async () => {
    const branch = await newBranch();
    for (const role of [Role.TEACHER, Role.PARENT]) {
      const user = await loginAs(role);
      const res = await request(app)
        .delete(`/api/v1/branches/${branch.id}`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).toBe(403);
    }
    expect((await request(app).delete(`/api/v1/branches/${branch.id}`)).status).toBe(401);
    expect(await prisma.branch.findUnique({ where: { id: branch.id } })).not.toBeNull();
  });
});

describe("ФШ-07: салбарыг идэвхгүй болгох", () => {
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  it("идэвхгүй салбар жагсаалт, нийтийн сайтаас алга болж, админд тусдаа үлдэнэ, буцааж идэвхжинэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const branch = await newBranch();

    const off = await request(app)
      .patch(`/api/v1/branches/${branch.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: false });
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);

    const ids = (rows: { id: string }[]) => rows.map((b) => b.id);
    const list = await request(app).get("/api/v1/branches").set(auth(admin.token));
    expect(ids(list.body)).not.toContain(branch.id);
    const pub = await request(app).get("/api/v1/public/branches");
    expect(ids(pub.body)).not.toContain(branch.id);
    const all = await request(app).get("/api/v1/branches?includeInactive=true").set(auth(admin.token));
    expect(ids(all.body)).toContain(branch.id);

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "branch", entityId: branch.id, action: "UPDATE_STATUS" },
    });
    expect(audit?.actorId).toBe(admin.userId);

    const on = await request(app)
      .patch(`/api/v1/branches/${branch.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: true });
    expect(on.body.isActive).toBe(true);
    const pubAgain = await request(app).get("/api/v1/public/branches");
    expect(ids(pubAgain.body)).toContain(branch.id);
  });

  it("идэвхтэй анги байвал идэвхгүй болгохгүй (409), салбар идэвхтэй хэвээр", async () => {
    const admin = await loginAs(Role.ADMIN);
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    await prisma.class.create({
      data: { teacherId: teacher.userId, branchId: branch.id, weekday: 4, startTime: "16:00" },
    });

    const res = await request(app)
      .patch(`/api/v1/branches/${branch.id}/status`)
      .set(auth(admin.token))
      .send({ isActive: false });
    expect(res.status).toBe(409);
    expect(String(res.body.type).endsWith("/branch-has-active-classes")).toBe(true);
    expect((await prisma.branch.findUniqueOrThrow({ where: { id: branch.id } })).isActive).toBe(true);
  });

  it("идэвхгүй салбарт шинэ анги нээх, түвшин тогтоох хүсэлт өгөх боломжгүй (409)", async () => {
    const admin = await loginAs(Role.ADMIN);
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });

    const klass = await request(app)
      .post("/api/v1/classes")
      .set(auth(admin.token))
      .send({ teacherId: teacher.userId, branchId: branch.id, weekday: 2, startTime: "17:00" });
    expect(klass.status).toBe(409);
    expect(String(klass.body.type).endsWith("/branch-inactive")).toBe(true);

    const placement = await request(app)
      .post("/api/v1/public/placement-requests")
      .send({ studentName: "Хүсэлт", phone: "99112233", branchId: branch.id });
    expect(placement.status).toBe(409);
  });

  it("Эрхийн матриц: багш төлөв солих эрхгүй (403), includeInactive нь багшид нөлөөлөхгүй", async () => {
    const teacher = await loginAs(Role.TEACHER);
    const branch = await newBranch();
    await prisma.branch.update({ where: { id: branch.id }, data: { isActive: false } });

    const patch = await request(app)
      .patch(`/api/v1/branches/${branch.id}/status`)
      .set(auth(teacher.token))
      .send({ isActive: true });
    expect(patch.status).toBe(403);

    const list = await request(app).get("/api/v1/branches?includeInactive=true").set(auth(teacher.token));
    expect(list.status).toBe(200);
    expect(list.body.map((b: { id: string }) => b.id)).not.toContain(branch.id);
  });
});
