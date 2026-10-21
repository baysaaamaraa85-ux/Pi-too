import type { Tx } from "../db/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";

// ADR-012: аудитын мөрийг service бичдэг тул "хэн, яагаад" гэсэн бизнесийн
// утга хадгалагдана (CLAUDE.md 8.3). Үндсэн өөрчлөлттэй нэг транзакцад дуудна.
export function writeAudit(
  tx: Tx,
  params: {
    entity: string;
    entityId: string;
    action: string;
    before?: Prisma.InputJsonValue | null;
    after?: Prisma.InputJsonValue | null;
    reason?: string;
    actorId: string;
  },
) {
  return tx.auditLog.create({
    data: {
      entity: params.entity,
      entityId: params.entityId,
      action: params.action,
      before: params.before ?? undefined,
      after: params.after ?? undefined,
      reason: params.reason,
      actorId: params.actorId,
    },
  });
}
