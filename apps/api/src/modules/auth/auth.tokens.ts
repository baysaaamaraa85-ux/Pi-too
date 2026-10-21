import { createHash, randomBytes } from "node:crypto";

// ФБШ-19: 7 хоногийн refresh token, httpOnly cookie-д. DB-д зөвхөн хэш хадгална,
// түлхүүр өөрөө дахин сэргээгдэхгүй тул алдагдсан ч ашиггүй.
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const REFRESH_TOKEN_COOKIE = "refreshToken";

export function generateRefreshTokenValue(): string {
  return randomBytes(32).toString("hex");
}

export function hashRefreshToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function refreshTokenExpiry(now = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
}

// ФШ-05: 30 минутын нэг удаагийн нууц үг сэргээх token.
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

export function generatePasswordResetValue(): string {
  return randomBytes(32).toString("hex");
}

export function hashPasswordResetToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function passwordResetExpiry(now = new Date()): Date {
  return new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
}
