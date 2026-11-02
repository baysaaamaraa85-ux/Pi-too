import { prisma } from "../../shared/db/prisma.js";
import { logger } from "../../shared/logger.js";
import { PermanentChannelError, type ChannelRegistry } from "./notifications.channels.js";
import { renderNotification } from "./notifications.templates.js";

// ФШ-60...64, ФБШ-06, ADR-006: outbox-оос мэдэгдэл илгээх. Транзакцаас гадна ажиллана
// (worker процесс). FOR UPDATE SKIP LOCKED тул олон worker зэрэг ажиллахад мөр бүрийг
// нэг л worker авч, давхар илгээхгүй.

// Дахин оролдлого: 30 с, 60 с, 120 с, 240 с (экспоненциал), 5 дахь оролдлогын дараа FAILED.
export const MAX_ATTEMPTS = 5;
export const BASE_DELAY_MS = 30_000;

export function retryDelayMs(attemptsSoFar: number): number {
  return BASE_DELAY_MS * 2 ** (attemptsSoFar - 1);
}

export interface ProcessResult {
  sent: number;
  retried: number;
  failed: number;
}

export async function processOutbox(
  registry: ChannelRegistry,
  options: { appOrigin: string; now?: Date; batchSize?: number },
): Promise<ProcessResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 20;
  const result: ProcessResult = { sent: 0, retried: 0, failed: 0 };

  await prisma.$transaction(
    async (tx) => {
      const claimed = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM notification_outbox
        WHERE status = 'PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
        ORDER BY created_at
        LIMIT ${batchSize}
        FOR UPDATE SKIP LOCKED
      `;
      if (claimed.length === 0) return;

      const rows = await tx.notificationOutbox.findMany({
        where: { id: { in: claimed.map((c) => c.id) } },
        orderBy: { createdAt: "asc" },
        include: { recipient: { include: { pushSubscriptions: true } } },
      });

      for (const row of rows) {
        const attempts = row.attempts + 1;
        const adapter = registry[row.channel];
        if (!adapter) {
          await tx.notificationOutbox.update({
            where: { id: row.id },
            data: { status: "FAILED", attempts, lastError: "Энэ суваг тохируулагдаагүй байна." },
          });
          result.failed++;
          continue;
        }

        const rendered = renderNotification(
          row.template,
          (row.payload ?? {}) as Record<string, unknown>,
          options.appOrigin,
        );
        try {
          await adapter.send({
            notificationId: row.id,
            recipient: {
              id: row.recipient.id,
              email: row.recipient.email,
              phone: row.recipient.phone,
              pushSubscriptions: row.recipient.pushSubscriptions.map((s) => ({
                endpoint: s.endpoint,
                p256dh: s.p256dh,
                auth: s.auth,
              })),
            },
            title: rendered.title,
            body: rendered.body,
            url: rendered.url,
          });
          await tx.notificationOutbox.update({
            where: { id: row.id },
            data: { status: "SENT", attempts, sentAt: now, lastError: null, nextAttemptAt: null },
          });
          result.sent++;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Үл мэдэгдэх алдаа";
          const permanent = error instanceof PermanentChannelError;
          if (permanent || attempts >= MAX_ATTEMPTS) {
            await tx.notificationOutbox.update({
              where: { id: row.id },
              data: { status: "FAILED", attempts, lastError: message.slice(0, 500), nextAttemptAt: null },
            });
            result.failed++;
          } else {
            await tx.notificationOutbox.update({
              where: { id: row.id },
              data: {
                attempts,
                lastError: message.slice(0, 500),
                nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)),
              },
            });
            result.retried++;
          }
          logger.warn({ notificationId: row.id, attempts, permanent }, "Мэдэгдэл илгээж чадсангүй");
        }
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return result;
}
