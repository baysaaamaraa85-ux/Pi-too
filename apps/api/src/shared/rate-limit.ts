import type { NextFunction, Request, Response } from "express";
import { DomainError } from "./errors/domain-error.js";

// Нэвтрэлтгүй (нийтийн) endpoint-ийг спамаас хамгаалах энгийн хязгаарлагч.
// Нэг IP-аас цонх дотор limit-ээс олон хүсэлт ирвэл 429. Нэг процессын санах
// ойд хадгална (нэг API контейнертэй тул хангалттай, ADR-001).
export function rateLimit(options: { windowMs: number; limit: number }) {
  const hits = new Map<string, number[]>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip ?? "unknown";
    const recent = (hits.get(key) ?? []).filter((t) => now - t < options.windowMs);

    if (recent.length >= options.limit) {
      next(
        new DomainError({
          code: "too-many-requests",
          status: 429,
          title: "Хэт олон хүсэлт",
          detail: "Түр хүлээгээд дахин оролдоно уу.",
        }),
      );
      return;
    }

    recent.push(now);
    hits.set(key, recent);
    next();
  };
}
