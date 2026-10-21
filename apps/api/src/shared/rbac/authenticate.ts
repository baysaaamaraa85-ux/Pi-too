import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../errors/domain-error.js";
import { verifyAccessToken } from "./jwt.js";

// Нэвтрэлтгүй зам: /auth/*, GET /health (CLAUDE.md 8.1).
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    next(
      new DomainError({
        code: "unauthenticated",
        status: 401,
        title: "Нэвтрэх шаардлагатай",
        detail: "Authorization толгойд Bearer access token дутуу байна.",
      }),
    );
    return;
  }

  try {
    req.user = verifyAccessToken(token);
    next();
  } catch {
    next(
      new DomainError({
        code: "unauthenticated",
        status: 401,
        title: "Нэвтрэлт хүчингүй",
        detail: "Access token хүчингүй эсвэл хугацаа дууссан байна.",
      }),
    );
  }
}
