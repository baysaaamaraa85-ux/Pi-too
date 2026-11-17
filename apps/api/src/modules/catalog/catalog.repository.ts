import type { Tx } from "../../shared/db/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

// Зөвхөн Prisma асуулга, шийдвэр гаргахгүй (CLAUDE.md 6.1).
export function findSetting(tx: Tx, key: string) {
  return tx.settings.findUnique({ where: { key } });
}

export function listSettings(tx: Tx) {
  return tx.settings.findMany({ orderBy: { key: "asc" } });
}

export function upsertSetting(
  tx: Tx,
  params: { key: string; value: Prisma.InputJsonValue; updatedBy: string },
) {
  return tx.settings.upsert({
    where: { key: params.key },
    update: { value: params.value, updatedBy: params.updatedBy },
    create: { key: params.key, value: params.value, updatedBy: params.updatedBy },
  });
}

export function listBranches(tx: Tx) {
  return tx.branch.findMany({ orderBy: { name: "asc" } });
}

export function findBranchById(tx: Tx, id: string) {
  return tx.branch.findUnique({ where: { id } });
}

export interface BranchData {
  name?: string;
  address?: string;
  description?: string | null;
  phones?: string[];
  photoUrl?: string | null;
}

export function createBranch(tx: Tx, data: BranchData & { name: string; address: string }) {
  return tx.branch.create({ data });
}

export function updateBranch(tx: Tx, id: string, data: BranchData) {
  return tx.branch.update({ where: { id }, data });
}

export function listPrograms(tx: Tx) {
  return tx.program.findMany({ orderBy: { name: "asc" } });
}

export function findProgramById(tx: Tx, id: string) {
  return tx.program.findUnique({ where: { id } });
}

export function createProgram(tx: Tx, data: { name: string; currentPrice: string }) {
  return tx.program.create({ data });
}

export function updateProgram(
  tx: Tx,
  id: string,
  data: { name?: string; currentPrice?: string; protocolHourlyRate?: string | null },
) {
  return tx.program.update({ where: { id }, data });
}


