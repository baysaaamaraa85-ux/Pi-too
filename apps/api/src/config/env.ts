import { z } from "zod";

// ФБШ-29: журмын тоон утгууд энд биш, settings хүснэгтэд байна. Энэ файлд
// зөвхөн орчны тохиргоо (DB хаяг, нууц түлхүүр) байх ёстой (design 8.5).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url().optional(),
  // ФБШ-24: аппликейшн pitoo_app хэрэглэгчээр холбогдоно (audit_log, ledger_entries
  // хүснэгтэд UPDATE/DELETE эрхгүй). DATABASE_URL-ийг зөвхөн Prisma CLI
  // (migrate, seed) postgres superuser-ээр ашиглана.
  APP_DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET 32 тэмдэгтээс багагүй байх ёстой"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET 32 тэмдэгтээс багагүй байх ёстой"),
  APP_ORIGIN: z.url(),
  // М9 Мэдэгдэл (ФШ-05, 62): суваг тохируулаагүй бол тухайн суваг FAILED болно.
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().min(1).default("mailto:admin@pi-too.mn"),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).default("Пи тоо <no-reply@pi-too.mn>"),
  // Багш, салбарын зураг хадгалах хавтас (apps/api-ийн дотор хандлагатай зам). git-д орохгүй.
  UPLOAD_DIR: z.string().min(1).default("uploads"),
  ADMIN_PHONE: z.string().min(1).optional(),
  ADMIN_TEMP_PASSWORD: z.string().min(8).optional(),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Орчны тохиргоо дутуу эсвэл буруу байна (.env файлыг шалгаарай):");
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
export type Env = typeof env;
