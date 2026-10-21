import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./prisma.js";
import { LedgerType, Role } from "../../generated/prisma/client.js";

// Эдгээр тестүүд Prisma схемоор илэрхийлэгдэхгүй, гараар бичсэн migration-ийн
// хязгаарлалтуудыг шалгана (CLAUDE.md 7-р хэсэг, constraints migration).
describe("Өгөгдлийн сангийн гараар бичсэн хязгаарлалтууд", () => {
  let adminUserId: string;
  let teacherUserId: string;
  let branchId: string;
  let programId: string;
  let studentId: string;
  let contractId: string;
  let classId: string;
  let lessonId: string;

  beforeAll(async () => {
    const unique = randomUUID().slice(0, 8);

    const admin = await prisma.user.create({
      data: {
        role: Role.ADMIN,
        phone: `t-admin-${unique}`,
        passwordHash: "x",
      },
    });
    adminUserId = admin.id;

    const teacherUser = await prisma.user.create({
      data: {
        role: Role.TEACHER,
        phone: `t-teacher-${unique}`,
        passwordHash: "x",
      },
    });
    teacherUserId = teacherUser.id;
    await prisma.teacher.create({ data: { userId: teacherUserId, fullName: "Тест багш" } });

    const branch = await prisma.branch.create({
      data: { name: `Тест салбар ${unique}`, address: "хаяг" },
    });
    branchId = branch.id;

    const program = await prisma.program.create({
      data: { name: `Тест хөтөлбөр ${unique}`, currentPrice: "500000.00" },
    });
    programId = program.id;

    const student = await prisma.student.create({ data: { fullName: "Тест сурагч" } });
    studentId = student.id;

    const contract = await prisma.contract.create({
      data: {
        studentId,
        programId,
        price: "500000.00",
        totalVisits: 25,
        remainingVisits: 25,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });
    contractId = contract.id;

    const cls = await prisma.class.create({
      data: { teacherId: teacherUserId, branchId, weekday: 1, startTime: "10:00" },
    });
    classId = cls.id;

    const startsAt = new Date("2026-11-02T10:00:00Z");
    const endsAt = new Date("2026-11-02T12:00:00Z");
    const lesson = await prisma.lesson.create({
      data: {
        classId,
        teacherId: teacherUserId,
        startsAt,
        endsAt,
        originalStartsAt: startsAt,
      },
    });
    lessonId = lesson.id;
  });

  // Санамж: цэвэрлэх алхам зориуд алга. ledger_entries зөвхөн нэмэгддэг
  // (ФБШ-24, pitoo_app-д UPDATE/DELETE эрхгүй) тул энэ фикстурыг устгах
  // боломжгүй, устгавал дээш чиглэлд Lesson/Teacher/User хүртэл Restrict-ээр
  // хоригдоно. pitoo_test DB-г бүрэн цэвэрлэх бол `prisma migrate reset`.

  it("сөрөг remaining_visits бичигдэхгүй (ADR-009)", async () => {
    await expect(
      prisma.contract.update({ where: { id: contractId }, data: { remainingVisits: -1 } }),
    ).rejects.toThrow();
  });

  it("remaining_visits нийт ирэлтээс хэтэрч бичигдэхгүй (ADR-009)", async () => {
    await expect(
      prisma.contract.update({ where: { id: contractId }, data: { remainingVisits: 999 } }),
    ).rejects.toThrow();
  });

  it("нэг багшид давхцсан хичээл бичигдэхгүй (ФШ-25)", async () => {
    await expect(
      prisma.lesson.create({
        data: {
          classId,
          teacherId: teacherUserId,
          startsAt: new Date("2026-11-02T11:00:00Z"),
          endsAt: new Date("2026-11-02T13:00:00Z"),
          originalStartsAt: new Date("2026-11-02T11:00:00Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("нэг хичээлд хоёр EARNING бичигдэхгүй (ADR-010)", async () => {
    await prisma.ledgerEntry.create({
      data: {
        teacherId: teacherUserId,
        type: LedgerType.EARNING,
        amount: "40000.00",
        lessonId,
        createdBy: adminUserId,
      },
    });

    await expect(
      prisma.ledgerEntry.create({
        data: {
          teacherId: teacherUserId,
          type: LedgerType.EARNING,
          amount: "40000.00",
          lessonId,
          createdBy: adminUserId,
        },
      }),
    ).rejects.toThrow();
  });
});
