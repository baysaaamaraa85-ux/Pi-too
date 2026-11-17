import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { LedgerType, Role } from "../../generated/prisma/client.js";
import { recordAttendanceEarningInTx } from "./payroll.service.js";

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
  }
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

let branchCache: { id: string; name: string } | null = null;
async function branch() {
  branchCache ??= await prisma.branch.create({
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  return branchCache;
}

async function addLedger(
  teacherId: string,
  adminId: string,
  type: LedgerType,
  amount: string,
  extra: { lessonId?: string; attendanceId?: string } = {},
) {
  return prisma.ledgerEntry.create({ data: { teacherId, type, amount, createdBy: adminId, ...extra } });
}

// Нэг сурагчтай, дууссан хичээл + ирцийн мөр.
async function lessonWithAttendance(teacherId: string, startsAt: Date, opts: { attendance?: boolean } = {}) {
  const b = await branch();
  const cls = await prisma.class.create({
    data: { teacherId, branchId: b.id, weekday: 1, startTime: "09:00", durationMin: 120, capacity: 6 },
  });
  const lesson = await prisma.lesson.create({
    data: {
      classId: cls.id,
      teacherId,
      startsAt,
      endsAt: new Date(startsAt.getTime() + 2 * HOUR),
      originalStartsAt: startsAt,
    },
  });
  const program = await prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
  });
  const student = await prisma.student.create({ data: { fullName: `Сурагч ${randomUUID().slice(0, 6)}` } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId: program.id,
      price: "500000.00",
      totalHours: 75,
      remainingHours: 75,
      leavesLeft: 3,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({
    data: { contractId: contract.id, classId: cls.id, fromDate: new Date("2026-01-01") },
  });
  const attendance =
    opts.attendance === false
      ? null
      : await prisma.attendance.create({
          data: { lessonId: lesson.id, contractId: contract.id, marked: true, status: "PRESENT", updatedBy: teacherId },
        });
  return { cls, lesson, student, contract, attendance };
}

function payout(token: string, body: object, key = randomUUID()) {
  return request(app)
    .post("/api/v1/payouts")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send(body);
}

describe("М8 Цалингийн журнал (ФШ-53...59)", () => {
  it("ФШ-10, D-67: хүүхдийн үнэлгээ сарын 15-нд өөрчлөгдвөл 14-нд хуучин, 15-нд шинэ үнэлгээгээр тооцогдоно", async () => {
    const teacher = await loginUser(Role.TEACHER);
    const before = await lessonWithAttendance(teacher.userId, new Date("2026-03-14T10:00:00+08:00"));
    const onDay = await lessonWithAttendance(teacher.userId, new Date("2026-03-15T10:00:00+08:00"));
    for (const l of [before, onDay]) {
      await prisma.contractRate.createMany({
        data: [
          { contractId: l.contract.id, teacherId: teacher.userId, hourlyRate: "5000.00", effectiveFrom: new Date("2026-01-01"), createdBy: teacher.userId },
          { contractId: l.contract.id, teacherId: teacher.userId, hourlyRate: "6000.00", effectiveFrom: new Date("2026-03-15"), createdBy: teacher.userId },
        ],
      });
    }
    const record = (l: Awaited<ReturnType<typeof lessonWithAttendance>>) =>
      prisma.$transaction((tx) =>
        recordAttendanceEarningInTx(tx, {
          attendanceId: l.attendance!.id,
          contractId: l.contract.id,
          lessonId: l.lesson.id,
          teacherId: teacher.userId,
          lessonDate: new Date(Date.UTC(2026, 2, l.lesson.startsAt.getUTCDate())),
          durationMin: 120,
          createdBy: teacher.userId,
        }),
      );
    expect(Number((await record(before)).amount)).toBe(10000);
    expect(Number((await record(onDay)).amount)).toBe(12000);
  });

  it("ФШ-56, 57: олсон, олгосон, үлдэгдэл; -50 000 + 80 000 = 30 000, үлдэгдэл сар солигдоход тэглэгдэхгүй", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await addLedger(teacher.userId, admin.userId, "PAYOUT", "-50000.00");
    await addLedger(teacher.userId, admin.userId, "EARNING", "80000.00");

    const res = await request(app)
      .get(`/api/v1/ledger?teacherId=${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(200);
    expect(res.body.summary).toEqual({ earned: "80000.00", paid: "50000.00", balance: "30000.00" });
    expect(res.body.items.map((i: { type: string }) => i.type).sort()).toEqual(["EARNING", "PAYOUT"]);

    // Өнгөрсөн сарын хугацаагаар шүүхэд олгосон 0, харин үлдэгдэл тасралтгүй.
    const old = await request(app)
      .get(`/api/v1/ledger?teacherId=${teacher.userId}&from=2020-01-01&to=2020-01-31`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(old.body.summary.paid).toBe("0.00");
    expect(old.body.summary.balance).toBe("30000.00");
  });

  it("ФШ-56: мөр сурагчийн нэр, төлөв, салбар, цагийн үнэлгээ, хугацаатай; төрөл, салбараар шүүгдэнэ", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    const l = await lessonWithAttendance(teacher.userId, new Date(Date.now() - 5 * HOUR));
    await prisma.ledgerEntry.create({
      data: {
        teacherId: teacher.userId,
        type: "EARNING",
        amount: "10000.00",
        rateUsed: "5000.00",
        lessonId: l.lesson.id,
        attendanceId: l.attendance!.id,
        createdBy: admin.userId,
      },
    });
    await addLedger(teacher.userId, admin.userId, "PAYOUT", "-3000.00");

    const all = await request(app)
      .get(`/api/v1/ledger?teacherId=${teacher.userId}&type=EARNING`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(all.body.items).toHaveLength(1);
    expect(all.body.items[0]).toMatchObject({
      studentName: l.student.fullName,
      attendanceStatus: "PRESENT",
      rateUsed: "5000.00",
      durationHours: "2.00",
      amount: "10000.00",
      branchName: (await branch()).name,
    });

    const other = await request(app)
      .get(`/api/v1/ledger?teacherId=${teacher.userId}&branchId=${randomUUID()}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(other.body.items.filter((i: { type: string }) => i.type === "EARNING")).toHaveLength(0);
  });

  it("ФШ-55, ФБШ-31: үлдэгдлээс их олголт 409, баталгаажуулбал бичигдэж үлдэгдэл хасагдана", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await addLedger(teacher.userId, admin.userId, "EARNING", "100000.00");

    const exact = await payout(admin.token, { teacherId: teacher.userId, amount: "100000.00" });
    expect(exact.status).toBe(201);
    expect(exact.body.balance).toBe("0.00");

    const over = await payout(admin.token, { teacherId: teacher.userId, amount: "0.01" });
    expect(over.status).toBe(409);
    expect(over.body.type).toContain("payout-needs-confirmation");
    expect(over.body.exceedsBalance).toBe(true);
    expect(await prisma.ledgerEntry.count({ where: { teacherId: teacher.userId, type: "PAYOUT" } })).toBe(1);

    const confirmed = await payout(admin.token, {
      teacherId: teacher.userId,
      amount: "20000.00",
      confirm: true,
      note: "Урьдчилгаа",
    });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.balance).toBe("-20000.00");

    const audit = await prisma.auditLog.findFirst({
      where: { entity: "payout", entityId: confirmed.body.id },
    });
    expect(audit?.reason).toBe("Урьдчилгаа");
  });

  it("ФБШ-31: ирц бөглөгдөөгүй хичээлтэй багшид олголт баталгаажуулалт шаардана", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await addLedger(teacher.userId, admin.userId, "EARNING", "100000.00");
    await lessonWithAttendance(teacher.userId, new Date(Date.now() - 5 * HOUR), { attendance: false });

    const res = await payout(admin.token, { teacherId: teacher.userId, amount: "10000.00" });
    expect(res.status).toBe(409);
    expect(res.body.unfilledLessons).toBe(1);
    expect(res.body.exceedsBalance).toBe(false);

    const ok = await payout(admin.token, { teacherId: teacher.userId, amount: "10000.00", confirm: true });
    expect(ok.status).toBe(201);
  });

  it("ФШ-55, 3.8.3: хоёр админ зэрэг олгоход түгжээгээр дарааллагдаж, нэг нь баталгаажуулалт шаардана", async () => {
    const adminA = await loginUser(Role.ADMIN);
    const adminB = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await addLedger(teacher.userId, adminA.userId, "EARNING", "100000.00");

    const [a, b] = await Promise.all([
      payout(adminA.token, { teacherId: teacher.userId, amount: "60000.00" }),
      payout(adminB.token, { teacherId: teacher.userId, amount: "60000.00" }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const sum = await prisma.ledgerEntry.aggregate({
      where: { teacherId: teacher.userId },
      _sum: { amount: true },
    });
    expect(sum._sum.amount?.toFixed(2)).toBe("40000.00");
  });

  it("ФБШ-15: ижил Idempotency-Key-ээр олголт нэг л удаа бичигдэнэ", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await addLedger(teacher.userId, admin.userId, "EARNING", "50000.00");
    const key = randomUUID();
    const body = { teacherId: teacher.userId, amount: "10000.00" };
    const first = await payout(admin.token, body, key);
    const second = await payout(admin.token, body, key);
    expect(second.body).toEqual(first.body);
    expect(await prisma.ledgerEntry.count({ where: { teacherId: teacher.userId, type: "PAYOUT" } })).toBe(1);
  });

  it("ФШ-58, ФБШ-20: багш зөвхөн өөрийн цалинг харна, бусдынх 403; олголт, тайлан админд", async () => {
    const admin = await loginUser(Role.ADMIN);
    const mine = await loginUser(Role.TEACHER);
    const other = await loginUser(Role.TEACHER);
    await addLedger(mine.userId, admin.userId, "EARNING", "12000.00");
    await addLedger(other.userId, admin.userId, "EARNING", "99000.00");

    const own = await request(app).get("/api/v1/ledger").set("Authorization", `Bearer ${mine.token}`);
    expect(own.status).toBe(200);
    expect(own.body.summary.balance).toBe("12000.00");
    expect(own.body.items.every((i: { teacherId: string }) => i.teacherId === mine.userId)).toBe(true);

    const peek = await request(app)
      .get(`/api/v1/ledger?teacherId=${other.userId}`)
      .set("Authorization", `Bearer ${mine.token}`);
    expect(peek.status).toBe(403);

    expect((await payout(mine.token, { teacherId: mine.userId, amount: "1.00" })).status).toBe(403);
    const exp = await request(app)
      .get("/api/v1/reports/payroll?format=xlsx")
      .set("Authorization", `Bearer ${mine.token}`);
    expect(exp.status).toBe(403);
    const summary = await request(app)
      .get("/api/v1/payroll/summary")
      .set("Authorization", `Bearer ${mine.token}`);
    expect(summary.status).toBe(403);

    for (const role of [Role.PARENT, Role.STUDENT]) {
      const u = await loginUser(role);
      expect((await request(app).get("/api/v1/ledger").set("Authorization", `Bearer ${u.token}`)).status).toBe(403);
    }
  });

  it("ФШ-59: Excel файлын нийлбэр системийн тооцоотой тэнцүү, PDF үүснэ", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await addLedger(teacher.userId, admin.userId, "EARNING", "40000.00");
    await addLedger(teacher.userId, admin.userId, "ADJUSTMENT", "-10000.00");
    await addLedger(teacher.userId, admin.userId, "PAYOUT", "-5000.50");

    const xlsx = await request(app)
      .get(`/api/v1/reports/payroll?format=xlsx&teacherId=${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(xlsx.status).toBe(200);
    expect(xlsx.headers["x-report-total"]).toBe("24999.50");

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(xlsx.body as unknown as ExcelJS.Buffer);
    const sheet = workbook.getWorksheet("Цалин")!;
    let sum = 0;
    sheet.eachRow((row) => {
      const type = String(row.getCell(10).value ?? "");
      if (["Цалин", "Залруулга", "Олголт"].includes(type)) sum += Number(row.getCell(9).value);
    });
    expect(sum.toFixed(2)).toBe("24999.50");

    const pdf = await request(app)
      .get(`/api/v1/reports/payroll?format=pdf&teacherId=${teacher.userId}`)
      .set("Authorization", `Bearer ${admin.token}`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(pdf.status).toBe(200);
    expect((pdf.body as Buffer).subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.headers["x-report-total"]).toBe("24999.50");
  });

  it("ФБШ-02: 10 000 мөрийн нийлбэрт 0 төгрөгийн зөрүү (Decimal)", async () => {
    const admin = await loginUser(Role.ADMIN);
    const teacher = await loginUser(Role.TEACHER);
    await prisma.ledgerEntry.createMany({
      data: Array.from({ length: 10_000 }, () => ({
        teacherId: teacher.userId,
        type: LedgerType.EARNING,
        amount: "1666.67",
        createdBy: admin.userId,
      })),
    });
    const res = await request(app)
      .get(`/api/v1/ledger?teacherId=${teacher.userId}&limit=1`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.body.summary.balance).toBe("16666700.00");
  });

  it("ФБШ-05: 30 багшийн цалингийн үлдэгдлийг 10 секундээс бага хугацаанд тооцно", async () => {
    const admin = await loginUser(Role.ADMIN);
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) {
      const phone = phone8();
      const user = await prisma.user.create({ data: { role: Role.TEACHER, phone, passwordHash: "x" } });
      await prisma.teacher.create({ data: { userId: user.id, fullName: `Масс ${i}` } });
      ids.push(user.id);
    }
    await prisma.ledgerEntry.createMany({
      data: ids.flatMap((teacherId) =>
        Array.from({ length: 200 }, () => ({
          teacherId,
          type: LedgerType.EARNING,
          amount: "10000.00",
          createdBy: admin.userId,
        })),
      ),
    });
    const started = Date.now();
    const res = await request(app)
      .get("/api/v1/payroll/summary")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(res.status).toBe(200);
    const row = (res.body as { teacherId: string; balance: string }[]).find((r) => r.teacherId === ids[0]);
    expect(row?.balance).toBe("2000000.00");
  });
});
