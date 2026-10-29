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
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role, phone, passwordHash } });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: `Багш ${phone}` } });
  }
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

async function loginTeacher(withRate = true) {
  const t = await loginUser(Role.TEACHER);
  if (withRate) {
    await prisma.teacherRate.create({
      data: { teacherId: t.userId, hourlyRate: "5000.00", effectiveFrom: new Date("2026-01-01") },
    });
  }
  return t;
}

let branchId: string | null = null;
async function getBranchId() {
  branchId ??= (
    await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } })
  ).id;
  return branchId;
}

let programId: string | null = null;
async function getProgramId() {
  programId ??= (
    await prisma.program.create({
      data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
    })
  ).id;
  return programId;
}

async function makeClass(teacherId: string, startTime = "09:00") {
  return prisma.class.create({
    data: { teacherId, branchId: await getBranchId(), weekday: 1, startTime, durationMin: 120, capacity: 6 },
  });
}

// Хичээл endedHoursAgo цагийн өмнө 120 минутын турш дууссан.
async function makeLesson(classId: string, teacherId: string, endedHoursAgo: number) {
  const endsAt = new Date(Date.now() - endedHoursAgo * HOUR);
  const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
  return prisma.lesson.create({
    data: { classId, teacherId, startsAt, endsAt, originalStartsAt: startsAt },
  });
}

async function makeContract(
  classId: string | null,
  opts: {
    remaining?: number;
    leaves?: number;
    status?: ContractStatus;
    reviews?: number;
    name?: string;
    withParent?: boolean;
  } = {},
) {
  const student = await prisma.student.create({
    data: { fullName: opts.name ?? `Сурагч ${randomUUID().slice(0, 6)}` },
  });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId: await getProgramId(),
      price: "500000.00",
      totalVisits: 25,
      remainingVisits: opts.remaining ?? 25,
      leavesLeft: opts.leaves ?? 3,
      freeReviewsLeft: opts.reviews ?? 0,
      status: opts.status ?? ContractStatus.ACTIVE,
      rulesAckAt: new Date(),
    },
  });
  if (classId) {
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId, fromDate: new Date("2026-01-01") },
    });
  }
  let parentId: string | null = null;
  if (opts.withParent) {
    const parentPhone = phone8();
    const user = await prisma.user.create({
      data: { role: Role.PARENT, phone: parentPhone, passwordHash: "x" },
    });
    await prisma.parent.create({
      data: { userId: user.id, fullName: "Эцэг", phone: parentPhone },
    });
    await prisma.parentStudent.create({ data: { parentId: user.id, studentId: student.id } });
    parentId = user.id;
  }
  return { contract, student, parentId };
}

async function fixture(n: number, opts: { endedHoursAgo?: number; withRate?: boolean } = {}) {
  const teacher = await loginTeacher(opts.withRate ?? true);
  const cls = await makeClass(teacher.userId);
  const lesson = await makeLesson(cls.id, teacher.userId, opts.endedHoursAgo ?? 1);
  const contracts = [];
  for (let i = 0; i < n; i++) contracts.push(await makeContract(cls.id, { withParent: true }));
  return { teacher, cls, lesson, contracts };
}

