// ФБШ-24, ФБШ-29: аппликейшний DB хэрэглэгч (pitoo_app) нь audit_log, ledger_entries-д
// UPDATE/DELETE эрхгүй. Түүний нууц үг кодонд, migration-д бичигдэхгүй: APP_DATABASE_URL-ээс
// уншиж, migration-аас өмнө superuser холболтоор үүсгэнэ (prisma/bootstrap-app-role.ts).
// SQL migration орчны хувьсагч уншиж чадахгүй тул үүргийг энд, эрхийг migration-д хуваасан.

export const APP_ROLE_NAME = "pitoo_app";

export interface AppRoleCredentials {
  name: string;
  password: string;
}

// Migration доторх GRANT, REVOKE нь энэ нэрийг шууд ашигладаг тул нэр тогтмол.
export function parseAppRoleUrl(rawUrl: string): AppRoleCredentials {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("APP_DATABASE_URL буруу хэлбэртэй байна.");
  }
  const name = decodeURIComponent(url.username);
  const password = decodeURIComponent(url.password);

  if (name !== APP_ROLE_NAME) {
    throw new Error(
      `APP_DATABASE_URL-ийн хэрэглэгч "${APP_ROLE_NAME}" байх ёстой (одоо: "${name}"). ` +
        "Migration-ийн эрхийн тохиргоо энэ нэрээр хийгддэг.",
    );
  }
  if (password.length < 8) {
    throw new Error("APP_DATABASE_URL-ийн нууц үг 8 тэмдэгтээс багагүй байх ёстой.");
  }
  return { name, password };
}

// pg.Client, pg.Pool хоёрт таардаг хамгийн бага интерфейс (тестэд хуурамчаар солих боломжтой).
export interface Queryable {
  query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
}

// Үүргийг үүсгэнэ, байвал нууц үгийг орчны утгатай тааруулна. Дахин ажиллуулахад аюулгүй
// (idempotent). Нэр, нууц үгийг SQL-д format(%I, %L)-ээр зөв хашилтлана, мөрөнд шууд залгахгүй.
export async function ensureAppRole(
  superuser: Queryable,
  credentials: AppRoleCredentials,
): Promise<"created" | "updated"> {
  const existing = await superuser.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [
    credentials.name,
  ]);
  const exists = (existing.rowCount ?? 0) > 0;
  const verb = exists ? "ALTER" : "CREATE";

  const built = await superuser.query(
    `SELECT format('${verb} ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql`,
    [credentials.name, credentials.password],
  );
  const statement = built.rows[0]?.sql;
  if (typeof statement !== "string") throw new Error("Үүргийн SQL үүссэнгүй.");
  await superuser.query(statement);
  return exists ? "updated" : "created";
}
