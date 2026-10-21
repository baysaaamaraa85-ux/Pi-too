import type { Tx } from "../../shared/db/prisma.js";

// Зөвхөн Prisma асуулга, шийдвэр гаргахгүй (CLAUDE.md 6.1).
export function findSetting(tx: Tx, key: string) {
  return tx.settings.findUnique({ where: { key } });
}