function put(token: string, lessonId: string, entries: { contractId: string; present: boolean }[], extra: object = {}, key = randomUUID()) {
  return request(app)
    .put(`/api/v1/lessons/${lessonId}/attendance`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send({ entries, ...extra });
}

function patch(token: string, id: string, body: object) {
  return request(app).patch(`/api/v1/attendance/${id}`).set("Authorization", `Bearer ${token}`).send(body);
}

async function reload(contractId: string) {
  return prisma.contract.findUniqueOrThrow({ where: { id: contractId } });
}

async function ledgerFor(lessonId: string) {
  return prisma.ledgerEntry.findMany({ where: { lessonId }, orderBy: { createdAt: "asc" } });
}

describe("М5 Ирц бүртгэх (ФШ-26...37)", () => {
  it("ФШ-27, 32, 53: 4 сурагч ирвэл багц тус бүр 1 хасагдаж, цалин 5 000 x 4 x 2 = 40 000", async () => {
    const f = await fixture(4);
    const res = await put(
      f.teacher.token,
      f.lesson.id,
      f.contracts.map((c) => ({ contractId: c.contract.id, present: true })),
    );
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(4);
    for (const entry of res.body.entries) {
      expect(entry.status).toBe("PRESENT");
      expect(entry.remainingVisits).toBe(24);
    }
    const ledger = await ledgerFor(f.lesson.id);
    expect(ledger).toHaveLength(4);
    expect(ledger.every((l) => l.type === "EARNING" && l.attendanceId !== null)).toBe(true);
    const total = ledger.reduce((sum, l) => sum + Number(l.amount), 0);
    expect(total).toBe(40000);
  });

  it("ФШ-28: чөлөөний эрх 1 үед ирээгүй бол Чөлөөтэй, эрх 0 болно, багц хэвээр, цалин үүсэхгүй", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { leaves: 1, remaining: 10 });
    const res = await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: false }]);
    expect(res.status).toBe(200);
    expect(res.body.entries[0].status).toBe("EXCUSED");
    const after = await reload(c.contract.id);
    expect(after.leavesLeft).toBe(0);
    expect(after.remainingVisits).toBe(10);
    expect(await ledgerFor(f.lesson.id)).toHaveLength(0);
  });

  it("ФШ-29: чөлөөний эрх 0 үед Чөлөө хэтэрсэн болж багцаас хасагдаж, цалинд тооцогдоно", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { leaves: 0, remaining: 10 });
    const res = await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: false }]);
    expect(res.body.entries[0].status).toBe("OVER_LIMIT");
    const after = await reload(c.contract.id);
    expect(after.remainingVisits).toBe(9);
    expect(after.leavesLeft).toBe(0);
    const ledger = await ledgerFor(f.lesson.id);
    expect(ledger).toHaveLength(1);
    expect(Number(ledger[0]?.amount)).toBe(10000);
  });

  it("ФШ-29, ADR-007: клиентийн илгээсэн төлвийг үл хүлээн авна (сервер тооцно)", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { leaves: 0, remaining: 10 });
    const res = await put(f.teacher.token, f.lesson.id, [
      { contractId: c.contract.id, present: false, status: "EXCUSED" } as never,
    ]);
    expect(res.body.entries[0].status).toBe("OVER_LIMIT");
  });

  it("ФШ-33: 23 цагийн дараа багш бүртгэнэ, 25 цагийн дараа багшид хаалттай, админ шалтгаантай бүртгэнэ", async () => {
    const ok = await fixture(1, { endedHoursAgo: 23 });
    const inside = await put(ok.teacher.token, ok.lesson.id, [
      { contractId: ok.contracts[0]!.contract.id, present: true },
    ]);
    expect(inside.status).toBe(200);

    const late = await fixture(1, { endedHoursAgo: 25 });
    const entries = [{ contractId: late.contracts[0]!.contract.id, present: true }];
    const denied = await put(late.teacher.token, late.lesson.id, entries);
    expect(denied.status).toBe(409);
    expect(denied.body.type).toContain("attendance-window-closed");

    const admin = await loginUser(Role.ADMIN);
    const noReason = await put(admin.token, late.lesson.id, entries);
    expect(noReason.status).toBe(409);
    expect(noReason.body.type).toContain("reason-required");
    const withReason = await put(admin.token, late.lesson.id, entries, { reason: "Багш мартсан" });
    expect(withReason.status).toBe(200);
  });

  it("ФШ-33: эхлээгүй хичээл, цуцлагдсан хичээлд ирц бүртгэгдэхгүй", async () => {
    const f = await fixture(1);
    const future = new Date(Date.now() + 5 * HOUR);
    const upcoming = await prisma.lesson.create({
      data: {
        classId: f.cls.id,
        teacherId: f.teacher.userId,
        startsAt: future,
        endsAt: new Date(future.getTime() + 2 * HOUR),
        originalStartsAt: future,
      },
    });
    const entries = [{ contractId: f.contracts[0]!.contract.id, present: true }];
    const early = await put(f.teacher.token, upcoming.id, entries);
    expect(early.body.type).toContain("lesson-not-started");

    await prisma.lesson.update({ where: { id: f.lesson.id }, data: { status: "CANCELLED" } });
    const cancelled = await put(f.teacher.token, f.lesson.id, entries);
    expect(cancelled.body.type).toContain("lesson-cancelled");
  });

  it("ФШ-36: үлдэгдэл 4-өөс 3 болоход эцэг эхэд нэг л мэдэгдэл (5-аас 4 үед байхгүй)", async () => {
    const f = await fixture(0);
    const four = await makeContract(f.cls.id, { remaining: 4, withParent: true });
    const five = await makeContract(f.cls.id, { remaining: 5, withParent: true });
    await put(f.teacher.token, f.lesson.id, [
      { contractId: four.contract.id, present: true },
      { contractId: five.contract.id, present: true },
    ]);
    expect(await prisma.notificationOutbox.count({ where: { recipientId: four.parentId!, template: "package_ending" } })).toBe(1);
    expect(await prisma.notificationOutbox.count({ where: { recipientId: five.parentId!, template: "package_ending" } })).toBe(0);
    expect(await prisma.notificationOutbox.count({ where: { recipientId: four.parentId!, template: "attendance_recorded" } })).toBe(1);
  });

  it("ФШ-37: үлдэгдэл 1-ээс 0 болоход гэрээ Дууссан болж, багшид шалгалтын ажил үүснэ", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { remaining: 1 });
    await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: true }]);
    const after = await reload(c.contract.id);
    expect(after.status).toBe("COMPLETED");
    expect(after.remainingVisits).toBe(0);
    const tasks = await prisma.teacherTask.findMany({ where: { contractId: c.contract.id } });
    // 25 дахь (сүүлийн) ирэлт: шалгалтын ажил (ФШ-37) ба уулзалтын сануулга (ФШ-43).
    expect(tasks.map((t) => t.type).sort()).toEqual(["EXAM", "MEETING"]);
  });

  it("ФШ-43: гэрээний 13 дахь ирэлтэд уулзалтын сануулга үүснэ", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { remaining: 13 });
    await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: true }]);
    const tasks = await prisma.teacherTask.findMany({ where: { contractId: c.contract.id } });
    expect(tasks.map((t) => t.type)).toEqual(["MEETING"]);
  });

  it("ФШ-40: дууссан гэрээнд үнэгүй давтлагын эрхтэй бол Үнэгүй давтлага, багц цалинд нөлөөлөхгүй", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { remaining: 0, status: ContractStatus.COMPLETED, reviews: 3 });
    const res = await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: true }]);
    expect(res.body.entries[0].status).toBe("FREE_REVIEW");
    const after = await reload(c.contract.id);
    expect(after.freeReviewsLeft).toBe(2);
    expect(after.remainingVisits).toBe(0);
    expect(await ledgerFor(f.lesson.id)).toHaveLength(0);
  });

  it("ФШ-73: түр зогсоосон гэрээ ирцийн дэлгэцэд гарахгүй, ирц бүртгэгдэхгүй", async () => {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { status: ContractStatus.PAUSED, remaining: 12 });
    const sheet = await request(app)
      .get(`/api/v1/lessons/${f.lesson.id}/attendance`)
      .set("Authorization", `Bearer ${f.teacher.token}`);
    expect(sheet.status).toBe(200);
    expect(sheet.body.rows).toHaveLength(0);
    const res = await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: true }]);
    expect(res.status).toBe(409);
    expect((await reload(c.contract.id)).remainingVisits).toBe(12);
  });

  it("ФБШ-15: ижил Idempotency-Key-ээр давтан илгээхэд багц нэг л удаа хасагдана", async () => {
    const f = await fixture(1);
    const entries = [{ contractId: f.contracts[0]!.contract.id, present: true }];
    const key = randomUUID();
    const first = await put(f.teacher.token, f.lesson.id, entries, {}, key);
    const second = await put(f.teacher.token, f.lesson.id, entries, {}, key);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect((await reload(f.contracts[0]!.contract.id)).remainingVisits).toBe(24);
    expect(await prisma.attendance.count({ where: { lessonId: f.lesson.id } })).toBe(1);
  });

  it("ФБШ-15: Idempotency-Key байхгүй бол 422", async () => {
    const f = await fixture(1);
    const res = await request(app)
      .put(`/api/v1/lessons/${f.lesson.id}/attendance`)
      .set("Authorization", `Bearer ${f.teacher.token}`)
      .send({ entries: [{ contractId: f.contracts[0]!.contract.id, present: true }] });
    expect(res.status).toBe(422);
  });

  it("ЧХ-1: хоёр багшийн хичээлд нэг сурагчийн ирц зэрэг бүртгэхэд үлдэгдэл яг 2 хасагдана", async () => {
    const t1 = await loginTeacher();
    const t2 = await loginTeacher();
    const cls1 = await makeClass(t1.userId);
    const cls2 = await makeClass(t2.userId);
    const lesson1 = await makeLesson(cls1.id, t1.userId, 1);
    const lesson2 = await makeLesson(cls2.id, t2.userId, 1);
    const c = await makeContract(cls1.id, { remaining: 10 });
    await prisma.enrollment.create({
      data: { contractId: c.contract.id, classId: cls2.id, fromDate: new Date("2026-01-01") },
    });

    const entries = [{ contractId: c.contract.id, present: true }];
    const [a, b] = await Promise.all([
      put(t1.token, lesson1.id, entries),
      put(t2.token, lesson2.id, entries),
    ]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await reload(c.contract.id)).remainingVisits).toBe(8);
  });

  it("ЧХ-2, ФШ-32: цалин бичихэд алдаа гарвал ирц, багц, чөлөөний өөрчлөлт бүгд буцна (зөрүү 0)", async () => {
    // Үнэлгээгүй багш: цалингийн мөр бичигдэхгүй, транзакц дундаа унана.
    const f = await fixture(2, { withRate: false });
    const res = await put(
      f.teacher.token,
      f.lesson.id,
      f.contracts.map((c) => ({ contractId: c.contract.id, present: true })),
    );
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("teacher-rate-not-configured");
    expect(await prisma.attendance.count({ where: { lessonId: f.lesson.id } })).toBe(0);
    for (const c of f.contracts) {
      expect((await reload(c.contract.id)).remainingVisits).toBe(25);
    }
    expect(await ledgerFor(f.lesson.id)).toHaveLength(0);
    expect(await prisma.notificationOutbox.count({ where: { recipientId: f.contracts[0]!.parentId! } })).toBe(0);
  });
});

