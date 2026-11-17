// Хөгжүүлэлтийн демо өгөгдөл: багш (Баясгалан), эцэг (Бат), сурагч (Хулан), гэрээ, анги.
// Ажиллуулах: npm run db:seed:demo -w @pitoo/api (давтан ажиллуулахад давхардахгүй).
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/db/prisma.js";
import { Role } from "../src/generated/prisma/client.js";
import {
  LESSON_HORIZON_WEEKS,
  generateLessons,
  todayInUlaanbaatar,
} from "../src/modules/scheduling/scheduling.service.js";

const DEMO_PASSWORD = "Demo12345!";
const TEACHER_PHONE = "99010003";
const PARENT_PHONE = "99010002";
const STUDENT_PHONE = "99010001";

async function upsertUser(role: Role, phone: string, passwordHash: string) {
  return prisma.user.upsert({
    where: { phone },
    update: {},
    create: { role, phone, passwordHash },
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // seed.ts-ийн үндсэн салбар, хөтөлбөр (туршилтын өгөгдөл биш).
  const branch = await prisma.branch.findFirstOrThrow({ where: { name: "Төв салбар" } });
  const program = await prisma.program.findFirstOrThrow({ where: { name: "Монгол стандарт" } });

  const teacherUser = await upsertUser(Role.TEACHER, TEACHER_PHONE, passwordHash);
  await prisma.teacher.upsert({
    where: { userId: teacherUser.id },
    update: { fullName: "Баясгалан" },
    create: { userId: teacherUser.id, fullName: "Баясгалан" },
  });

  const parentUser = await upsertUser(Role.PARENT, PARENT_PHONE, passwordHash);
  await prisma.parent.upsert({
    where: { userId: parentUser.id },
    update: { fullName: "Бат" },
    create: { userId: parentUser.id, fullName: "Бат", phone: PARENT_PHONE },
  });

  const studentUser = await upsertUser(Role.STUDENT, STUDENT_PHONE, passwordHash);
  const student = await prisma.student.upsert({
    where: { userId: studentUser.id },
    update: { fullName: "Хулан" },
    create: { userId: studentUser.id, fullName: "Хулан", grade: "9-р анги" },
  });
  await prisma.parentStudent.upsert({
    where: { parentId_studentId: { parentId: parentUser.id, studentId: student.id } },
    update: {},
    create: { parentId: parentUser.id, studentId: student.id },
  });

  const existingContract = await prisma.contract.findFirst({ where: { studentId: student.id } });
  const contract = existingContract
    ? await prisma.contract.update({
        where: { id: existingContract.id },
        data: { programId: program.id, price: program.currentPrice },
      })
    : await prisma.contract.create({
      data: {
        studentId: student.id,
        programId: program.id,
        price: program.currentPrice,
        totalHours: 75,
        remainingHours: 75,
        leavesLeft: 3,
        rulesAckAt: new Date(),
      },
    });

  // Өнөөдрийн гараг, оройн цагт анги: өнөөдрийн хичээл календарьт шууд харагдана.
  const localNow = new Date(Date.now() + 8 * 3_600_000);
  const weekday = localNow.getUTCDay() === 0 ? 7 : localNow.getUTCDay();
  const existingClass = await prisma.class.findFirst({ where: { teacherId: teacherUser.id } });
  const demoClass = existingClass
    ? await prisma.class.update({ where: { id: existingClass.id }, data: { branchId: branch.id } })
    : await prisma.class.create({
      data: {
        teacherId: teacherUser.id,
        branchId: branch.id,
        weekday,
        startTime: "23:00",
        durationMin: 120,
        capacity: 6,
      },
    });

  const enrolled = await prisma.enrollment.findFirst({
    where: { contractId: contract.id, classId: demoClass.id, toDate: null },
  });
  if (!enrolled) {
    await prisma.enrollment.create({
      data: { contractId: contract.id, classId: demoClass.id, fromDate: new Date() },
    });
  }

  await generateLessons(todayInUlaanbaatar(), LESSON_HORIZON_WEEKS);

  console.log("Демо данснууд (нууц үг бүгд: " + DEMO_PASSWORD + ")");
  console.log(`  Сурагч:   ${STUDENT_PHONE}`);
  console.log(`  Эцэг эх:  ${PARENT_PHONE}`);
  console.log(`  Багш:     ${TEACHER_PHONE}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
