// e2e өмнө: pitoo_e2e өгөгдлийн санг шинээр үүсгэж, migration ба seed ажиллуулна.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { E2E, apiEnv } from "./env.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "apps", "api");
const require = createRequire(path.join(apiDir, "package.json"));
const { Client } = require("pg");

const admin = new Client({ connectionString: E2E.adminDatabaseUrl });
await admin.connect();
await admin.query(`DROP DATABASE IF EXISTS ${E2E.dbName} WITH (FORCE)`);
await admin.query(`CREATE DATABASE ${E2E.dbName}`);
await admin.end();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: apiDir,
    env: { ...process.env, ...apiEnv() },
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "migrate", "deploy"]);
run("npx", ["tsx", "prisma/seed.ts"]);

// Seed-ийн админ түр нууц үгтэй (must_change_password) тул e2e-д шууд нэвтрэхээр
// тэмдгийг цэвэрлэнэ. Нууц үг солих урсгалыг тусад нь шалгана.
const db = new Client({ connectionString: E2E.databaseUrl });
await db.connect();
await db.query("UPDATE users SET must_change_password = false WHERE phone = $1", [E2E.adminPhone]);
await db.end();
console.log("e2e өгөгдлийн сан бэлэн боллоо.");
