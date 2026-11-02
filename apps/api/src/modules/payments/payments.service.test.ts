import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();
const HOUR = 3_600_000;

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

async function loginUser(role: Role, fullName = "Тест") {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role, phone, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  if (role === Role.TEACHER) {
    await prisma.teacher.create({ data: { userId: user.id, fullName: `${fullName} ${phone}` } });
    await prisma.teacherRate.create({
      data: { teacherId: user.id, hourlyRate: "5000.00", effectiveFrom: new Date("2026-01-01") },
    });
  }
  if (role === Role.PARENT) await prisma.parent.create({ data: { userId: user.id, fullName, phone } });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
}

let programId: string | null = null;
async function getProgramId() {
  programId ??= (
    await prisma.program.create({ data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "600000.00" } })
  ).id;
  return programId;
}

async function makeBranch() {
  return prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } });
}

// Нэг багш, анги, 600 000 ₮ гэрээтэй сурагч, эцэг эх.
async function fixture(opts: { price?: string; branchId?: string } = {}) {
  const teacher = await loginUser(Role.TEACHER);
  const branch = opts.branchId ? { id: opts.branchId } : await makeBranch();
  const cls = await prisma.class.create({
    data: { teacherId: teacher.userId, branchId: branch.id, weekday: 1, startTime: "09:00", durationMin: 120, capacity: 6 },
  });
  const student = await prisma.student.create({ data: { fullName: `Сурагч ${randomUUID().slice(0, 6)}` } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId: await getProgramId(),
      price: opts.price ?? "600000.00",
      totalVisits: 25,
      remainingVisits: 25,
      leavesLeft: 3,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId: cls.id, fromDate: new Date("2026-01-01") } });
  const parent = await loginUser(Role.PARENT, "Эцэг");
  await prisma.parentStudent.create({ data: { parentId: parent.userId, studentId: student.id } });
  const admin = await loginUser(Role.ADMIN);
  return { teacher, cls, student, contract, parent, admin };
}

