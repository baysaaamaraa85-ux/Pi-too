import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/db/prisma.js";
import { Role } from "../src/generated/prisma/client.js";

const ADMIN_PHONE = process.env.ADMIN_PHONE;
const ADMIN_TEMP_PASSWORD = process.env.ADMIN_TEMP_PASSWORD;

if (!ADMIN_PHONE || !ADMIN_TEMP_PASSWORD) {
  console.error("ADMIN_PHONE, ADMIN_TEMP_PASSWORD .env-д тохируулагдсан байх ёстой.");
  process.exit(1);
}

async function main() {
  // ФБШ-18: bcrypt, cost >= 10.
  const adminPasswordHash = await bcrypt.hash(ADMIN_TEMP_PASSWORD!, 10);

  const admin = await prisma.user.upsert({
    where: { phone: ADMIN_PHONE },
    update: {},
    create: {
      role: Role.ADMIN,
      phone: ADMIN_PHONE,
      passwordHash: adminPasswordHash,
      mustChangePassword: true,
    },
  });
  console.log(`Админ: ${admin.phone} (түр нууц үг: .env-ийн ADMIN_TEMP_PASSWORD)`);

  // ФШ-07: 2 салбар.
  const branch1 = await prisma.branch.upsert({
    where: { name: "Төв салбар" },
    update: {},
    create: { name: "Төв салбар", address: "Улаанбаатар, Сүхбаатар дүүрэг" },
  });
  const branch2 = await prisma.branch.upsert({
    where: { name: "Баруун 4 зам салбар" },
    update: {},
    create: { name: "Баруун 4 зам салбар", address: "Улаанбаатар, Хан-Уул дүүрэг" },
  });

  // ФШ-08: 2 хөтөлбөр.
  const program1 = await prisma.program.upsert({
    where: { name: "Бага анги" },
    update: {},
    create: { name: "Бага анги", currentPrice: "600000.00" },
  });
  const program2 = await prisma.program.upsert({
    where: { name: "Дунд анги" },
    update: {},
    create: { name: "Дунд анги", currentPrice: "700000.00" },
  });

  // ФШ-10: 2 багш, үнэлгээтэй.
  const teacherPasswordHash = await bcrypt.hash("Teacher123!", 10);

  async function ensureTeacher(phone: string, fullName: string, hourlyRate: string) {
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        role: Role.TEACHER,
        phone,
        passwordHash: teacherPasswordHash,
        mustChangePassword: true,
      },
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, fullName },
    });
    const existingRate = await prisma.teacherRate.findFirst({
      where: { teacherId: teacher.userId },
    });
    if (!existingRate) {
      await prisma.teacherRate.create({
        data: {
          teacherId: teacher.userId,
          hourlyRate,
          effectiveFrom: new Date(),
        },
      });
    }
    return teacher;
  }

  await ensureTeacher("99112233", "Б.Солонго", "15000.00");
  await ensureTeacher("99223344", "Д.Эрдэнэ", "16000.00");

  // ФШ-09, ФБШ-29: журмын утгууд. Код дотор биш, эндээс уншина.
  await prisma.settings.upsert({
    where: { key: "contract_defaults" },
    update: {},
    create: {
      key: "contract_defaults",
      value: {
        totalAcademicHours: 75,
        academicHoursPerVisit: 3,
        academicHourMinutes: 40,
        defaultLeaves: 3,
      },
    },
  });
  await prisma.settings.upsert({
    where: { key: "assessment_defaults" },
    update: {},
    create: { key: "assessment_defaults", value: { freeReviewThresholdPercent: 93 } },
  });
  await prisma.settings.upsert({
    where: { key: "class_defaults" },
    update: {},
    create: { key: "class_defaults", value: { maxCapacity: 6 } },
  });
  await prisma.settings.upsert({
    where: { key: "attendance_defaults" },
    update: {},
    create: { key: "attendance_defaults", value: { editWindowHours: 24 } },
  });
  await prisma.settings.upsert({
    where: { key: "payment_account" },
    update: {},
    create: {
      key: "payment_account",
      value: {
        bankName: "Хаан банк",
        accountHolder: "Пи тоо ХХК",
        accountNumber: "5000123456",
      },
    },
  });

  console.log(`Салбар: ${branch1.name}, ${branch2.name}`);
  console.log(`Хөтөлбөр: ${program1.name}, ${program2.name}`);
  console.log("Seed амжилттай дууслаа.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
