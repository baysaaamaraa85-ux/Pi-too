import type { NextFunction, Request, Response } from "express";
import { DomainError } from "../errors/domain-error.js";
import type { AuthUser } from "./types.js";

// Эрхийн 1-р түвшин: үүргийн шалгалт (CLAUDE.md 6.5, ADR-008). 2-р түвшний
// эзэмшлийн шалгалт (жишээ нь "өөрийн анги эсэх") тухайн модулийн service-д.
export function authorize(...roles: AuthUser["role"][]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(
        new DomainError({
          code: "forbidden",
          status: 403,
          title: "Эрх хүрэхгүй байна",
          detail: "Энэ үйлдлийг хийх эрхгүй байна.",
        }),
      );
      return;
    }
    next();
  };
}
