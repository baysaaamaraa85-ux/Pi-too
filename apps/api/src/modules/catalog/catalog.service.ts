import { z } from "zod";
import type { Tx } from "../../shared/db/prisma.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { findSetting } from "./catalog.repository.js";

const authDefaultsSchema = z.object({
  maxFailedLogins: z.number().int().positive(),
  lockoutMinutes: z.number().int().positive(),
});

function settingNotConfigured(key: string): never {
  throw new DomainError({
    code: "settings-not-configured",
    status: 500,
    title: "Тохиргоо дутуу байна",
    detail: `"${key}" тохиргоо олдсонгүй. Seed ажиллуулсан эсэхийг шалгаарай.`,
  });
}

// ФБШ-22, ФБШ-29: буруу нэвтрэлтийн хязгаар кодонд биш, settings-ээс.
export async function getAuthDefaults(tx: Tx) {
  const row = await findSetting(tx, "auth_defaults");
  if (!row) settingNotConfigured("auth_defaults");
  return authDefaultsSchema.parse(row.value);
}
