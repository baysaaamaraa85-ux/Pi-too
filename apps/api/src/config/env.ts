import { z } from "zod";

// ФБШ-29: журмын тоон утгууд энд биш, settings хүснэгтэд байна. Энэ файлд
// зөвхөн орчны тохиргоо (DB хаяг, нууц түлхүүр) байх ёстой (design 8.5).
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
  TEST_DATABASE_URL: z.url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET 32 тэмдэгтээс багагүй байх ёстой"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET 32 тэмдэгтээс багагүй байх ёстой"),
  APP_ORIGIN: z.url(),
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
