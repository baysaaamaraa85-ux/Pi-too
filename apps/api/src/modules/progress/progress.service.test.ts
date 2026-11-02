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
  if (role === Role.PARENT) {
    await prisma.parent.create({ data: { userId: user.id, fullName, phone } });
  }
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, userId: user.id };
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
let branchId: string | null = null;
async function getBranchId() {
  branchId ??= (await prisma.branch.create({ data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" } })).id;
  return branchId;
}

// Багш, анги, нэг сурагч (гэрээ ACTIVE), эцэг эх, хичээл (дууссан).
async function fixture(opts: { status?: ContractStatus; remaining?: number } = {}) {
  const teacher = await loginUser(Role.TEACHER);
  const cls = await prisma.class.create({
    data: { teacherId: teacher.userId, branchId: await getBranchId(), weekday: 1, startTime: "09:00", durationMin: 120, capacity: 6 },
  });
  const student = await prisma.student.create({ data: { fullName: `Сурагч ${randomUUID().slice(0, 6)}` } });
  const contract = await prisma.contract.create({
    data: {
      studentId: student.id,
      programId: await getProgramId(),
      price: "500000.00",
      totalVisits: 25,
      remainingVisits: opts.remaining ?? 10,
      leavesLeft: 3,
      status: opts.status ?? ContractStatus.ACTIVE,
      rulesAckAt: new Date(),
    },
  });
  await prisma.enrollment.create({ data: { contractId: contract.id, classId: cls.id, fromDate: new Date("2026-01-01") } });
  const parent = await loginUser(Role.PARENT, "Эцэг");
  await prisma.parentStudent.create({ data: { parentId: parent.userId, studentId: student.id } });
  const endsAt = new Date(Date.now() - HOUR);
  const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
  const lesson = await prisma.lesson.create({
    data: { classId: cls.id, teacherId: teacher.userId, startsAt, endsAt, originalStartsAt: startsAt },
  });
  return { teacher, cls, student, contract, parent, lesson };
}

function record(token: string, studentId: string, body: object) {
  return request(app).post(`/api/v1/students/${studentId}/assessments`).set("Authorization", `Bearer ${token}`).send(body);
}

const get = (token: string, path: string) => request(app).get(`/api/v1${path}`).set("Authorization", `Bearer ${token}`);

describe("М6 Сорил, шалгалт (ФШ-38, 39, 41, 42)", () => {
  it("ФШ-38: сэдвийн оноогоор нийт хувь дундаж болж, таарахгүй бол 409, 0-100-аас гадуур 422", async () => {
    const f = await fixture();
    const ok = await record(f.teacher.token, f.student.id, {
      type: "QUIZ",
      contractId: f.contract.id,
      takenOn: "2026-10-01",
      topics: [
        { topic: "Тоо", scorePercent: 80 },
        { topic: "Геометр", scorePercent: 60 },
      ],
    });
    expect(ok.status).toBe(201);
    expect(ok.body.totalPercent).toBe("70.00");

    const mismatch = await record(f.teacher.token, f.student.id, {
      type: "QUIZ",
      contractId: f.contract.id,
      takenOn: "2026-10-02",
      totalPercent: 90,
      topics: [{ topic: "Тоо", scorePercent: 50 }],
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.type).toContain("total-mismatch");

    for (const bad of [101, -1]) {
      const res = await record(f.teacher.token, f.student.id, {
        type: "QUIZ",
        contractId: f.contract.id,
        takenOn: "2026-10-03",
        totalPercent: bad,
      });
      expect(res.status).toBe(422);
    }
  });

  it("ФШ-38: өгөгдлийн сан сэдвийн оноо 100-аас их утгыг хүлээж авахгүй (CHECK)", async () => {
    const f = await fixture();
    const a = await prisma.assessment.create({
      data: { studentId: f.student.id, type: "QUIZ", takenOn: new Date(), totalPercent: "50.00" },
    });
    await expect(
      prisma.assessmentTopic.create({ data: { assessmentId: a.id, topic: "Х", scorePercent: "100.01" } }),
    ).rejects.toThrow();
  });

  it("ФШ-39: багцын шалгалт 92.9% бол 3 үнэгүй давтлагын эрх, 93.0% бол эрх үүсэхгүй", async () => {
    const low = await fixture({ status: ContractStatus.COMPLETED, remaining: 0 });
    const lowRes = await record(low.teacher.token, low.student.id, {
      type: "BATCH_EXAM",
      contractId: low.contract.id,
      takenOn: "2026-10-05",
      topics: [
        { topic: "Алгебр", scorePercent: 92.9 },
      ],
    });
    expect(lowRes.status).toBe(201);
    expect(lowRes.body.freeReviewsGranted).toBe(3);
    expect(lowRes.body.reviewTopics).toEqual(["Алгебр"]);
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: low.contract.id } })).freeReviewsLeft).toBe(3);

    const edge = await fixture({ status: ContractStatus.COMPLETED, remaining: 0 });
    const edgeRes = await record(edge.teacher.token, edge.student.id, {
      type: "BATCH_EXAM",
      contractId: edge.contract.id,
      takenOn: "2026-10-05",
      totalPercent: 93.0,
    });
    expect(edgeRes.body.freeReviewsGranted).toBe(0);
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: edge.contract.id } })).freeReviewsLeft).toBe(0);

    const repeat = await record(low.teacher.token, low.student.id, {
      type: "BATCH_EXAM",
      contractId: low.contract.id,
      takenOn: "2026-10-06",
      totalPercent: 50,
    });
    expect(repeat.status).toBe(409);
  });

  it("ФШ-37: багцын шалгалт бүртгэгдэхэд шалгалтын ажил биелсэн болно", async () => {
    const f = await fixture({ status: ContractStatus.COMPLETED, remaining: 0 });
    const task = await prisma.teacherTask.create({
      data: { teacherId: f.teacher.userId, type: "EXAM", contractId: f.contract.id, dueOn: new Date() },
    });
    await record(f.teacher.token, f.student.id, {
      type: "BATCH_EXAM",
      contractId: f.contract.id,
      takenOn: "2026-10-05",
      totalPercent: 97,
    });
    expect((await prisma.teacherTask.findUniqueOrThrow({ where: { id: task.id } })).doneAt).not.toBeNull();
  });

  it("ФШ-40: 92.9% дүнгийн дараа 3 давтлага бүртгэгдэж, 4 дэх нь хориглогдоно", async () => {
    const f = await fixture({ status: ContractStatus.COMPLETED, remaining: 0 });
    await record(f.teacher.token, f.student.id, {
      type: "BATCH_EXAM",
      contractId: f.contract.id,
      takenOn: "2026-10-05",
      totalPercent: 92.9,
    });
    const save = async (lessonId: string) =>
      request(app)
        .put(`/api/v1/lessons/${lessonId}/attendance`)
        .set("Authorization", `Bearer ${f.teacher.token}`)
        .set("Idempotency-Key", randomUUID())
        .send({ entries: [{ contractId: f.contract.id, present: true }] });

    const statuses: string[] = [];
    let last: Awaited<ReturnType<typeof save>> | null = null;
    for (let i = 0; i < 4; i++) {
      const endsAt = new Date(Date.now() - (5 + i * 4) * HOUR);
      const startsAt = new Date(endsAt.getTime() - 2 * HOUR);
      const lesson = await prisma.lesson.create({
        data: { classId: f.cls.id, teacherId: f.teacher.userId, startsAt, endsAt, originalStartsAt: startsAt },
      });
      last = await save(lesson.id);
      if (last.status === 200) statuses.push(last.body.entries[0].status);
    }
    expect(statuses).toEqual(["FREE_REVIEW", "FREE_REVIEW", "FREE_REVIEW"]);
    expect(last?.status).toBe(409);
    const after = await prisma.contract.findUniqueOrThrow({ where: { id: f.contract.id } });
    expect(after.freeReviewsLeft).toBe(0);
    expect(after.remainingVisits).toBe(0);
    expect(await prisma.ledgerEntry.count({ where: { teacherId: f.teacher.userId } })).toBe(0);
  });

  it("ФШ-41: дүнгийн түүх цаг хугацааны дарааллаар, 5 сорилтой сурагчийн график 5 цэгтэй", async () => {
    const f = await fixture();
    for (const [i, pct] of [60, 65, 70, 75, 80].entries()) {
      await record(f.teacher.token, f.student.id, {
        type: "QUIZ",
        contractId: f.contract.id,
        takenOn: `2026-09-0${i + 1}`,
        totalPercent: pct,
      });
    }
    const res = await get(f.parent.token, `/students/${f.student.id}/progress`);
    expect(res.status).toBe(200);
    expect(res.body.assessments).toHaveLength(5);
    expect(res.body.assessments.map((a: { totalPercent: string }) => a.totalPercent)).toEqual([
      "60.00", "65.00", "70.00", "75.00", "80.00",
    ]);
  });

  it("ФШ-42: босго 60% үед 55% авсан сэдэв сул, 65% авсан сэдэв сул биш", async () => {
    const f = await fixture();
    await record(f.teacher.token, f.student.id, {
      type: "QUIZ",
      contractId: f.contract.id,
      takenOn: "2026-10-01",
      topics: [
        { topic: "Бутархай", scorePercent: 55 },
        { topic: "Хувь", scorePercent: 65 },
      ],
    });
    const res = await get(f.teacher.token, `/students/${f.student.id}/progress`);
    expect(res.body.weakTopics.map((t: { topic: string }) => t.topic)).toEqual(["Бутархай"]);
    expect(res.body.weakTopicThresholdPercent).toBe(60);
  });

  it("ФБШ-20: дүн харах эрх: өөрийн хүүхэд, өөрийн сурагч, өөрийн багш, админ; бусад 403", async () => {
    const f = await fixture();
    const other = await fixture();
    const admin = await loginUser(Role.ADMIN);

    expect((await get(f.parent.token, `/students/${f.student.id}/progress`)).status).toBe(200);
    expect((await get(admin.token, `/students/${f.student.id}/progress`)).status).toBe(200);
    expect((await get(other.parent.token, `/students/${f.student.id}/progress`)).status).toBe(403);
    expect((await get(other.teacher.token, `/students/${f.student.id}/progress`)).status).toBe(403);

    const denied = await record(other.teacher.token, f.student.id, {
      type: "QUIZ",
      contractId: f.contract.id,
      takenOn: "2026-10-01",
      totalPercent: 50,
    });
    expect(denied.status).toBe(403);
    const parentWrite = await record(f.parent.token, f.student.id, { type: "PLACEMENT", takenOn: "2026-10-01", totalPercent: 50 });
    expect(parentWrite.status).toBe(403);
  });
});

