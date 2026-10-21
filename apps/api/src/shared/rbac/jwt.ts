import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";
import type { AuthUser } from "./types.js";

// ФБШ-19: 15 минутын access token, JSON хариунд (cookie-д биш).
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    subject: user.id,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AuthUser {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (typeof decoded === "string" || !decoded.sub || typeof decoded.role !== "string") {
    throw new Error("Access token-ийн агуулга буруу байна");
  }
  return { id: decoded.sub, role: decoded.role as AuthUser["role"] };
}
