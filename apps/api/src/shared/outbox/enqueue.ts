import type { Tx } from "../db/prisma.js";
import type { NotificationChannel, Prisma } from "../../generated/prisma/client.js";

// ADR-006: transactional outbox. Модуль бүр үндсэн өөрчлөлттэй нэг
// транзакцад энд мөр бичнэ, notifications модулийг шууд дуудахгүй (CLAUDE.md 6.2).
export function enqueue(
  tx: Tx,
  params: {
    recipientId: string;
    channel: NotificationChannel;
    template: string;
    payload: Prisma.InputJsonValue;
  },
) {
  return tx.notificationOutbox.create({ data: params });
}
