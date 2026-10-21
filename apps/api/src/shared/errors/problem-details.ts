import type { ErrorRequestHandler, RequestHandler } from "express";
import type {} from "pino-http"; // Request.log талбарын төрлийн өргөтгөл
import { ZodError } from "zod";
import { DomainError } from "./domain-error.js";
import { logger } from "../logger.js";

const PROBLEM_BASE = "https://pi-too.mn/errors";

// Зам олдоогүй тохиолдлыг ч RFC 9457 хэлбэрээр буцаана (CLAUDE.md 6.6, design 8.4).
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).type("application/problem+json").json({
    type: `${PROBLEM_BASE}/not-found`,
    title: "Хүссэн зам олдсонгүй",
    status: 404,
    detail: `${req.method} ${req.originalUrl} гэсэн зам энэ серверт байхгүй.`,
  });
};

// Нэг алдааны middleware: DomainError -> 409/403/... , ZodError -> 422, бусад -> 500.
export const problemDetails: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof DomainError) {
    res
      .status(err.status)
      .type("application/problem+json")
      .json({
        type: `${PROBLEM_BASE}/${err.code}`,
        title: err.title,
        status: err.status,
        detail: err.detail,
        ...err.extra,
      });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).type("application/problem+json").json({
      type: `${PROBLEM_BASE}/validation-error`,
      title: "Оролтын мэдээлэл буруу байна",
      status: 422,
      detail: "Илгээсэн өгөгдөл шаардлага хангахгүй байна.",
      errors: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    });
    return;
  }

  // 500 үед дотоод мэдээллийг хэрэглэгчид харуулахгүй, зөвхөн логт бичнэ (CLAUDE.md 6.6).
  (req.log ?? logger).error({ err }, "Таамаглаагүй алдаа");
  res.status(500).type("application/problem+json").json({
    type: `${PROBLEM_BASE}/internal-error`,
    title: "Серверийн алдаа",
    status: 500,
    detail: "Үл мэдэгдэх алдаа гарлаа. Түр хүлээж дахин оролдоно уу.",
  });
};
