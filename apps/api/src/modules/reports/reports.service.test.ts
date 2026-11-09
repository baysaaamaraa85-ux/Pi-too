import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { ContractStatus, Role } from "../../generated/prisma/client.js";

const app = createApp();
const HOUR = 3_600_000;

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

async function loginUser(role: Role) {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: `Багш ${phone}` } });
    await prisma.teacherRate.create({
      data: { teacherId: user.id, hourlyRate: "5000.00", effectiveFrom: new Date("2026-01-01") },
    });
  }
  if (role === Role.PARENT) {
    await prisma.parent.create({ data: { userId: user.id, fullName: "Эцэг", phone } });
  }
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

const get = (token: string, path: string) =>
  request(app).get(`/api/v1${path}`).set("Authorization", `Bearer ${token}`);

let programId: string | null = null;
async function getProgramId() {
  programId ??= (
    await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" } })
  ).id;
  return programId;
}

const makeBranch = (label: string) =>
  prisma.branch.create({ data: { name: `${label} ${randomUUID().slice(0, 6)}`, address: "хаяг" } });

const makeClass = (teacherId: string, branchId: string, weekday = 1, startTime = "09:00") =>
  prisma.class.create({ data: { teacherId, branchId, weekday, startTime, durationMin: 120, capacity: 6 } });

async function makeContract(
  classId: string | null,
  opts: { studentId?: string; status?: ContractStatus; remaining?: number; createdAt?: Date } = {},
) {
  const studentId =
    opts.studentId ?? (await prisma.student.create({ data: { fullName: `Сурагч ${randomUUID().slice(0, 6)}` } })).id;
  const contract = await prisma.contract.create({
    data: {
      studentId,
      programId: await getProgramId(),
      price: "500000.00",
      totalVisits: 25,
      remainingVisits: opts.remaining ?? 25,
      leavesLeft: 3,
      status: opts.status ?? ContractStatus.ACTIVE,
      rulesAckAt: new Date(),
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
  if (classId) {
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId, fromDate: new Date("2026-01-01") },
    });
  }
  return { contract, studentId };
}

describe("М11 Админы самбар (ФШ-68)", () => {
  it("ФШ-68: өртэй гэрээний тоо, нийт өр нь /debts-тэй, сөрөг үлдэгдэлтэй багшийн тоо цалингийн хуудастай таарна", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    const branch = await makeBranch("Самбар");
    const cls = await makeClass(teacher.userId, branch.id);
    await makeContract(cls.id);
    await makeContract(cls.id);
    // Багшид 50 000 ₮ илүү олгосон: үлдэгдэл -50 000 (ФШ-57).
    await prisma.ledgerEntry.create({
      data: { teacherId: teacher.userId, type: "PAYOUT", amount: "-50000.00", createdBy: admin.userId },
    });

    const dash = await get(admin.token, "/dashboard");
    expect(dash.status).toBe(200);
    expect(dash.body.role).toBe("ADMIN");

    const debts = await get(admin.token, "/debts?limit=1");
    expect(dash.body.debts).toEqual({ count: debts.body.total, totalDebt: debts.body.totalDebt });
    expect(dash.body.debts.count).toBeGreaterThanOrEqual(2);

    const summary = await get(admin.token, "/payroll/summary");
    const negatives = (summary.body as { balance: string }[]).filter((r) => Number(r.balance) < 0);
    expect(dash.body.negativeTeachers.count).toBe(negatives.length);
    expect(dash.body.negativeTeachers.count).toBeGreaterThanOrEqual(1);
    expect(Number(dash.body.negativeTeachers.totalNegative)).toBeLessThanOrEqual(-50000);
    expect(Array.isArray(dash.body.todayLessons)).toBe(true);
  });

  it("Эрхийн матриц: эцэг эх, сурагч самбар, тайлан, аудитыг харахад 403", async () => {
    const parent = await loginUser(Role.PARENT);
    for (const path of ["/dashboard", "/reports/monthly?month=2027-05", "/audit-log"]) {
      expect((await get(parent.token, path)).status, path).toBe(403);
    }
    const teacher = await loginUser(Role.TEACHER);
    expect((await get(teacher.token, "/reports/monthly?month=2027-05")).status).toBe(403);
    expect((await get(teacher.token, "/audit-log")).status).toBe(403);
  });
});

