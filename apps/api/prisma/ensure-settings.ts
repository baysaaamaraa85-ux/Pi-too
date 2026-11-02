// Нэг удаагийн туслах: шинэ журмын тохиргоо (weekly_lessons, assessment_defaults-ийн нэмэлт
// талбар) одоо байгаа өгөгдлийн санд дутуу бол нэмнэ. Давтан ажиллуулахад аюулгүй,
// байгаа утгыг дарахгүй. Ажиллуулах: npx tsx prisma/ensure-settings.ts
import "dotenv/config";
import { prisma } from "../src/shared/db/prisma.js";

const DEFAULTS: Record<string, Record<string, unknown>> = {
  weekly_lessons: { min: 2, max: 4 },
  assessment_defaults: {
    freeReviewThresholdPercent: 93,
    freeReviewCount: 3,
    weakTopicThresholdPercent: 60,
  },
};

for (const [key, defaults] of Object.entries(DEFAULTS)) {
  const row = await prisma.settings.findUnique({ where: { key } });
  const current = (row?.value ?? {}) as Record<string, unknown>;
  const merged = { ...defaults, ...current };
  await prisma.settings.upsert({
    where: { key },
    update: { value: merged as never },
    create: { key, value: merged as never },
  });
  console.log(`${key}:`, JSON.stringify(merged));
}
await prisma.$disconnect();
