import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role } from "../../generated/prisma/client.js";
import { generateLessons } from "./scheduling.service.js";

const app = createApp();

async function loginAsTeacher() {
  const phone = `l${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const passwordHash = await bcrypt.hash("Correct123!", 10);
  const user = await prisma.user.create({ data: { role: Role.TEACHER, phone, passwordHash } });
  await prisma.teacher.create({ data: { userId: user.id, fullName: "Тест багш" } });
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: phone, password: "Correct123!" });
  return { token: res.body.accessToken as string, teacherId: user.id as string };
}

async function createClassAs(token: string, weekday: number, startTime: string) {
  const branch = await prisma.branch.create({
    data: { name: `Салбар ${randomUUID().slice(0, 8)}`, address: "хаяг" },
  });
  const res = await request(app)
    .post("/api/v1/classes")
    .set("Authorization", `Bearer ${token}`)
    .send({ branchId: branch.id, weekday, startTime });
  return res.body.id as string;
}

// Өнөөдрөөс N хоногийн дараах огноо (YYYY-MM-DD).
function isoDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86_400_000).toISOString().slice(0, 10);
}

async function upcomingLessonOf(classId: string) {
  return prisma.lesson.findFirstOrThrow({
    where: { classId, startsAt: { gt: new Date() } },
    orderBy: { startsAt: "asc" },
  });
}

function nextMonday(from: Date): Date {
  const result = new Date(from);
  while (result.getUTCDay() !== 1) result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

describe("М4 Хуваарь: хичээл үүсгэх, цуцлах, шилжүүлэх", () => {
  it("ADR-011: ирэх 4 долоо хоногийн хичээл үүсгэж, давтан ажиллахад давхардахгүй", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 1, "09:00"); // 1 = Даваа

    // generateLessons нь АЛЬ ХЭДИЙН идэвхтэй бүх ангид ажилладаг (worker-ийн
    // бодит зорилго), тестийн орчинд өмнөх тестүүдийн анги ч идэвхтэй байж
    // болзошгүй тул нийт тоог биш, зөвхөн ӨӨРИЙН classId-тай хичээлийг шалгана.
    // Улаанбаатарын өнөөдрөөс (UTC+8) тоолно: шөнийн 00:00-08:00-д UTC огноо өчигдөр байдаг.
    const from = nextMonday(new Date(Date.now() + 8 * 3_600_000));
    await generateLessons(from, 4);
    const firstRunLessons = await prisma.lesson.findMany({ where: { classId } });
    expect(firstRunLessons).toHaveLength(4);

    await generateLessons(from, 4); // давтан ажиллуулна
    const secondRunLessons = await prisma.lesson.findMany({ where: { classId } });
    expect(secondRunLessons).toHaveLength(4); // skipDuplicates тул өөрчлөгдөхгүй

    // 09:00 Улаанбаатар (UTC+8) = 01:00 UTC
    expect(secondRunLessons[0]!.startsAt.getUTCHours()).toBe(1);
  });

  it("ФШ-23: анги үүсгэнгүүт ирэх 4 долоо хоногийн хичээл worker-гүйгээр шууд үүснэ", async () => {
    const { token } = await loginAsTeacher();
    // Өнөөдрийн Улаанбаатарын гараг дээр анги үүсгэвэл өнөөдрийн хичээл ч орно.
    const local = new Date(Date.now() + 8 * 3_600_000);
    const weekday = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
    const classId = await createClassAs(token, weekday, "09:00");

    const lessons = await prisma.lesson.findMany({
      where: { classId },
      orderBy: { startsAt: "asc" },
    });
    expect(lessons).toHaveLength(4);
    const todayLocal = lessons[0]!.startsAt.getTime() + 8 * 3_600_000;
    expect(new Date(todayLocal).getUTCDate()).toBe(local.getUTCDate());
  });

  it("ФШ-19: багш өөрийн ангийг устгахад анги идэвхгүй болж, ирээдүйн хичээл арилна", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "15:00");
    expect(await prisma.lesson.count({ where: { classId } })).toBe(4);

    const res = await request(app)
      .delete(`/api/v1/classes/${classId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const cls = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
    expect(cls.isActive).toBe(false);
    expect(await prisma.lesson.count({ where: { classId } })).toBe(0);

    const list = await request(app).get("/api/v1/classes").set("Authorization", `Bearer ${token}`);
    expect(list.body.find((c: { id: string }) => c.id === classId)).toBeUndefined();

    const audit = await prisma.auditLog.findFirst({ where: { entity: "class", entityId: classId } });
    expect(audit?.action).toBe("DELETE");
  });

  it("BOLA: багш өөр багшийн ангийг устгах боломжгүй (403)", async () => {
    const { token: ownerToken } = await loginAsTeacher();
    const { token: strangerToken } = await loginAsTeacher();
    const classId = await createClassAs(ownerToken, 3, "15:00");

    const res = await request(app)
      .delete(`/api/v1/classes/${classId}`)
      .set("Authorization", `Bearer ${strangerToken}`);
    expect(res.status).toBe(403);
    const cls = await prisma.class.findUniqueOrThrow({ where: { id: classId } });
    expect(cls.isActive).toBe(true);
  });

  it("ФШ-19: ангид идэвхтэй сурагч байвал устгахад 409", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 4, "15:00");
    const program = await prisma.program.create({
      data: { name: `П ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
    });
    const student = await prisma.student.create({ data: { fullName: "Сурагч" } });
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
      data: { contractId: contract.id, classId, fromDate: new Date() },
    });

    const res = await request(app)
      .delete(`/api/v1/classes/${classId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
    expect(res.body.type).toContain("class-has-students");
    expect((await prisma.class.findUniqueOrThrow({ where: { id: classId } })).isActive).toBe(true);
  });

  it("Анги устгахад чөлөөний хүсэлттэй (түүхтэй) хичээл цуцлагдсан төлөвт үлдэнэ", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 5, "15:00");
    const program = await prisma.program.create({
      data: { name: `П ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
    });
    const student = await prisma.student.create({ data: { fullName: "Сурагч" } });
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
    // Сурагч өмнө нь байсан ч бүртгэл нь хаагдсан (toDate), одоо идэвхтэй сурагчгүй.
    await prisma.enrollment.create({
      data: {
        contractId: contract.id,
        classId,
        fromDate: new Date("2026-01-01"),
        toDate: new Date("2026-01-31"),
      },
    });
    const keptLesson = await upcomingLessonOf(classId);
    const requester = await prisma.user.create({
      data: { role: Role.PARENT, phone: `lr${randomUUID().replace(/-/g, "").slice(0, 9)}`, passwordHash: "x" },
    });
    await prisma.leaveRequest.create({
      data: { contractId: contract.id, lessonId: keptLesson.id, requestedBy: requester.id },
    });

    const res = await request(app)
      .delete(`/api/v1/classes/${classId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const remaining = await prisma.lesson.findMany({ where: { classId } });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(keptLesson.id);
    expect(remaining[0]!.status).toBe("CANCELLED");
  });

  it("ФШ-24, 60: хичээл цуцлахад сурагч/эцэг эхэд мэдэгдэл outbox-д бичигдэнэ", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "10:00");

    const branch = await prisma.program.create({
      data: { name: `П ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
    });
    const parentUser = await prisma.user.create({
      data: {
        role: Role.PARENT,
        phone: `pp${randomUUID().replace(/-/g, "").slice(0, 9)}`,
        passwordHash: "x",
      },
    });
    await prisma.parent.create({ data: { userId: parentUser.id, fullName: "Эцэг эх", phone: parentUser.phone! } });
    const student = await prisma.student.create({ data: { fullName: "Сурагч" } });
    await prisma.parentStudent.create({ data: { parentId: parentUser.id, studentId: student.id } });
    const contract = await prisma.contract.create({
      data: {
        studentId: student.id,
        programId: branch.id,
        price: "500000.00",
        totalHours: 75,
        remainingHours: 75,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId, fromDate: new Date("2026-11-01") },
    });

    // Анги үүсэхэд хичээл автоматаар үүссэн (ФШ-23), тэр хичээлийг цуцална.
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classId } });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("CANCELLED");

    const outboxRows = await prisma.notificationOutbox.findMany({
      where: { recipientId: parentUser.id, template: "lesson_cancelled" },
    });
    expect(outboxRows.length).toBeGreaterThan(0);
  });

  // D-97: сурагч (өөрийн данстай эсэх), нэг эцэг эхтэй, ангид бүртгэлтэй нөхцөл бэлдэнэ.
  async function enrolledStudentWithParent(
    classId: string,
    withOwnAccount: boolean,
    school?: string,
  ) {
    const program = await prisma.program.create({
      data: { name: `П ${randomUUID().slice(0, 8)}`, currentPrice: "500000.00" },
    });
    const phone = () => `n${randomUUID().replace(/-/g, "").slice(0, 10)}`;
    const parentUser = await prisma.user.create({
      data: { role: Role.PARENT, phone: phone(), passwordHash: "x" },
    });
    await prisma.parent.create({
      data: { userId: parentUser.id, fullName: "Эцэг эх", phone: parentUser.phone! },
    });
    const studentUser = withOwnAccount
      ? await prisma.user.create({ data: { role: Role.STUDENT, phone: phone(), passwordHash: "x" } })
      : null;
    const student = await prisma.student.create({
      data: { fullName: "Сурагч", userId: studentUser?.id, school },
    });
    await prisma.parentStudent.create({ data: { parentId: parentUser.id, studentId: student.id } });
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
      data: { contractId: contract.id, classId, fromDate: new Date("2026-11-01") },
    });
    return { parentId: parentUser.id, studentUserId: studentUser?.id ?? null };
  }

  const outboxCount = (recipientId: string, template: string) =>
    prisma.notificationOutbox.count({ where: { recipientId, template } });

  it("ФШ-60: audience өгөөгүй (хуучин клиент) бол сурагч ба эцэг эх хоёуланд явна", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "11:00");
    const { parentId, studentUserId } = await enrolledStudentWithParent(classId, true);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classId } });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/cancel`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(await outboxCount(studentUserId!, "lesson_cancelled")).toBe(1);
    expect(await outboxCount(parentId, "lesson_cancelled")).toBe(1);
  });

  it("ФШ-60: STUDENTS_ONLY үед өөрийн данстай сурагчид явж, эцэг эхэд явахгүй", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "12:00");
    const { parentId, studentUserId } = await enrolledStudentWithParent(classId, true);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classId } });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ audience: "STUDENTS_ONLY" });
    expect(res.status).toBe(200);
    expect(await outboxCount(studentUserId!, "lesson_cancelled")).toBe(1);
    expect(await outboxCount(parentId, "lesson_cancelled")).toBe(0);

    const audit = await prisma.auditLog.findFirst({ where: { entity: "lesson", entityId: lesson.id } });
    expect(audit?.after).toMatchObject({ notifyAudience: "STUDENTS_ONLY" });
  });

  it("ФШ-60: STUDENTS_ONLY үед өөрийн дансгүй сурагчийн эцэг эхэд заавал явна", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "13:00");
    const { parentId } = await enrolledStudentWithParent(classId, false);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classId } });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ audience: "STUDENTS_ONLY" });
    expect(res.status).toBe(200);
    expect(await outboxCount(parentId, "lesson_cancelled")).toBe(1);
  });

  it("ФШ-60: цаг шилжүүлэхэд STUDENTS_ONLY сонголт цуцлахтай ижил ажиллана", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "14:00");
    const { parentId, studentUserId } = await enrolledStudentWithParent(classId, true);
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classId } });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        startsAt: "2027-03-02T02:00:00.000Z",
        endsAt: "2027-03-02T04:00:00.000Z",
        audience: "STUDENTS_ONLY",
      });
    expect(res.status).toBe(200);
    expect(await outboxCount(studentUserId!, "lesson_rescheduled")).toBe(1);
    expect(await outboxCount(parentId, "lesson_rescheduled")).toBe(0);
  });

  it("ФШ-60: audience буруу утгатай бол 422", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "15:00");
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { classId } });

    const res = await request(app)
      .post(`/api/v1/lessons/${lesson.id}/cancel`)
      .set("Authorization", `Bearer ${token}`)
      .send({ audience: "NOBODY" });
    expect(res.status).toBe(422);
  });

  it("D-97: ангийн сурагчдын жагсаалтад сургууль харагдана", async () => {
    const { token } = await loginAsTeacher();
    const classId = await createClassAs(token, 2, "16:00");
    await enrolledStudentWithParent(classId, false, "Тест сургууль");

    const res = await request(app)
      .get(`/api/v1/classes/${classId}/students`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.students[0].school).toBe("Тест сургууль");
  });

  it("ФШ-25: шилжүүлэхэд багшийн өөр хичээлтэй давхцвал 409", async () => {
    const { token, teacherId } = await loginAsTeacher();
    const classAId = await createClassAs(token, 3, "14:00");
    const classBId = await createClassAs(token, 4, "16:00");
    void classAId;

    const existingLesson = await prisma.lesson.create({
      data: {
        classId: classBId,
        teacherId,
        startsAt: new Date("2026-11-05T06:00:00Z"),
        endsAt: new Date("2026-11-05T08:00:00Z"),
        originalStartsAt: new Date("2026-11-05T06:00:00Z"),
      },
    });

    const toReschedule = await prisma.lesson.create({
      data: {
        classId: classBId,
        teacherId,
        startsAt: new Date("2026-11-12T06:00:00Z"),
        endsAt: new Date("2026-11-12T08:00:00Z"),
        originalStartsAt: new Date("2026-11-12T06:00:00Z"),
      },
    });

    const res = await request(app)
      .post(`/api/v1/lessons/${toReschedule.id}/reschedule`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        startsAt: existingLesson.startsAt.toISOString(),
        endsAt: existingLesson.endsAt.toISOString(),
      });

    expect(res.status).toBe(409);
    expect(res.body.type).toContain("lesson-time-conflict");
  });

  it("ФШ-23: багш зөвхөн өөрийн хичээлийг календарт харна", async () => {
    const { token: tokenA } = await loginAsTeacher();
    const classId = await createClassAs(tokenA, 6, "08:00");
    const { token: tokenB } = await loginAsTeacher();
    const res = await request(app)
      .get(`/api/v1/lessons?from=${isoDate(0)}&to=${isoDate(35)}`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.find((l: { classId: string }) => l.classId === classId)).toBeUndefined();
  });
});