function pay(token: string, contractId: string, amount: string, key = randomUUID()) {
  return request(app)
    .post(`/api/v1/contracts/${contractId}/payments`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send({ amount, paidAt: "2026-10-30", channel: "BANK_TRANSFER", reference: "гүйлгээ" });
}

const get = (token: string, path: string) => request(app).get(`/api/v1${path}`).set("Authorization", `Bearer ${token}`);

function claim(token: string, contractId: string, key = randomUUID()) {
  return request(app)
    .post("/api/v1/payment-claims")
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", key)
    .send({ contractId });
}

describe("М7 Төлбөр ба өр (ФШ-46...52)", () => {
  it("ФШ-46, 47: 600 000 ₮ гэрээнд 400 000 ₮ төлбөл үлдэгдэл 200 000, Дутуу; 3 хэсэгчилсэн төлбөрийн нийлбэр төлсөн дүн", async () => {
    const f = await fixture();
    const empty = await get(f.admin.token, `/contracts/${f.contract.id}/balance`);
    expect(empty.body).toMatchObject({ paid: "0.00", balance: "600000.00", status: "UNPAID" });

    for (const amount of ["150000.00", "150000.00", "100000.00"]) {
      expect((await pay(f.admin.token, f.contract.id, amount)).status).toBe(201);
    }
    const partial = await get(f.admin.token, `/contracts/${f.contract.id}/balance`);
    expect(partial.body).toMatchObject({ paid: "400000.00", balance: "200000.00", status: "PARTIAL" });

    await pay(f.admin.token, f.contract.id, "200000.00");
    const full = await get(f.admin.token, `/contracts/${f.contract.id}/balance`);
    expect(full.body).toMatchObject({ balance: "0.00", status: "PAID" });
  });

  it("ФШ-46: дүн 0 эсвэл сөрөг бол 422; Idempotency-Key давтахад нэг л бичлэг", async () => {
    const f = await fixture();
    expect((await pay(f.admin.token, f.contract.id, "0.00")).status).toBe(422);
    const key = randomUUID();
    const first = await pay(f.admin.token, f.contract.id, "50000.00", key);
    const second = await pay(f.admin.token, f.contract.id, "50000.00", key);
    expect(second.body).toEqual(first.body);
    expect(await prisma.payment.count({ where: { contractId: f.contract.id } })).toBe(1);
  });

  it("ФШ-52: цуцалсан төлбөр үлдэгдлийн тооцоонд орохгүй, жагсаалтад үлдэж, шалтгаантай аудитад хадгалагдана", async () => {
    const f = await fixture();
    const made = await pay(f.admin.token, f.contract.id, "400000.00");
    const paymentId = made.body.payment.id as string;

    const noReason = await request(app)
      .post(`/api/v1/payments/${paymentId}/cancel`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ reason: "" });
    expect(noReason.status).toBe(422);

    const cancelled = await request(app)
      .post(`/api/v1/payments/${paymentId}/cancel`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ reason: "Буруу гэрээнд бүртгэсэн" });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.balance).toMatchObject({ paid: "0.00", status: "UNPAID" });

    const list = await get(f.admin.token, `/payments?contractId=${f.contract.id}`);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({ status: "CANCELLED", cancelReason: "Буруу гэрээнд бүртгэсэн" });
    expect(await prisma.auditLog.count({ where: { entity: "payment", entityId: paymentId, action: "CANCEL" } })).toBe(1);

    const again = await request(app)
      .post(`/api/v1/payments/${paymentId}/cancel`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ reason: "дахин" });
    expect(again.status).toBe(409);
  });

  it("ФШ-52: засахад шалтгаан заавал, анхны утга аудитад хадгалагдана; өгөгдлийн сан шалтгаангүй цуцлалтыг хүлээн авахгүй", async () => {
    const f = await fixture();
    const made = await pay(f.admin.token, f.contract.id, "100000.00");
    const id = made.body.payment.id as string;

    const bad = await request(app)
      .patch(`/api/v1/payments/${id}`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ amount: "120000.00" });
    expect(bad.status).toBe(422);

    const ok = await request(app)
      .patch(`/api/v1/payments/${id}`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ amount: "120000.00", reason: "Дүн алдаатай бичсэн" });
    expect(ok.status).toBe(200);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { entity: "payment", entityId: id, action: "UPDATE" } });
    expect((audit.before as { amount: string }).amount).toBe("100000.00");
    expect((audit.after as { amount: string }).amount).toBe("120000.00");

    await expect(
      prisma.payment.update({ where: { id }, data: { status: "CANCELLED" } }),
    ).rejects.toThrow();
  });

  it("ФШ-51: багшид зөвхөн Бүрэн / Үлдэгдэлтэй төлөв (дүнгүй), ирцийн дэлгэц ба гэрээний жагсаалтад", async () => {
    const f = await fixture();
    const endsAt = new Date(Date.now() - HOUR);
    const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
    const lesson = await prisma.lesson.create({
      data: { classId: f.cls.id, teacherId: f.teacher.userId, startsAt, endsAt, originalStartsAt: startsAt },
    });

    const debt = await get(f.teacher.token, `/lessons/${lesson.id}/attendance`);
    expect(debt.body.rows[0].paymentStatus).toBe("DEBT");
    expect(JSON.stringify(debt.body)).not.toContain("600000");

    await pay(f.admin.token, f.contract.id, "600000.00");
    const full = await get(f.teacher.token, `/lessons/${lesson.id}/attendance`);
    expect(full.body.rows[0].paymentStatus).toBe("FULL");

    const list = await get(f.teacher.token, "/contracts");
    expect(list.body.items[0].paymentFlag).toBe("FULL");
    expect(JSON.stringify(list.body)).not.toContain("600000");

    expect((await get(f.teacher.token, `/contracts/${f.contract.id}/balance`)).status).toBe(403);
    expect((await get(f.teacher.token, "/payments")).status).toBe(403);
    expect((await get(f.teacher.token, "/debts")).status).toBe(403);
  });

  it("ФШ-66, ФБШ-20: сурагч төлбөрийн мэдээлэлд хандахад 403, эцэг эх зөвхөн өөрийн хүүхдийнхийг харна", async () => {
    const f = await fixture();
    const other = await fixture();
    const studentUser = await loginUser(Role.STUDENT);
    await prisma.student.update({ where: { id: f.student.id }, data: { userId: studentUser.userId } });

    expect((await get(studentUser.token, `/portal/contracts/${f.contract.id}/payment-instructions`)).status).toBe(403);
    expect((await get(studentUser.token, `/contracts/${f.contract.id}/balance`)).status).toBe(403);

    expect((await get(f.parent.token, `/contracts/${f.contract.id}/balance`)).status).toBe(200);
    expect((await get(other.parent.token, `/contracts/${f.contract.id}/balance`)).status).toBe(403);
    expect((await claim(other.parent.token, f.contract.id)).status).toBe(403);
    expect((await get(other.parent.token, `/portal/contracts/${f.contract.id}/payment-instructions`)).status).toBe(403);
  });
});

