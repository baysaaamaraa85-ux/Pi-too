import type { Request, Response } from "express";
import { z } from "zod";
import {
  changePasswordSchema,
  createUserSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateUserStatusSchema,
} from "@pitoo/contracts";
import { env } from "../../config/env.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import * as service from "./auth.service.js";
import { REFRESH_TOKEN_COOKIE } from "./auth.tokens.js";

// ФБШ-19: httpOnly, Secure (HTTPS орчинд), SameSite=Strict.
// Хөгжүүлэлтийн орчинд HTTPS байхгүй тул Secure-г зөвхөн production-д асаана.
function setRefreshCookie(res: Response, value: string, expiresAt: Date) {
  res.cookie(REFRESH_TOKEN_COOKIE, value, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "strict",
    expires: expiresAt,
    path: "/api/v1/auth",
  });
}

function readRefreshCookie(req: Request): string {
  const value = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof value !== "string" || value.length === 0) {
    throw new DomainError({
      code: "invalid-refresh-token",
      status: 401,
      title: "Нэвтрэлт хүчингүй",
      detail: "Refresh token cookie дутуу байна.",
    });
  }
  return value;
}

export async function login(req: Request, res: Response) {
  const { identifier, password } = loginSchema.parse(req.body);
  const result = await service.login(identifier, password);
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
}

export async function refresh(req: Request, res: Response) {
  const refreshTokenValue = readRefreshCookie(req);
  const result = await service.refresh(refreshTokenValue);
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.status(200).json({ accessToken: result.accessToken, user: result.user });
}

export async function logout(req: Request, res: Response) {
  const refreshTokenValue = req.cookies?.[REFRESH_TOKEN_COOKIE];
  if (typeof refreshTokenValue === "string" && refreshTokenValue.length > 0) {
    await service.logout(refreshTokenValue);
  }
  res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/api/v1/auth" });
  res.status(204).send();
}

export async function changePassword(req: Request, res: Response) {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  await service.changePassword(req.user!.id, currentPassword, newPassword);
  res.status(204).send();
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = forgotPasswordSchema.parse(req.body);
  await service.forgotPassword(email);
  res.status(204).send();
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await service.resetPassword(token, newPassword);
  res.status(204).send();
}

export async function createUser(req: Request, res: Response) {
  const { role, phone, fullName } = createUserSchema.parse(req.body);
  const result = await service.createUser(role, phone, fullName, { actorId: req.user!.id });
  res.status(201).json(result);
}

const userIdParamSchema = z.object({ id: z.uuid() });

export async function updateUserStatus(req: Request, res: Response) {
  const { id } = userIdParamSchema.parse(req.params);
  const { isActive } = updateUserStatusSchema.parse(req.body);
  await service.updateUserStatus(id, isActive, req.user!.id);
  res.status(204).send();
}

// ФШ-03: админ хэрэглэгчид шинэ түр нууц үг үүсгэнэ.
export async function resetUserPassword(req: Request, res: Response) {
  const { id } = userIdParamSchema.parse(req.params);
  res.status(200).json(await service.resetUserPassword(id, req.user!.id));
}