describe("М5 Ирц засах (ФШ-33, 34, 35, Хүснэгт 3.15)", () => {
  async function savedOne(opts: { leaves: number; present: boolean; remaining?: number }) {
    const f = await fixture(0);
    const c = await makeContract(f.cls.id, { leaves: opts.leaves, remaining: opts.remaining ?? 10 });
    const saved = await put(f.teacher.token, f.lesson.id, [
      { contractId: c.contract.id, present: opts.present },
    ]);
    return { f, c, attendanceId: saved.body.entries[0].attendanceId as string };
  }

  it("Хүснэгт 3.15 (1): Ирсэн -> Ирээгүй, эрх үлдсэн: Чөлөөтэй, багц 1 буцаж нэмэгдэж, эрх 1 хасагдаж, сөрөг ADJUSTMENT", async () => {
    const { f, c, attendanceId } = await savedOne({ leaves: 3, present: true });
    const res = await patch(f.teacher.token, attendanceId, { present: false });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("EXCUSED");
    const after = await reload(c.contract.id);
    expect(after.remainingVisits).toBe(10);
    expect(after.leavesLeft).toBe(2);
    const ledger = await ledgerFor(f.lesson.id);
    expect(ledger.map((l) => [l.type, Number(l.amount)])).toEqual([
      ["EARNING", 10000],
      ["ADJUSTMENT", -10000],
    ]);
  });

  it("Хүснэгт 3.15 (2): Ирсэн -> Ирээгүй, эрх дууссан: Чөлөө хэтэрсэн, багц, эрх, цалин өөрчлөгдөхгүй", async () => {
    const { f, c, attendanceId } = await savedOne({ leaves: 0, present: true });
    const res = await patch(f.teacher.token, attendanceId, { present: false });
    expect(res.body.status).toBe("OVER_LIMIT");
    const after = await reload(c.contract.id);
    expect(after.remainingVisits).toBe(9);
    expect(after.leavesLeft).toBe(0);
    expect(await ledgerFor(f.lesson.id)).toHaveLength(1);
  });

  it("Хүснэгт 3.15 (3): Чөлөөтэй -> Ирсэн: багц 1 хасагдаж, эрх 1 буцаж нэмэгдэж, эерэг ADJUSTMENT", async () => {
    const { f, c, attendanceId } = await savedOne({ leaves: 2, present: false });
    const res = await patch(f.teacher.token, attendanceId, { present: true });
    expect(res.body.status).toBe("PRESENT");
    const after = await reload(c.contract.id);
    expect(after.remainingVisits).toBe(9);
    expect(after.leavesLeft).toBe(2);
    const ledger = await ledgerFor(f.lesson.id);
    expect(ledger.map((l) => [l.type, Number(l.amount)])).toEqual([["ADJUSTMENT", 10000]]);
  });

  it("Хүснэгт 3.15 (4): Чөлөө хэтэрсэн -> Ирсэн: багц, эрх, цалин өөрчлөгдөхгүй", async () => {
    const { f, c, attendanceId } = await savedOne({ leaves: 0, present: false });
    const res = await patch(f.teacher.token, attendanceId, { present: true });
    expect(res.body.status).toBe("PRESENT");
    const after = await reload(c.contract.id);
    expect(after.remainingVisits).toBe(9);
    expect(await ledgerFor(f.lesson.id)).toHaveLength(1);
  });

  it("ФШ-37, 3.8.2: үлдэгдэл 0-ээс 1 болоход гэрээ дахин Идэвхтэй болно", async () => {
    const { f, c, attendanceId } = await savedOne({ leaves: 3, present: true, remaining: 1 });
    expect((await reload(c.contract.id)).status).toBe("COMPLETED");
    await patch(f.teacher.token, attendanceId, { present: false });
    const after = await reload(c.contract.id);
    expect(after.status).toBe("ACTIVE");
    expect(after.remainingVisits).toBe(1);
  });

  it("ФШ-34: олголтын дараа засахад олголтын мөр өөрчлөгдөхгүй, зөвхөн ADJUSTMENT нэмэгдэнэ; -50 000 + 80 000 = 30 000", async () => {
    const { f, attendanceId } = await savedOne({ leaves: 3, present: true });
    const admin = await loginUser(Role.ADMIN);
    const payout = await prisma.ledgerEntry.create({
      data: {
        teacherId: f.teacher.userId,
        type: "PAYOUT",
        amount: "-60000.00",
        createdBy: admin.userId,
      },
    });
    await patch(f.teacher.token, attendanceId, { present: false });

    const stored = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id: payout.id } });
    expect(stored.amount.toString()).toBe("-60000");
    const ledger = await prisma.ledgerEntry.findMany({ where: { teacherId: f.teacher.userId } });
    expect(ledger.filter((l) => l.type === "ADJUSTMENT")).toHaveLength(1);
    // Олсон 10 000 - засвар 10 000 - олгосон 60 000 = -60 000
    const sum = ledger.reduce((s, l) => s + Number(l.amount), 0);
    expect(sum).toBe(-60000);
    // Тасралтгүй үлдэгдэл: -50 000 + 80 000 = 30 000
    expect(-50000 + 80000).toBe(30000);
  });

  it("ФШ-35: засвар бүр аудитад (өмнөх, шинэ утга, шалтгаан, хэн) хадгалагдаж, зөвхөн админ харна", async () => {
    const { f, attendanceId } = await savedOne({ leaves: 3, present: true });
    await patch(f.teacher.token, attendanceId, { present: false, reason: "Алдаатай тэмдэглэсэн" });
    const admin = await loginUser(Role.ADMIN);
    const history = await request(app)
      .get(`/api/v1/attendance/${attendanceId}/history`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(history.status).toBe(200);
    expect(history.body.map((h: { action: string }) => h.action)).toEqual(["CREATE", "UPDATE"]);
    expect(history.body[1].before.status).toBe("PRESENT");
    expect(history.body[1].after.status).toBe("EXCUSED");
    expect(history.body[1].reason).toBe("Алдаатай тэмдэглэсэн");

    const denied = await request(app)
      .get(`/api/v1/attendance/${attendanceId}/history`)
      .set("Authorization", `Bearer ${f.teacher.token}`);
    expect(denied.status).toBe(403);
  });

  it("ФШ-33: 25 цагийн дараа багш засаж чадахгүй", async () => {
    const f = await fixture(0, { endedHoursAgo: 1 });
    const c = await makeContract(f.cls.id, {});
    const saved = await put(f.teacher.token, f.lesson.id, [{ contractId: c.contract.id, present: true }]);
    await prisma.lesson.update({
      where: { id: f.lesson.id },
      data: { startsAt: new Date(Date.now() - 27 * HOUR), endsAt: new Date(Date.now() - 25 * HOUR) },
    });
    const res = await patch(f.teacher.token, saved.body.entries[0].attendanceId, { present: false });
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("attendance-window-closed");
  });
});

