import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import pg from "pg";

// Тест бүрийн өмнө pitoo_test өгөгдлийн санг шинээр үүсгэнэ. Өмнөх ажиллуулалтын
// анги, хичээл хуримтлагдаад worker-ийн generateLessons мэт бүх ангиар явдаг
// тестүүд улам удааширдаг тул (мөн тест бие биенээсээ хамаарахгүй байхын тулд).
const dir = path.dirname(fileURLToPath(import.meta.url));
const apiDir = path.resolve(dir, "..");

export default async function setup() {
  const parsed = config({ path: path.join(apiDir, ".env.test"), quiet: true }).parsed ?? {};
  const env = { ...process.env, ...parsed };
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error(".env.test-д DATABASE_URL байх ёстой");

  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (!dbName.endsWith("_test")) {
    throw new Error(`Тестийн өгөгдлийн сангийн нэр "_test"-ээр төгсөх ёстой (одоо: ${dbName})`);
  }
  url.pathname = "/postgres";

  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${dbName}`);
  await admin.end();

  for (const args of [
    // pitoo_app үүрэг migration-аас өмнө APP_DATABASE_URL-аас үүснэ (нууц үг migration-д байхгүй).
    ["tsx", "prisma/bootstrap-app-role.ts"],
    ["prisma", "migrate", "deploy"],
    ["tsx", "prisma/seed.ts"],
  ]) {
    const result = spawnSync("npx", args, { cwd: apiDir, env, stdio: "pipe", shell: true });
    if (result.status !== 0) {
      throw new Error(`${args.join(" ")} амжилтгүй:\n${result.stdout}\n${result.stderr}`);
    }
  }
}