describe("М7 Банкны шилжүүлэг, шилжүүлгийн мэдэгдэл (ФШ-49, 76, 77, 3.8.6)", () => {
  it("ФШ-49, 77: эцэг эхийн карт үлдэгдэл, төлөв, дансны мэдээлэл, гүйлгээний утгатай", async () => {
    const f = await fixture();
    await pay(f.admin.token, f.contract.id, "400000.00");
    const card = await get(f.parent.token, `/portal/contracts/${f.contract.id}/payment-instructions`);
    expect(card.status).toBe(200);
    expect(card.body).toMatchObject({ balance: "200000.00", status: "PARTIAL", price: "600000.00" });
    expect(card.body.account.accountNumber).toBeTypeOf("string");
    expect(card.body.transferNote).toContain(f.student.fullName);
  });

  it("ФШ-76, 77: Шилжүүлсэн мэдэгдэл PENDING болж карт Хүлээгдэж байна; нэг гэрээнд нэг л PENDING; админд мэдэгдэл", async () => {
    const f = await fixture();
    const first = await claim(f.parent.token, f.contract.id);
    expect(first.status).toBe(201);
    const card = await get(f.parent.token, `/portal/contracts/${f.contract.id}/payment-instructions`);
    expect(card.body.status).toBe("PENDING");

    const second = await claim(f.parent.token, f.contract.id);
    expect(second.status).toBe(409);
    expect(second.body.type).toContain("claim-pending");

    expect(
      await prisma.notificationOutbox.count({ where: { recipientId: f.admin.userId, template: "payment_claim_created" } }),
    ).toBe(1);
  });

  it("ФШ-76: хоёр мэдэгдэл зэрэг ирэхэд өгөгдлийн сангийн хязгаарлалтаар нэг л PENDING үүснэ", async () => {
    const f = await fixture();
    const results = await Promise.all([claim(f.parent.token, f.contract.id), claim(f.parent.token, f.contract.id)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(await prisma.paymentClaim.count({ where: { contractId: f.contract.id, status: "PENDING" } })).toBe(1);
  });

  it("ФШ-76, 3.8.6: админ батлахад төлбөр, аудит, CONFIRMED нэг дор бичигдэж карт Дутуу/Төлөгдсөн болно", async () => {
    const f = await fixture();
    const made = await claim(f.parent.token, f.contract.id);
    const key = randomUUID();
    const confirm = await request(app)
      .post(`/api/v1/payment-claims/${made.body.id}/confirm`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .set("Idempotency-Key", key)
      .send({ amount: "300000.00", paidAt: "2026-10-30", channel: "BANK_TRANSFER", reference: "Хаан банк 123" });
    expect(confirm.status).toBe(200);
    expect(confirm.body.balance).toMatchObject({ paid: "300000.00", balance: "300000.00", status: "PARTIAL" });

    const stored = await prisma.paymentClaim.findUniqueOrThrow({ where: { id: made.body.id } });
    expect(stored.status).toBe("CONFIRMED");
    expect(stored.paymentId).not.toBeNull();
    const card = await get(f.parent.token, `/portal/contracts/${f.contract.id}/payment-instructions`);
    expect(card.body.status).toBe("PARTIAL");

    const again = await request(app)
      .post(`/api/v1/payment-claims/${made.body.id}/confirm`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .set("Idempotency-Key", randomUUID())
      .send({ amount: "1.00", paidAt: "2026-10-30", channel: "CASH" });
    expect(again.status).toBe(409);
    expect(await prisma.payment.count({ where: { contractId: f.contract.id } })).toBe(1);
  });

  it("3.8.6 (4): татгалзахад шалтгаан заавал, эцэг эхэд шалтгаантай мэдэгдэл, дахин мэдэгдэх боломжтой", async () => {
    const f = await fixture();
    const made = await claim(f.parent.token, f.contract.id);
    const bad = await request(app)
      .post(`/api/v1/payment-claims/${made.body.id}/reject`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ reason: "" });
    expect(bad.status).toBe(422);
    const ok = await request(app)
      .post(`/api/v1/payment-claims/${made.body.id}/reject`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ reason: "Гүйлгээ олдсонгүй" });
    expect(ok.status).toBe(200);
    const note = await prisma.notificationOutbox.findFirstOrThrow({
      where: { recipientId: f.parent.userId, template: "payment_claim_rejected" },
    });
    expect((note.payload as { reason: string }).reason).toBe("Гүйлгээ олдсонгүй");
    expect((await claim(f.parent.token, f.contract.id)).status).toBe(201);
  });

  it("ФШ-76: бүрэн төлөгдсөн гэрээнд шилжүүлгийн мэдэгдэл үүсэхгүй (409)", async () => {
    const f = await fixture();
    await pay(f.admin.token, f.contract.id, "600000.00");
    const res = await claim(f.parent.token, f.contract.id);
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("nothing-to-pay");
  });

  it("ФШ-76: хүлээгдэж буй мэдэгдлийн жагсаалт зөвхөн админд, эцэг эх, багшид 403", async () => {
    const f = await fixture();
    await claim(f.parent.token, f.contract.id);
    const list = await get(f.admin.token, "/payment-claims?status=PENDING");
    expect(list.status).toBe(200);
    expect(list.body.some((c: { contractId: string }) => c.contractId === f.contract.id)).toBe(true);
    expect((await get(f.parent.token, "/payment-claims")).status).toBe(403);
    expect((await get(f.teacher.token, "/payment-claims")).status).toBe(403);
  });
});

describe("М7 Өртэй гэрээ (ФШ-48)", () => {
  it("ФШ-48: өртэй гэрээ салбар, багшаар шүүгдэж, төлөгдсөн нь жагсаалтад орохгүй; нийт өр мөрүүдийн нийлбэр", async () => {
    const a = await fixture();
    const b = await fixture();
    const paid = await fixture();
    await pay(a.admin.token, a.contract.id, "100000.00");
    await pay(a.admin.token, paid.contract.id, "600000.00");

    const all = await get(a.admin.token, "/debts?limit=100");
    const ids = (all.body.items as { contractId: string }[]).map((r) => r.contractId);
    expect(ids).toContain(a.contract.id);
    expect(ids).toContain(b.contract.id);
    expect(ids).not.toContain(paid.contract.id);
    const sum = (all.body.items as { balance: string }[]).reduce((s, r) => s + Number(r.balance), 0);
    expect(all.body.totalDebt).toBe(sum.toFixed(2));

    const branchRow = await prisma.class.findUniqueOrThrow({ where: { id: a.cls.id } });
    const byBranch = await get(a.admin.token, `/debts?branchId=${branchRow.branchId}`);
    expect(byBranch.body.items.map((r: { contractId: string }) => r.contractId)).toEqual([a.contract.id]);
    expect(byBranch.body.items[0].balance).toBe("500000.00");

    const byTeacher = await get(a.admin.token, `/debts?teacherId=${b.teacher.userId}`);
    expect(byTeacher.body.items.map((r: { contractId: string }) => r.contractId)).toEqual([b.contract.id]);
  });

  it("ФШ-48: гэрээ эхэлснээс хойших хоногоор шүүнэ; цуцалсан төлбөр өрийг буцаан гаргана", async () => {
    const f = await fixture();
    await prisma.contract.update({
      where: { id: f.contract.id },
      data: { createdAt: new Date(Date.now() - 40 * 86_400_000) },
    });
    const made = await pay(f.admin.token, f.contract.id, "600000.00");
    const old = await get(f.admin.token, `/debts?sinceDays=30&teacherId=${f.teacher.userId}`);
    expect(old.body.items).toHaveLength(0);

    await request(app)
      .post(`/api/v1/payments/${made.body.payment.id}/cancel`)
      .set("Authorization", `Bearer ${f.admin.token}`)
      .send({ reason: "Буруу" });
    const after = await get(f.admin.token, `/debts?sinceDays=30&teacherId=${f.teacher.userId}`);
    expect(after.body.items).toHaveLength(1);
    // 40 хоногийн настай гэрээ: 60 ба 45 хоногоос дээш гэсэн шүүлтэд орохгүй.
    for (const days of [45, 60]) {
      const young = await get(f.admin.token, `/debts?sinceDays=${days}&teacherId=${f.teacher.userId}`);
      expect(young.body.items).toHaveLength(0);
    }
  });
});
