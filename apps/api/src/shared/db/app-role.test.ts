import { describe, expect, it } from "vitest";
import { APP_ROLE_NAME, ensureAppRole, parseAppRoleUrl, type Queryable } from "./app-role.js";

// ФБШ-24, ФБШ-29: pitoo_app-ийн нууц үг APP_DATABASE_URL-аас ирнэ, кодонд байхгүй.
describe("ФБШ-24, 29: pitoo_app үүргийн тохиргоо", () => {
  it("APP_DATABASE_URL-аас нэр, нууц үгийг задална (URL-кодыг тайлна)", () => {
    const creds = parseAppRoleUrl("postgresql://pitoo_app:p%40ss%2Fword99@db.internal:5432/railway");
    expect(creds).toEqual({ name: "pitoo_app", password: "p@ss/word99" });
  });

  it("өөр хэрэглэгчийн нэр байвал татгалзана (migration-ийн GRANT нь pitoo_app-д)", () => {
    expect(() => parseAppRoleUrl("postgresql://postgres:longpassword@h:5432/x")).toThrow(APP_ROLE_NAME);
  });

  it("нууц үг 8 тэмдэгтээс богино бол татгалзана (хил: 7 буруу, 8 зөв)", () => {
    expect(() => parseAppRoleUrl("postgresql://pitoo_app:1234567@h:5432/x")).toThrow("8 тэмдэгт");
    expect(parseAppRoleUrl("postgresql://pitoo_app:12345678@h:5432/x").password).toBe("12345678");
  });

  it("буруу хэлбэрийн URL-д ойлгомжтой алдаа өгнө", () => {
    expect(() => parseAppRoleUrl("not a url")).toThrow("APP_DATABASE_URL");
  });

  function fakeClient(roleExists: boolean) {
    const calls: Array<{ text: string; values?: unknown[] }> = [];
    const client: Queryable = {
      async query(text, values) {
        calls.push({ text, values });
        if (text.startsWith("SELECT 1 FROM pg_roles")) {
          return { rows: [], rowCount: roleExists ? 1 : 0 };
        }
        if (text.includes("format(")) {
          // Жинхэнэ PostgreSQL format(%I, %L)-ийг дуурайна.
          const verb = text.includes("ALTER ROLE") ? "ALTER" : "CREATE";
          return { rows: [{ sql: `${verb} ROLE "${String(values?.[0])}" LOGIN PASSWORD '***'` }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
    };
    return { client, calls };
  }

  it("үүрэг байхгүй бол CREATE, байвал ALTER (нууц үгийг орчинтой тааруулна)", async () => {
    const created = fakeClient(false);
    expect(await ensureAppRole(created.client, { name: "pitoo_app", password: "secretsecret" })).toBe("created");
    expect(created.calls.at(-1)?.text).toMatch(/^CREATE ROLE/);

    const updated = fakeClient(true);
    expect(await ensureAppRole(updated.client, { name: "pitoo_app", password: "secretsecret" })).toBe("updated");
    expect(updated.calls.at(-1)?.text).toMatch(/^ALTER ROLE/);
  });

  it("нууц үгийг SQL мөрөнд шууд залгахгүй, параметрээр дамжуулна", async () => {
    const { client, calls } = fakeClient(false);
    await ensureAppRole(client, { name: "pitoo_app", password: "x'; DROP TABLE users; --" });
    const builder = calls.find((c) => c.text.includes("format("));
    expect(builder?.text).not.toContain("DROP TABLE");
    expect(builder?.values).toContain("x'; DROP TABLE users; --");
  });
});
