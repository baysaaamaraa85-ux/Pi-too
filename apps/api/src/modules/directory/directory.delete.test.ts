import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

function phone(): string {
  return `x${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

async function loginAs(role: Role) {
  const p = phone();
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role, phone: p, passwordHash } });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  }
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: p, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

async function newTeacher() {
  const user = await prisma.user.create({
    data: { role: Role.TEACHER, phone: phone(), passwordHash: "x" },
  });
  await prisma.teacher.create({ data: { userId: user.id, fullName: "Устгах багш" } });
  return user.id;
}

async function newBranch() {
  return prisma.branch.create({
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
}

// Гэрээтэй, ангид бүртгэлтэй, эцэг эхтэй сурагч (элсэлтийн шидтэнгийн үр дүнтэй төстэй).
async function newStudentWithContract() {
  const teacherId = await newTeacher();
  const branch = await newBranch();
  const klass = await prisma.class.create({
    data: { teacherId, branchId: branch.id, weekday: 3, startTime: "18:00" },
  });
  const program = await prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1200000.00" },
  });
  const parentUser = await prisma.user.create({
    data: { role: Role.PARENT, phone: phone(), passwordHash: "x" },
  });
  await prisma.parent.create({
    data: { userId: parentUser.id, fullName: "Эцэг", phone: phone() },
  });
  const student = await prisma.student.create({
    data: { fullName: "Устгах сурагч", grade: "9" },
  });
  await prisma.parentStudent.create({ data: { parentId: parentUser.id, studentId: student.id } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId: program.id,
      price: "1200000.00",
      totalHours: "75",
      remainingHours: "75",
      leavesLeft: 3,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({
    data: { contractId: contract.id, classId: klass.id, fromDate: new Date() },
  });
  await prisma.planItem.create({ data: { contractId: contract.id, position: 1, topic: "Тэгшитгэл" } });
  return { student, contract, klass, teacherId, parentId: parentUser.id };
}

async function addAttendance(s: Awaited<ReturnType<typeof newStudentWithContract>>) {
  const startsAt = new Date(Date.now() - 3 * 24 * 3600_000);
  const lesson = await prisma.lesson.create({
    data: {
      classId: s.klass.id,
      teacherId: s.teacherId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * 3600_000),
      originalStartsAt: startsAt,
    },
  });
  await prisma.attendance.create({
    data: {
      lessonId: lesson.id,
      contractId: s.contract.id,
      marked: true,
      status: "PRESENT",
      updatedBy: s.teacherId,
    },
  });
}

describe("ФБШ-12: багш устгах (зөвхөн түүхгүй бол)", () => {
  it("түүхгүй багш болон түүний данс устаж, аудитад бичигдэнэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const id = await newTeacher();
    await prisma.refreshToken.create({
      data: { userId: id, tokenHash: randomUUID(), expiresAt: new Date(Date.now() + 3600_000) },
    });

    const res = await request(app)
      .delete(`/api/v1/teachers/${id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    expect(await prisma.teacher.findUnique({ where: { userId: id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id } })).toBeNull();
    const audit = await prisma.auditLog.findFirst({
      where: { entity: "teacher", entityId: id, action: "DELETE" },
    });
    expect(audit?.actorId).toBe(admin.userId);
  });

  it("ФШ-06: анги заасан багш 409 (teacher-has-history), багш хэвээр үлдэнэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const s = await newStudentWithContract();

    const res = await request(app)
      .delete(`/api/v1/teachers/${s.teacherId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
    expect(String(res.body.type).endsWith("/teacher-has-history")).toBe(true);
    expect(res.body.detail).toContain("Идэвхгүй болгох");
    expect(await prisma.teacher.findUnique({ where: { userId: s.teacherId } })).not.toBeNull();
  });

  it("олдохгүй багш 404", async () => {
    const admin = await loginAs(Role.ADMIN);
    const res = await request(app)
      .delete(`/api/v1/teachers/${randomUUID()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it("Эрхийн матриц: багш өөрийгөө болон бусдыг устгах эрхгүй (403), нэвтрээгүй 401", async () => {
    const teacher = await loginAs(Role.TEACHER);
    const other = await newTeacher();
    for (const id of [teacher.userId, other]) {
      const res = await request(app)
        .delete(`/api/v1/teachers/${id}`)
        .set("Authorization", `Bearer ${teacher.token}`);
      expect(res.status).toBe(403);
    }
    expect((await request(app).delete(`/api/v1/teachers/${other}`)).status).toBe(401);
    expect(await prisma.teacher.findUnique({ where: { userId: other } })).not.toBeNull();
  });
});

describe("ФБШ-12, ФБШ-24: сурагч устгах (ирц, төлбөргүй бол)", () => {
  it("ирц, төлбөргүй сурагч гэрээ, бүртгэл, төлөвлөгөөтэйгээ устаж, эцэг эх үлдэнэ", async () => {
    const admin = await loginAs(Role.ADMIN);
    const s = await newStudentWithContract();

    const res = await request(app)
      .delete(`/api/v1/students/${s.student.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);

    expect(await prisma.student.findUnique({ where: { id: s.student.id } })).toBeNull();
    expect(await prisma.contract.count({ where: { studentId: s.student.id } })).toBe(0);
    expect(await prisma.enrollment.count({ where: { contractId: s.contract.id } })).toBe(0);
    expect(await prisma.planItem.count({ where: { contractId: s.contract.id } })).toBe(0);
    expect(await prisma.parentStudent.count({ where: { studentId: s.student.id } })).toBe(0);
    // Эцэг эхийн данс, анги, багш хэвээр.
    expect(await prisma.parent.findUnique({ where: { userId: s.parentId } })).not.toBeNull();
    expect(await prisma.class.findUnique({ where: { id: s.klass.id } })).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "student", entityId: s.student.id, action: "DELETE" },
    });
    expect(audit?.actorId).toBe(admin.userId);
  });

  it("сурагчийн нэвтрэх данстай бол данс нь хамт устна", async () => {
    const admin = await loginAs(Role.ADMIN);
    const s = await newStudentWithContract();
    const account = await prisma.user.create({
      data: { role: Role.STUDENT, phone: phone(), passwordHash: "x" },
    });
    await prisma.student.update({ where: { id: s.student.id }, data: { userId: account.id } });

    const res = await request(app)
      .delete(`/api/v1/students/${s.student.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(204);
    expect(await prisma.user.findUnique({ where: { id: account.id } })).toBeNull();
  });

  it("ФБШ-24: ирцтэй сурагч 409 (student-has-history), юу ч устахгүй", async () => {
    const admin = await loginAs(Role.ADMIN);
    const s = await newStudentWithContract();
    await addAttendance(s);

    const res = await request(app)
      .delete(`/api/v1/students/${s.student.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
    expect(String(res.body.type).endsWith("/student-has-history")).toBe(true);
    expect(await prisma.student.findUnique({ where: { id: s.student.id } })).not.toBeNull();
    expect(await prisma.contract.count({ where: { studentId: s.student.id } })).toBe(1);
    expect(await prisma.attendance.count({ where: { contractId: s.contract.id } })).toBe(1);
  });

  it("ФБШ-12: төлбөр бүртгэлтэй сурагч (цуцалсан ч гэсэн) 409", async () => {
    const admin = await loginAs(Role.ADMIN);
    const s = await newStudentWithContract();
    await prisma.payment.create({
      data: {
        contractId: s.contract.id,
        amount: "100000.00",
        paidAt: new Date(),
        channel: "CASH",
        status: "CANCELLED",
        cancelReason: "алдаатай",
        createdBy: admin.userId,
      },
    });

    const res = await request(app)
      .delete(`/api/v1/students/${s.student.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(409);
    expect(String(res.body.type).endsWith("/student-has-history")).toBe(true);
    expect(await prisma.student.findUnique({ where: { id: s.student.id } })).not.toBeNull();
  });

  it("олдохгүй сурагч 404", async () => {
    const admin = await loginAs(Role.ADMIN);
    const res = await request(app)
      .delete(`/api/v1/students/${randomUUID()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it("Эрхийн матриц: багш, эцэг эх сурагч устгах эрхгүй (403)", async () => {
    const s = await newStudentWithContract();
    for (const role of [Role.TEACHER, Role.PARENT]) {
      const user = await loginAs(role);
      const res = await request(app)
        .delete(`/api/v1/students/${s.student.id}`)
        .set("Authorization", `Bearer ${user.token}`);
      expect(res.status).toBe(403);
    }
    expect(await prisma.student.findUnique({ where: { id: s.student.id } })).not.toBeNull();
  });
});
