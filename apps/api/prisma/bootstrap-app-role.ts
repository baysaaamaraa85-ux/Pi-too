import "dotenv/config";
import pg from "pg";
import { ensureAppRole, parseAppRoleUrl } from "../src/shared/db/app-role.js";

// prisma migrate-ээс ӨМНӨ ажиллана (db:deploy, db:migrate скрипт). DATABASE_URL нь
// superuser (migration хийгч), APP_DATABASE_URL нь аппликейшний pitoo_app хэрэглэгч.
// Нууц үг зөвхөн APP_DATABASE_URL-д байна, migration, кодонд биш.
const databaseUrl = process.env.DATABASE_URL;
const appDatabaseUrl = process.env.APP_DATABASE_URL;

if (!databaseUrl || !appDatabaseUrl) {
  console.error("DATABASE_URL, APP_DATABASE_URL хоёулаа тохируулагдсан байх ёстой.");
  process.exit(1);
}

async function main() {
  const credentials = parseAppRoleUrl(appDatabaseUrl!);
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await ensureAppRole(client, credentials);
    console.log(`DB үүрэг "${credentials.name}": ${result === "created" ? "үүсгэв" : "нууц үгийг тааруулав"}.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