describe("М11 Багшийн самбар (ФШ-70, 43)", () => {
  it("ФШ-70: ирц бөглөөгүй хичээл жагсаалтад гарч, ирц хадгалмагц тэр дороо хасагдана", async () => {
    const teacher = await loginUser(Role.TEACHER);
    const branch = await makeBranch("Багшийн самбар");
    const cls = await makeClass(teacher.userId, branch.id);
    const endsAt = new Date(Date.now() - HOUR);
    const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
    const lesson = await prisma.lesson.create({
      data: { classId: cls.id, teacherId: teacher.userId, startsAt, endsAt, originalStartsAt: startsAt },
    });
    const { contract } = await makeContract(cls.id);

    const before = await get(teacher.token, "/dashboard");
    expect(before.status).toBe(200);
    expect(before.body.role).toBe("TEACHER");
    const ids = (before.body.unfilledLessons as { id: string }[]).map((l) => l.id);
    expect(ids).toContain(lesson.id);

    const save = await request(app)
      .put(`/api/v1/lessons/${lesson.id}/attendance`)
      .set("Authorization", `Bearer ${teacher.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ entries: [{ contractId: contract.id, present: true }] });
    expect(save.status).toBe(200);

    const after = await get(teacher.token, "/dashboard");
    expect((after.body.unfilledLessons as { id: string }[]).map((l) => l.id)).not.toContain(lesson.id);
  });

  it("ФШ-70: сурагчгүй хичээл, бусад багшийн хичээл, цуцлагдсан хичээл ирц бөглөөгүйд орохгүй", async () => {
    const teacher = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const branch = await makeBranch("Хоосон");
    const emptyClass = await makeClass(teacher.userId, branch.id, 2);
    const otherClass = await makeClass(other.userId, branch.id, 3);
    const cancelledClass = await makeClass(teacher.userId, branch.id, 4);
    await makeContract(otherClass.id);
    await makeContract(cancelledClass.id);
    const mk = async (classId: string, teacherId: string, status: "SCHEDULED" | "CANCELLED") => {
      const endsAt = new Date(Date.now() - 2 * HOUR);
      const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
      return prisma.lesson.create({
        data: { classId, teacherId, startsAt, endsAt, originalStartsAt: startsAt, status },
      });
    };
    const empty = await mk(emptyClass.id, teacher.userId, "SCHEDULED");
    const foreign = await mk(otherClass.id, other.userId, "SCHEDULED");
    const cancelled = await mk(cancelledClass.id, teacher.userId, "CANCELLED");

    const dash = await get(teacher.token, "/dashboard");
    const ids = (dash.body.unfilledLessons as { id: string }[]).map((l) => l.id);
    expect(ids).not.toContain(empty.id);
    expect(ids).not.toContain(foreign.id);
    expect(ids).not.toContain(cancelled.id);
  });

  it("Багшийн самбарын үзүүлэлт: нэр, сурагчийн тоо, энэ сарын хичээл, ирцийн хувь, сарын дундаж дүн", async () => {
    const teacher = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const branch = await makeBranch("Үзүүлэлт");
    const cls = await makeClass(teacher.userId, branch.id);
    const a = await makeContract(cls.id);
    const b = await makeContract(cls.id);
    await makeContract(cls.id, { status: ContractStatus.COMPLETED }); // идэвхгүй гэрээ тооцогдохгүй
    const startsAt = new Date();
    const lesson = await prisma.lesson.create({
      data: { classId: cls.id, teacherId: teacher.userId, startsAt, endsAt: new Date(startsAt.getTime() + 2 * HOUR), originalStartsAt: startsAt },
    });
    await prisma.attendance.createMany({
      data: [
        { lessonId: lesson.id, contractId: a.contract.id, marked: true, status: "PRESENT", updatedBy: teacher.userId },
        { lessonId: lesson.id, contractId: b.contract.id, marked: false, status: "OVER_LIMIT", updatedBy: teacher.userId },
      ],
    });
    const today = new Date().toISOString().slice(0, 10);
    await prisma.assessment.createMany({
      data: [
        { studentId: a.studentId, contractId: a.contract.id, type: "QUIZ", takenOn: new Date(today), totalPercent: "80.00" },
        { studentId: b.studentId, contractId: b.contract.id, type: "QUIZ", takenOn: new Date(today), totalPercent: "60.00" },
      ],
    });

    const dash = await get(teacher.token, "/dashboard");
    expect(dash.status).toBe(200);
    expect(dash.body.teacherName).toBe((await prisma.teacher.findUniqueOrThrow({ where: { userId: teacher.userId } })).fullName);
    expect(dash.body.stats).toEqual({ students: 2, lessonsThisMonth: 1, attendancePercent: "50.0" });
    const last = (dash.body.progress as { month: string; averagePercent: string }[]).at(-1)!;
    expect(last).toEqual({ month: today.slice(0, 7), averagePercent: "70.0" });

    // Өөр багшид эдгээр тоо огт нөлөөлөхгүй.
    const empty = await get(other.token, "/dashboard");
    expect(empty.body.stats).toEqual({ students: 0, lessonsThisMonth: 0, attendancePercent: null });
    expect(empty.body.progress).toEqual([]);
  });

  it("ФШ-43, 70: эцэг эхтэй уулзах сануулга биелэх хүртэл багшийн самбарт харагдана", async () => {
    const teacher = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    const branch = await makeBranch("Сануулга");
    const cls = await makeClass(teacher.userId, branch.id);
    const { contract, studentId } = await makeContract(cls.id);
    const task = await prisma.teacherTask.create({
      data: { teacherId: teacher.userId, type: "MEETING", contractId: contract.id, dueOn: new Date() },
    });

    const dash = await get(teacher.token, "/dashboard");
    const found = (dash.body.tasks as { id: string; type: string; studentId: string }[]).find((t) => t.id === task.id);
    expect(found).toMatchObject({ type: "MEETING", studentId });
    // Өөр багшид харагдахгүй.
    const foreign = await get(other.token, "/dashboard");
    expect((foreign.body.tasks as { id: string }[]).map((t) => t.id)).not.toContain(task.id);

    await prisma.teacherTask.update({ where: { id: task.id }, data: { doneAt: new Date() } });
    const done = await get(teacher.token, "/dashboard");
    expect((done.body.tasks as { id: string }[]).map((t) => t.id)).not.toContain(task.id);
  });
});

describe("М11 Сарын тайлан (ФШ-69)", () => {
  it("ФШ-69: салбар бүрийн сурагч, ирцийн хувь, орсон төлбөр, өр, цалингийн зардал, багц үргэлжлүүлсэн хувь; нийлбэр байгууллагатай тэнцүү", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacherA = await loginUser(Role.TEACHER);
    const teacherB = await loginUser(Role.TEACHER);
    const branchA = await makeBranch("Тайлан А");
    const branchB = await makeBranch("Тайлан Б");
    const clsA = await makeClass(teacherA.userId, branchA.id);
    const clsB = await makeClass(teacherB.userId, branchB.id);

    // 2027.05 сар: бусад тестэд өгөгдөл байхгүй.
    const lessonAt = (classId: string, teacherId: string, day: number) => {
      const startsAt = new Date(Date.UTC(2027, 4, day, 2, 0, 0)); // 10:00 Улаанбаатар
      return prisma.lesson.create({
        data: { classId, teacherId, startsAt, endsAt: new Date(startsAt.getTime() + 2 * HOUR), originalStartsAt: startsAt },
      });
    };
    const mark = (lessonId: string, contractId: string, teacherId: string, status: "PRESENT" | "EXCUSED" | "OVER_LIMIT") =>
      prisma.attendance.create({
        data: { lessonId, contractId, marked: status === "PRESENT", status, updatedBy: teacherId },
      });

    // Салбар А: сурагч sA нэг дууссан багц (дараа нь шинэ багц авсан), нэг идэвхтэй багц.
    const a1 = await makeContract(clsA.id, { status: ContractStatus.COMPLETED, remaining: 0, createdAt: new Date("2026-01-01") });
    const a2 = await makeContract(clsA.id, { studentId: a1.studentId });
    const lA1 = await lessonAt(clsA.id, teacherA.userId, 10);
    const lA2 = await lessonAt(clsA.id, teacherA.userId, 11);
    const lA3 = await lessonAt(clsA.id, teacherA.userId, 12);
    const attA1 = await mark(lA1.id, a1.contract.id, teacherA.userId, "PRESENT");
    await mark(lA2.id, a1.contract.id, teacherA.userId, "PRESENT");
    await mark(lA3.id, a2.contract.id, teacherA.userId, "EXCUSED");
    // Цалин: 10 000 олсон, 2 500 хасагдсан, 5 000 олгосон (олголт зардал биш).
    await prisma.ledgerEntry.createMany({
      data: [
        { teacherId: teacherA.userId, type: "EARNING", amount: "10000.00", lessonId: lA1.id, attendanceId: attA1.id, createdBy: admin.userId },
        { teacherId: teacherA.userId, type: "ADJUSTMENT", amount: "-2500.00", lessonId: lA1.id, attendanceId: attA1.id, createdBy: admin.userId },
        { teacherId: teacherA.userId, type: "PAYOUT", amount: "-5000.00", createdBy: admin.userId },
      ],
    });
    // Төлбөр: сард 100 000, өмнөх сард 40 000, цуцалсан 50 000 (тооцохгүй).
    await prisma.payment.createMany({
      data: [
        { contractId: a2.contract.id, amount: "100000.00", paidAt: new Date("2027-05-12"), channel: "BANK_TRANSFER", createdBy: admin.userId },
        { contractId: a2.contract.id, amount: "40000.00", paidAt: new Date("2027-04-30"), channel: "BANK_TRANSFER", createdBy: admin.userId },
        { contractId: a2.contract.id, amount: "50000.00", paidAt: new Date("2027-05-13"), channel: "CASH", status: "CANCELLED", cancelReason: "алдаа", createdBy: admin.userId },
      ],
    });

    // Салбар Б: дууссан багц, үргэлжлүүлээгүй.
    const b1 = await makeContract(clsB.id, { status: ContractStatus.COMPLETED, remaining: 0, createdAt: new Date("2026-02-01") });
    const lB1 = await lessonAt(clsB.id, teacherB.userId, 10);
    const lB2 = await lessonAt(clsB.id, teacherB.userId, 11);
    const attB1 = await mark(lB1.id, b1.contract.id, teacherB.userId, "PRESENT");
    await mark(lB2.id, b1.contract.id, teacherB.userId, "OVER_LIMIT");
    await prisma.ledgerEntry.create({
      data: { teacherId: teacherB.userId, type: "EARNING", amount: "5000.00", lessonId: lB1.id, attendanceId: attB1.id, createdBy: admin.userId },
    });

    const res = await get(admin.token, "/reports/monthly?month=2027-05");
    expect(res.status).toBe(200);
    type Row = {
      branchId: string | null;
      activeStudents: number;
      attendanceTotal: number;
      attendanceAttended: number;
      attendancePercent: string | null;
      paymentsReceived: string;
      totalDebt: string;
      payrollCost: string;
      completedContracts: number;
      continuedContracts: number;
      continuationPercent: string | null;
    };
    const rows = res.body.branches as Row[];
    const rowA = rows.find((r) => r.branchId === branchA.id)!;
    const rowB = rows.find((r) => r.branchId === branchB.id)!;

    expect(rowA).toMatchObject({
      activeStudents: 1,
      attendanceTotal: 3,
      attendanceAttended: 2,
      attendancePercent: "66.7",
      paymentsReceived: "100000.00",
      totalDebt: "860000.00", // 500 000 (дууссан, төлөөгүй) + 500 000 - 140 000
      payrollCost: "7500.00",
      completedContracts: 1,
      continuedContracts: 1,
      continuationPercent: "100.0",
    });
    expect(rowB).toMatchObject({
      activeStudents: 1,
      attendanceTotal: 2,
      attendanceAttended: 1,
      attendancePercent: "50.0",
      paymentsReceived: "0.00",
      totalDebt: "500000.00",
      payrollCost: "5000.00",
      completedContracts: 1,
      continuedContracts: 0,
      continuationPercent: "0.0",
    });

    // Салбаруудын нийлбэр = байгууллага.
    const sum = (pick: (r: Row) => number) => rows.reduce((s, r) => s + pick(r), 0);
    const total = res.body.total as Row;
    expect(total.activeStudents).toBe(sum((r) => r.activeStudents));
    expect(total.attendanceTotal).toBe(sum((r) => r.attendanceTotal));
    expect(total.attendanceAttended).toBe(sum((r) => r.attendanceAttended));
    expect(total.completedContracts).toBe(sum((r) => r.completedContracts));
    expect(total.continuedContracts).toBe(sum((r) => r.continuedContracts));
    for (const key of ["paymentsReceived", "totalDebt", "payrollCost"] as const) {
      const cents = rows.reduce((s, r) => s + Math.round(Number(r[key]) * 100), 0);
      expect(Math.round(Number(total[key]) * 100), key).toBe(cents);
    }

    // Нийт өр /debts-ийн нийт өртэй яг тэнцүү.
    const debts = await get(admin.token, "/debts?limit=1");
    expect(total.totalDebt).toBe(debts.body.totalDebt);
  });

  it("ФШ-69: сар буруу хэлбэртэй бол 422, өгөгдөлгүй сард бүх утга 0, хувь null", async () => {
    const admin = await loginUser(Role.ADMIN);
    expect((await get(admin.token, "/reports/monthly?month=2027-13")).status).toBe(422);
    expect((await get(admin.token, "/reports/monthly")).status).toBe(422);

    const empty = await get(admin.token, "/reports/monthly?month=2031-01");
    expect(empty.status).toBe(200);
    expect(empty.body.total).toMatchObject({
      activeStudents: 0,
      attendanceTotal: 0,
      attendancePercent: null,
      paymentsReceived: "0.00",
      payrollCost: "0.00",
      continuationPercent: null,
    });
  });
});

describe("Аудитын бүртгэл", () => {
  it("админ аудитыг entity, үйлдэл, хийсэн хүн, огноогоор шүүж хуудаслан харна", async () => {
    const admin = await loginUser(Role.ADMIN);
    const marker = randomUUID();
    await prisma.auditLog.createMany({
      data: [
        { entity: "test-entity", entityId: marker, action: "CREATE", actorId: admin.userId },
        { entity: "test-entity", entityId: marker, action: "UPDATE", reason: "засвар", actorId: admin.userId },
        { entity: "other-entity", entityId: marker, action: "CREATE", actorId: admin.userId },
      ],
    });
    const byEntity = await get(admin.token, "/audit-log?entity=test-entity&limit=100");
    expect(byEntity.status).toBe(200);
    const mine = (byEntity.body.items as { entityId: string; action: string }[]).filter((i) => i.entityId === marker);
    expect(mine.map((i) => i.action).sort()).toEqual(["CREATE", "UPDATE"]);

    const byAction = await get(admin.token, "/audit-log?entity=test-entity&action=UPDATE&limit=100");
    const updates = (byAction.body.items as { entityId: string; reason: string | null }[]).filter((i) => i.entityId === marker);
    expect(updates).toHaveLength(1);
    expect(updates[0]!.reason).toBe("засвар");

    const phone = (await prisma.user.findUniqueOrThrow({ where: { id: admin.userId } })).phone!;
    const byActor = await get(admin.token, `/audit-log?actor=${phone}&limit=100`);
    expect((byActor.body.items as { entityId: string }[]).some((i) => i.entityId === marker)).toBe(true);

    const today = new Date().toISOString().slice(0, 10);
    const inRange = await get(admin.token, `/audit-log?entity=other-entity&from=${today}&to=${today}&limit=100`);
    expect((inRange.body.items as { entityId: string }[]).some((i) => i.entityId === marker)).toBe(true);
    const pastOnly = await get(admin.token, "/audit-log?entity=other-entity&from=2020-01-01&to=2020-01-02&limit=100");
    expect(pastOnly.body.items).toEqual([]);

    const paged = await get(admin.token, "/audit-log?limit=1&page=1");
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBeGreaterThanOrEqual(3);
  });
});