describe("М6 Хичээлийн тэмдэглэл, уулзалт (ФШ-43...45)", () => {
  async function note(token: string, lessonId: string, contractId: string, visibility: string) {
    return request(app)
      .post(`/api/v1/lessons/${lessonId}/notes`)
      .set("Authorization", `Bearer ${token}`)
      .send({ contractId, visibility, body: `${visibility} тэмдэглэл` });
  }

  it("ФШ-44: дотоод тэмдэглэл эцэг эхэд харагдахгүй, хуваалцсан харагдана; сурагчид хоёулаа хаалттай; админ бүгдийг харна", async () => {
    const f = await fixture();
    expect((await note(f.teacher.token, f.lesson.id, f.contract.id, "INTERNAL")).status).toBe(201);
    expect((await note(f.teacher.token, f.lesson.id, f.contract.id, "SHARED")).status).toBe(201);

    const parentView = await get(f.parent.token, `/contracts/${f.contract.id}/notes`);
    expect(parentView.status).toBe(200);
    expect(parentView.body.map((n: { visibility: string }) => n.visibility)).toEqual(["SHARED"]);

    const adminUser = await loginUser(Role.ADMIN);
    const adminView = await get(adminUser.token, `/contracts/${f.contract.id}/notes`);
    expect(adminView.body).toHaveLength(2);
    const teacherView = await get(f.teacher.token, `/contracts/${f.contract.id}/notes`);
    expect(teacherView.body).toHaveLength(2);

    const studentUser = await loginUser(Role.STUDENT);
    expect((await get(studentUser.token, `/contracts/${f.contract.id}/notes`)).status).toBe(403);
  });

  it("ФБШ-20: бусад эцэг эх, бусад багш тэмдэглэл харах, бичих, засахад 403", async () => {
    const f = await fixture();
    const other = await fixture();
    const created = await note(f.teacher.token, f.lesson.id, f.contract.id, "SHARED");

    expect((await get(other.parent.token, `/contracts/${f.contract.id}/notes`)).status).toBe(403);
    expect((await get(other.teacher.token, `/contracts/${f.contract.id}/notes`)).status).toBe(403);
    expect((await note(other.teacher.token, f.lesson.id, f.contract.id, "SHARED")).status).toBe(403);
    const edit = await request(app)
      .patch(`/api/v1/notes/${created.body.id}`)
      .set("Authorization", `Bearer ${other.teacher.token}`)
      .send({ body: "хулгай" });
    expect(edit.status).toBe(403);

    const own = await request(app)
      .patch(`/api/v1/notes/${created.body.id}`)
      .set("Authorization", `Bearer ${f.teacher.token}`)
      .send({ visibility: "INTERNAL" });
    expect(own.status).toBe(200);
    expect(own.body.visibility).toBe("INTERNAL");
  });

  it("ФШ-45, 43: уулзалт бүртгэхэд тоо нэмэгдэж, сануулга биелсэн болно; админ тоог харна", async () => {
    const f = await fixture();
    const task = await prisma.teacherTask.create({
      data: { teacherId: f.teacher.userId, type: "MEETING", contractId: f.contract.id, dueOn: new Date() },
    });
    for (const metOn of ["2026-10-10", "2026-10-20"]) {
      const res = await request(app)
        .post(`/api/v1/contracts/${f.contract.id}/meetings`)
        .set("Authorization", `Bearer ${f.teacher.token}`)
        .send({ metOn, summary: "Явцыг танилцуулсан" });
      expect(res.status).toBe(201);
    }
    expect((await prisma.teacherTask.findUniqueOrThrow({ where: { id: task.id } })).doneAt).not.toBeNull();

    const admin = await loginUser(Role.ADMIN);
    const detail = await get(admin.token, `/students/${f.student.id}`);
    expect(detail.body.contracts[0].meetingsCount).toBe(2);

    const other = await fixture();
    const denied = await request(app)
      .post(`/api/v1/contracts/${f.contract.id}/meetings`)
      .set("Authorization", `Bearer ${other.teacher.token}`)
      .send({ metOn: "2026-10-21", summary: "x" });
    expect(denied.status).toBe(403);
  });
});
