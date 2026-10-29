// Нэг удаагийн туслах: ФШ-22 "weekly_lessons" тохиргоог одоо байгаа өгөгдлийн санд нэмнэ.
// Ажиллуулах: npx tsx prisma/add-weekly-lessons.ts (давтан ажиллуулахад аюулгүй).
import "dotenv/config";
import { prisma } from "../src/shared/db/prisma.js";

await prisma.settings.upsert({
  where: { key: "weekly_lessons" },
  update: {},
  create: { key: "weekly_lessons", value: { min: 2, max: 4 } },
});
console.log("weekly_lessons тохиргоо бэлэн.");
await prisma.$disconnect();