describe("М5 Нөхөлт (ФШ-31)", () => {
  it("ФШ-31: 2 чөлөө авсан сурагчид 2 нөхөлт зөвшөөрөгдөж, 3 дахь нь 409; нөхөлт багцаас хасагдаж багшид цалин", async () => {
    const teacher = await loginTeacher();
    const clsA = await makeClass(teacher.userId, "09:00");
    const clsB = await makeClass(teacher.userId, "14:00");
    const student = await makeContract(clsA.id, { remaining: 20, leaves: 1 });
    // 2 удаа Чөлөөтэй болсон
    for (let i = 0; i < 2; i++) {
      const l = await makeLesson(clsA.id, teacher.userId, 30 + i * 5);
      await prisma.attendance.create({
        data: { lessonId: l.id, contractId: student.contract.id, marked: false, status: "EXCUSED", updatedBy: teacher.userId },
      });
    }

    const makeups = [];
    for (let i = 0; i < 3; i++) {
      const l = await makeLesson(clsB.id, teacher.userId, 1 + i * 3);
      const res = await request(app)
        .post(`/api/v1/lessons/${l.id}/makeups`)
        .set("Authorization", `Bearer ${teacher.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ contractId: student.contract.id });
      makeups.push({ res, lessonId: l.id });
    }
    expect(makeups[0]?.res.status).toBe(201);
    expect(makeups[0]?.res.body.status).toBe("MAKEUP");
    expect(makeups[1]?.res.status).toBe(201);
    expect(makeups[2]?.res.status).toBe(409);
    expect(makeups[2]?.res.body.type).toContain("no-makeup-available");

    const after = await reload(student.contract.id);
    expect(after.remainingVisits).toBe(18);
    expect(after.leavesLeft).toBe(1);
    const ledger = await ledgerFor(makeups[0]!.lessonId);
    expect(ledger.map((l) => Number(l.amount))).toEqual([10000]);
  });

  it("ФШ-31: ангийн 6 суудлын хязгаар нөхөлтөд мөн үйлчилнэ", async () => {
    const teacher = await loginTeacher();
    const clsA = await makeClass(teacher.userId, "09:00");
    const clsB = await makeClass(teacher.userId, "14:00");
    const lesson = await makeLesson(clsB.id, teacher.userId, 1);
    for (let i = 0; i < 6; i++) await makeContract(clsB.id, {});
    const student = await makeContract(clsA.id, {});
    const l = await makeLesson(clsA.id, teacher.userId, 30);
    await prisma.attendance.create({
      data: { lessonId: l.id, contractId: student.contract.id, marked: false, status: "EXCUSED", updatedBy: teacher.userId },
    });
    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/makeups`)
      .set("Authorization", `Bearer ${teacher.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ contractId: student.contract.id });
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("class-full");
  });

  it("ФШ-31: бусад багшийн сурагчийг нөхөлтөд нэмэх боломжгүй", async () => {
    const teacher = await loginTeacher();
    const other = await loginTeacher();
    const clsMine = await makeClass(teacher.userId, "14:00");
    const clsOther = await makeClass(other.userId, "09:00");
    const lesson = await makeLesson(clsMine.id, teacher.userId, 1);
    const foreign = await makeContract(clsOther.id, {});
    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/makeups`)
      .set("Authorization", `Bearer ${teacher.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ contractId: foreign.contract.id });
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("makeup-not-allowed");
  });
});

describe("М5 Эрх (BOLA, ФБШ-20)", () => {
  it("ФБШ-20: багш бусад багшийн хичээлийн ирцийг харах, бүртгэх, засахад 403; эцэг эх, сурагчид 403", async () => {
    const f = await fixture(1);
    const intruder = await loginTeacher();
    const entries = [{ contractId: f.contracts[0]!.contract.id, present: true }];

    const get = await request(app)
      .get(`/api/v1/lessons/${f.lesson.id}/attendance`)
      .set("Authorization", `Bearer ${intruder.token}`);
    expect(get.status).toBe(403);
    expect((await put(intruder.token, f.lesson.id, entries)).status).toBe(403);

    const saved = await put(f.teacher.token, f.lesson.id, entries);
    const edit = await patch(intruder.token, saved.body.entries[0].attendanceId, { present: false });
    expect(edit.status).toBe(403);

    for (const role of [Role.PARENT, Role.STUDENT]) {
      const outsider = await loginUser(role);
      const res = await request(app)
        .get(`/api/v1/lessons/${f.lesson.id}/attendance`)
        .set("Authorization", `Bearer ${outsider.token}`);
      expect(res.status).toBe(403);
      expect((await put(outsider.token, f.lesson.id, entries)).status).toBe(403);
    }
  });

  it("ФШ-27, 30, 51: ирцийн дэлгэц сурагч бүрийн нэр, багц, чөлөө, чөлөө хүссэн тэмдэгтэй буцна", async () => {
    const f = await fixture(2);
    await prisma.leaveRequest.create({
      data: { contractId: f.contracts[0]!.contract.id, lessonId: f.lesson.id, requestedBy: f.contracts[0]!.parentId! },
    });
    const res = await request(app)
      .get(`/api/v1/lessons/${f.lesson.id}/attendance`)
      .set("Authorization", `Bearer ${f.teacher.token}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.windowOpen).toBe(true);
    const flagged = res.body.rows.filter((r: { leaveRequested: boolean }) => r.leaveRequested);
    expect(flagged).toHaveLength(1);
    expect(res.body.rows[0]).toMatchObject({ remainingVisits: 25, leavesLeft: 3, present: null, paymentStatus: null });
  });
});
