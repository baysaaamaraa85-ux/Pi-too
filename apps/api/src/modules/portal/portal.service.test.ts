import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";

const app = createApp();

function uniquePhone(prefix: string) {
  return `${prefix}${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

async function loginAs(phone: string, password: string) {
  const res = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password });
  return res.body.accessToken as string;
}

async function createTeacher() {
  const phone = uniquePhone("t");
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role: Role.TEACHER, phone, passwordHash } });
  await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  return { token: await loginAs(phone, "Correct123!"), teacherId: user.id };
}

// Эцэг эх + сурагч (өөрийн данстай эсвэл үгүй) + гэрээ + ангид бүртгэл. Анги үүсэхэд
// ирэх 4 долоо хоногийн хичээл автоматаар үүснэ (ФШ-23).
async function createFamily(options: { withStudentAccount: boolean }) {
  const { token: teacherToken, teacherId } = await createTeacher();
  const branch = await prisma.branch.create({
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  const program = await prisma.program.create({
    data: { name: `Хөтөлбөр ${randomUUID().slice(0, 8)}`, currentPrice: "1200000.00" },
  });
  // Өдөр бүрийн 2 өөр гаригт давхцахгүй ангийг тестийн хооронд санамсаргүй сонгоно.
  const weekday = 1 + Math.floor(Math.random() * 7);
  const classRes = await request(app)
    .post("/api/v1/classes")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({ branchId: branch.id, weekday, startTime: "09:00" });
  const classId = classRes.body.id as string;

  const parentPhone = uniquePhone("p");
  const studentPhone = options.withStudentAccount ? uniquePhone("s") : undefined;
  const registerRes = await request(app)
    .post("/api/v1/students")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({
      parentPhone,
      parentFullName: "Эцэг эх",
      studentFullName: "Сурагч Тест",
      studentPhone,
    });

  const contractRes = await request(app)
    .post("/api/v1/contracts")
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({
      studentId: registerRes.body.studentId,
      programId: program.id,
      rulesAckAt: new Date().toISOString(),
    });
  await request(app)
    .post(`/api/v1/classes/${classId}/enrollments`)
    .set("Authorization", `Bearer ${teacherToken}`)
    .send({ contractId: contractRes.body.id, fromDate: new Date().toISOString().slice(0, 10) });

  return {
    teacherId,
    classId,
    studentId: registerRes.body.studentId as string,
    contractId: contractRes.body.id as string,
    parentToken: await loginAs(parentPhone, registerRes.body.tempPassword as string),
    studentToken: studentPhone
      ? await loginAs(studentPhone, registerRes.body.studentTempPassword as string)
      : undefined,
  };
}

async function upcomingLesson(classId: string) {
  return prisma.lesson.findFirstOrThrow({
    where: { classId, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
}

describe("Порталын хэсэг: эцэг эх, сурагч", () => {
  it("ФШ-12: сурагчийн утас өгвөл сурагч өөрийн STUDENT данстай болж нэвтэрнэ", async () => {
    const family = await createFamily({ withStudentAccount: true });
    expect(family.studentToken).toBeTypeOf("string");

    const summary = await request(app)
      .get("/api/v1/portal/summary")
      .set("Authorization", `Bearer ${family.studentToken}`);
    expect(summary.status).toBe(200);
    expect(summary.body.students).toHaveLength(1);
    expect(summary.body.students[0].studentId).toBe(family.studentId);
  });

  it("ФШ-23: эцэг эх зөвхөн өөрийн хүүхдийг харна, гэрээний тоолуур, ангийн мэдээлэлтэй", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const other = await createFamily({ withStudentAccount: false });

    const res = await request(app)
      .get("/api/v1/portal/summary")
      .set("Authorization", `Bearer ${family.parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].studentId).toBe(family.studentId);
    expect(res.body.students[0].studentId).not.toBe(other.studentId);

    const contract = res.body.students[0].contracts[0];
    expect(contract.remainingVisits).toBe(25);
    expect(contract.leavesLeft).toBe(3);
    expect(contract.classes).toHaveLength(1);
    expect(contract.classes[0].teacherName).toBe("Тест багш");
    // Порталын summary-д үнэ, төлбөр орохгүй.
    expect(contract.price).toBeUndefined();
  });

  it("ФШ-66: сурагч төлбөрийн зааврыг авах эрхгүй (403)", async () => {
    const family = await createFamily({ withStudentAccount: true });
    const res = await request(app)
      .get(`/api/v1/portal/contracts/${family.contractId}/payment-instructions`)
      .set("Authorization", `Bearer ${family.studentToken}`);
    expect(res.status).toBe(403);
  });

  it("ФШ-49: эцэг эх өөрийн гэрээний төлбөрийн зааврыг (данс, гүйлгээний утга) авна", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const res = await request(app)
      .get(`/api/v1/portal/contracts/${family.contractId}/payment-instructions`)
      .set("Authorization", `Bearer ${family.parentToken}`);
    expect(res.status).toBe(200);
    expect(res.body.price).toBe("1200000.00");
    expect(res.body.account.accountNumber).toBeTypeOf("string");
    expect(res.body.transferNote).toBe("Сурагч Тест - Тест багш");
  });

  it("BOLA: өөр эцэг эхийн хүүхдийн ирц, гэрээний төлбөрийг харахад 403", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const stranger = await createFamily({ withStudentAccount: false });

    const attendance = await request(app)
      .get(`/api/v1/portal/students/${family.studentId}/attendance`)
      .set("Authorization", `Bearer ${stranger.parentToken}`);
    expect(attendance.status).toBe(403);

    const payment = await request(app)
      .get(`/api/v1/portal/contracts/${family.contractId}/payment-instructions`)
      .set("Authorization", `Bearer ${stranger.parentToken}`);
    expect(payment.status).toBe(403);
  });

  it("BOLA: сурагч өөр сурагчийн ирцийг харахад 403, өөрийнхийг харна", async () => {
    const family = await createFamily({ withStudentAccount: true });
    const stranger = await createFamily({ withStudentAccount: true });

    const foreign = await request(app)
      .get(`/api/v1/portal/students/${stranger.studentId}/attendance`)
      .set("Authorization", `Bearer ${family.studentToken}`);
    expect(foreign.status).toBe(403);

    const own = await request(app)
      .get(`/api/v1/portal/students/${family.studentId}/attendance`)
      .set("Authorization", `Bearer ${family.studentToken}`);
    expect(own.status).toBe(200);
    expect(own.body.records).toEqual([]);
  });

  it("ФШ-30: эцэг эх чөлөө хүсэхэд багшид мэдэгдэл бичигдэж, дахин хүсвэл 409", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const lesson = await upcomingLesson(family.classId);

    const first = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${family.parentToken}`)
      .send({ contractId: family.contractId, lessonId: lesson.id });
    expect(first.status).toBe(201);

    const outbox = await prisma.notificationOutbox.findMany({
      where: { recipientId: family.teacherId, template: "leave_requested" },
    });
    expect(outbox.length).toBeGreaterThan(0);

    const second = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${family.parentToken}`)
      .send({ contractId: family.contractId, lessonId: lesson.id });
    expect(second.status).toBe(409);
    expect(second.body.type).toContain("leave-request-exists");

    // Ирцийн хуудсанд харагдах хүсэлтүүд порталд буцна.
    const overview = await request(app)
      .get(`/api/v1/portal/students/${family.studentId}/attendance`)
      .set("Authorization", `Bearer ${family.parentToken}`);
    expect(overview.body.leaveRequests).toEqual([
      { lessonId: lesson.id, contractId: family.contractId },
    ]);
  });

  it("ФШ-30: сурагч өөрийн гэрээнд чөлөө хүсч чадна (удирдлагын шийдвэр 2026.10.27)", async () => {
    const family = await createFamily({ withStudentAccount: true });
    const lesson = await upcomingLesson(family.classId);

    const res = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${family.studentToken}`)
      .send({ contractId: family.contractId, lessonId: lesson.id });
    expect(res.status).toBe(201);
  });

  it("BOLA, ФШ-30: өөр хүүхдийн гэрээнд чөлөө хүсэхэд 403", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const stranger = await createFamily({ withStudentAccount: false });
    const lesson = await upcomingLesson(family.classId);

    const res = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${stranger.parentToken}`)
      .send({ contractId: family.contractId, lessonId: lesson.id });
    expect(res.status).toBe(403);
  });

  it("ФШ-30: эхэлсэн хичээлд чөлөө хүсэхэд 409", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const lesson = await upcomingLesson(family.classId);
    // Хичээлийг өнгөрсөн болгож, "хичээл эхлэхээс өмнө" шалгалтыг турших.
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        startsAt: new Date(Date.now() - 3_600_000),
        endsAt: new Date(Date.now() + 3_600_000),
      },
    });

    const res = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${family.parentToken}`)
      .send({ contractId: family.contractId, lessonId: lesson.id });
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("leave-too-late");
  });

  it("ФШ-30: бүртгэлгүй ангийн хичээлд чөлөө хүсэхэд 409", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const unrelated = await createFamily({ withStudentAccount: false });
    const foreignLesson = await upcomingLesson(unrelated.classId);

    const res = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${family.parentToken}`)
      .send({ contractId: family.contractId, lessonId: foreignLesson.id });
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("not-enrolled-in-lesson");
  });

  it("Эрхийн матриц: багш чөлөөний хүсэлт гаргах эрхгүй (403)", async () => {
    const family = await createFamily({ withStudentAccount: false });
    const { token } = await createTeacher();
    const lesson = await upcomingLesson(family.classId);

    const res = await request(app)
      .post("/api/v1/leave-requests")
      .set("Authorization", `Bearer ${token}`)
      .send({ contractId: family.contractId, lessonId: lesson.id });
    expect(res.status).toBe(403);
  });

  // ФШ-67: хоёр багц дуусгасан сурагчийн эцэг эх 50 ирэлтийг огноо, төлөвтэй нь, багц бүрээр нь харна.
  it("ФШ-67: хоёр дууссан багцын 50 ирэлт огноо, төлөв, багцын ID-тай буцаж, багцын шалгалтын дүн харагдана", async () => {
    const family = await createFamily({ withStudentAccount: true });
    const lessonStart = (n: number) => new Date(Date.UTC(2026, 0, 1 + n, 2, 0, 0));
    const statuses = ["PRESENT", "EXCUSED", "OVER_LIMIT", "MAKEUP"] as const;
    const program = (await prisma.contract.findUniqueOrThrow({ where: { id: family.contractId } })).programId;

    const contractIds: string[] = [];
    for (let pack = 0; pack < 2; pack++) {
      const contract =
        pack === 0
          ? await prisma.contract.update({
              where: { id: family.contractId },
              data: { status: "COMPLETED", remainingVisits: 0 },
            })
          : await prisma.contract.create({
              data: {
                studentId: family.studentId,
                programId: program,
                price: "1200000.00",
                totalVisits: 25,
                remainingVisits: 0,
                leavesLeft: 3,
                status: "COMPLETED",
                rulesAckAt: new Date(),
              },
            });
      contractIds.push(contract.id);
      for (let i = 0; i < 25; i++) {
        const n = pack * 25 + i;
        const lesson = await prisma.lesson.create({
          data: {
            classId: family.classId,
            teacherId: family.teacherId,
            startsAt: lessonStart(n),
            endsAt: new Date(lessonStart(n).getTime() + 90 * 60_000),
            originalStartsAt: lessonStart(n),
            status: "SCHEDULED",
          },
        });
        await prisma.attendance.create({
          data: {
            lessonId: lesson.id,
            contractId: contract.id,
            marked: true,
            status: statuses[i % statuses.length]!,
            updatedBy: family.teacherId,
          },
        });
      }
    }
    await prisma.assessment.create({
      data: {
        studentId: family.studentId,
        contractId: contractIds[0]!,
        type: "BATCH_EXAM",
        takenOn: new Date("2026-03-01"),
        totalPercent: "88.00",
      },
    });

    for (const token of [family.parentToken, family.studentToken!]) {
      const res = await request(app)
        .get(`/api/v1/portal/students/${family.studentId}/attendance`)
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      const records = res.body.records as { contractId: string; startsAt: string; status: string }[];
      expect(records).toHaveLength(50);
      expect(records.filter((r) => r.contractId === contractIds[0])).toHaveLength(25);
      expect(records.filter((r) => r.contractId === contractIds[1])).toHaveLength(25);
      expect(records.every((r) => Boolean(r.startsAt) && Boolean(r.status))).toBe(true);
      const dates = records.map((r) => r.startsAt);
      expect(dates).toEqual([...dates].sort().reverse());
    }

    const progress = await request(app)
      .get(`/api/v1/students/${family.studentId}/progress`)
      .set("Authorization", `Bearer ${family.parentToken}`);
    expect(progress.status).toBe(200);
    expect(progress.body.assessments).toEqual([
      expect.objectContaining({ type: "BATCH_EXAM", contractId: contractIds[0], totalPercent: "88.00" }),
    ]);

    const summary = await request(app).get("/api/v1/portal/summary").set("Authorization", `Bearer ${family.parentToken}`);
    const ids = summary.body.students[0].contracts.map((c: { id: string }) => c.id);
    expect(ids).toEqual(expect.arrayContaining(contractIds));
  });
});
