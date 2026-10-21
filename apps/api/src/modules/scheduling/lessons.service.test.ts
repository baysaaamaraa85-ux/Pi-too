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
    const from = nextMonday(new Date());
    await generateLessons(from, 4);
    const firstRunLessons = await prisma.lesson.findMany({ where: { classId } });
    expect(firstRunLessons).toHaveLength(4);

    await generateLessons(from, 4); // давтан ажиллуулна
    const secondRunLessons = await prisma.lesson.findMany({ where: { classId } });
    expect(secondRunLessons).toHaveLength(4); // skipDuplicates тул өөрчлөгдөхгүй

    // 09:00 Улаанбаатар (UTC+8) = 01:00 UTC
    expect(secondRunLessons[0]!.startsAt.getUTCHours()).toBe(1);
  });

  it("ФШ-24, 60: хичээл цуцлахад сурагч/эцэг эхэд мэдэгдэл outbox-д бичигдэнэ", async () => {
    const { token, teacherId } = await loginAsTeacher();
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
        totalVisits: 25,
        remainingVisits: 25,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId, fromDate: new Date("2026-11-01") },
    });

    const lesson = await prisma.lesson.create({
      data: {
        classId,
        teacherId,
        startsAt: new Date("2026-11-03T02:00:00Z"),
        endsAt: new Date("2026-11-03T04:00:00Z"),
        originalStartsAt: new Date("2026-11-03T02:00:00Z"),
      },
    });

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
    await prisma.lesson.create({
      data: {
        classId,
        teacherId: (await prisma.class.findUniqueOrThrow({ where: { id: classId } })).teacherId,
        startsAt: new Date("2026-11-07T00:00:00Z"),
        endsAt: new Date("2026-11-07T02:00:00Z"),
        originalStartsAt: new Date("2026-11-07T00:00:00Z"),
      },
    });

    const { token: tokenB } = await loginAsTeacher();
    const res = await request(app)
      .get("/api/v1/lessons?from=2026-11-01&to=2026-11-14")
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.status).toBe(200);
    expect(res.body.find((l: { classId: string }) => l.classId === classId)).toBeUndefined();
  });
});
