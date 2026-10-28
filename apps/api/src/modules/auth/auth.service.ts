import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma, type Tx } from "../../shared/db/prisma.js";
import { DomainError } from "../../shared/errors/domain-error.js";
import { enqueue } from "../../shared/outbox/enqueue.js";
import { signAccessToken } from "../../shared/rbac/jwt.js";
import { getAuthDefaults } from "../catalog/catalog.service.js";
import * as repo from "./auth.repository.js";
import {
  generatePasswordResetValue,
  generateRefreshTokenValue,
  hashPasswordResetToken,
  hashRefreshToken,
  passwordResetExpiry,
  refreshTokenExpiry,
} from "./auth.tokens.js";
import type { Role } from "../../generated/prisma/client.js";

const BCRYPT_COST = 10; // ФБШ-18: cost >= 10

function invalidCredentials(): never {
  throw new DomainError({
    code: "invalid-credentials",
    status: 401,
    title: "Нэвтрэх мэдээлэл буруу байна",
    detail: "Утас/имэйл эсвэл нууц үг буруу байна.",
  });
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: { id: string; role: Role; mustChangePassword: boolean };
}

type LoginOutcome =
  | { kind: "ok"; result: LoginResult }
  | { kind: "not-found" }
  | { kind: "inactive" }
  | { kind: "locked"; lockedUntil: Date }
  | { kind: "wrong-password" };

// ФШ-01, ФБШ-22: буруу нууц үгээр 5 (settings) удаа дараалан оролдвол түгжинэ.
//
// Чухал: $transaction-ийн callback-д throw хийвэл Prisma ТРАНЗАКЦЫГ БҮХЭЛД НЬ
// буцаадаг (rollback). Иймд "буруу оролдлогын тоолуурыг нэмэх" шиг хадгалах
// ёстой өөрчлөлтийг транзакц дотор хийгээд, дараа нь ЯГ ТЭР ТРАНЗАКЦ дотроо
// алдаа шиддэг бол тоолуур хадгалагдахгүй. Тиймээс эхлээд транзакц дотор зөвхөн
// үр дүнг (outcome) тодорхойлж, транзакц амжилттай батлагдсаны ДАРАА гадна нь
// throw хийнэ.
export async function login(identifier: string, password: string): Promise<LoginResult> {
  const outcome = await prisma.$transaction<LoginOutcome>(async (tx) => {
    const user = await repo.findUserByIdentifier(tx, identifier);
    if (!user) return { kind: "not-found" };
    if (!user.isActive) return { kind: "inactive" };
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return { kind: "locked", lockedUntil: user.lockedUntil };
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      const { maxFailedLogins, lockoutMinutes } = await getAuthDefaults(tx);
      const failedLogins = user.failedLogins + 1;
      const lockedUntil =
        failedLogins >= maxFailedLogins ? new Date(Date.now() + lockoutMinutes * 60_000) : null;
      await repo.recordFailedLogin(tx, user.id, failedLogins, lockedUntil);
      return { kind: "wrong-password" };
    }

    await repo.resetFailedLogins(tx, user.id);

    const authUser = { id: user.id, role: user.role };
    const accessToken = signAccessToken(authUser);
    const refreshValue = generateRefreshTokenValue();
    const refreshExpiresAt = refreshTokenExpiry();
    await repo.createRefreshToken(tx, {
      userId: user.id,
      tokenHash: hashRefreshToken(refreshValue),
      expiresAt: refreshExpiresAt,
    });

    return {
      kind: "ok",
      result: {
        accessToken,
        refreshToken: refreshValue,
        refreshExpiresAt,
        user: { id: user.id, role: user.role, mustChangePassword: user.mustChangePassword },
      },
    };
  });

  switch (outcome.kind) {
    case "ok":
      return outcome.result;
    case "not-found":
    case "wrong-password":
      invalidCredentials();
    case "inactive":
      throw new DomainError({
        code: "account-inactive",
        status: 401,
        title: "Данс идэвхгүй болсон",
        detail: "Энэ дансаар нэвтрэх боломжгүй. Админтай холбогдоно уу.",
      });
    case "locked":
      throw new DomainError({
        code: "account-locked",
        status: 401,
        title: "Данс түр түгжигдсэн",
        detail: "Буруу оролдлого хэтэрсэн тул данс түр хугацаанд түгжигдсэн байна.",
        extra: { lockedUntil: outcome.lockedUntil.toISOString() },
      });
  }
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: { id: string; role: Role; mustChangePassword: boolean };
}

type RefreshOutcome =
  | { kind: "ok"; result: RefreshResult }
  | { kind: "not-found" }
  | { kind: "reused" }
  | { kind: "expired" }
  | { kind: "inactive" };

// ADR-004: rotation. Ашиглагдсан (revokedAt-тай) token дахин ирвэл хэрэглэгчийн
// бүх token хүчингүй болно (token reuse detection). Доорх тайлбар login()-той
// адил: throw-г транзакцын гадна хийнэ, эс бөгөөс "бүх token цуцлах" үйлдэл
// rollback-д унана.
export async function refresh(refreshTokenValue: string): Promise<RefreshResult> {
  const outcome = await prisma.$transaction<RefreshOutcome>(async (tx) => {
    const tokenHash = hashRefreshToken(refreshTokenValue);
    const existing = await repo.findRefreshTokenByHash(tx, tokenHash);

    if (!existing) return { kind: "not-found" };

    if (existing.revokedAt) {
      // Ашиглагдсан token дахин ирсэн: хулгайлагдсан байж болзошгүй тул
      // хэрэглэгчийн бүх token-ийг хүчингүй болгоно.
      await repo.revokeAllRefreshTokensForUser(tx, existing.userId);
      return { kind: "reused" };
    }

    if (existing.expiresAt < new Date()) return { kind: "expired" };

    const user = await repo.findUserById(tx, existing.userId);
    if (!user || !user.isActive) return { kind: "inactive" };

    await repo.revokeRefreshToken(tx, existing.id);

    const newRefreshValue = generateRefreshTokenValue();
    const newExpiresAt = refreshTokenExpiry();
    await repo.createRefreshToken(tx, {
      userId: user.id,
      tokenHash: hashRefreshToken(newRefreshValue),
      expiresAt: newExpiresAt,
    });

    return {
      kind: "ok",
      result: {
        accessToken: signAccessToken({ id: user.id, role: user.role }),
        refreshToken: newRefreshValue,
        refreshExpiresAt: newExpiresAt,
        user: { id: user.id, role: user.role, mustChangePassword: user.mustChangePassword },
      },
    };
  });

  switch (outcome.kind) {
    case "ok":
      return outcome.result;
    case "not-found":
      throw new DomainError({
        code: "invalid-refresh-token",
        status: 401,
        title: "Нэвтрэлт хүчингүй",
        detail: "Refresh token олдсонгүй.",
      });
    case "reused":
      throw new DomainError({
        code: "refresh-token-reused",
        status: 401,
        title: "Нэвтрэлт хүчингүй",
        detail: "Энэ token аль хэдийн ашиглагдсан тул бүх нэвтрэлт цуцлагдлаа.",
      });
    case "expired":
      throw new DomainError({
        code: "refresh-token-expired",
        status: 401,
        title: "Нэвтрэлтийн хугацаа дууссан",
        detail: "Дахин нэвтэрнэ үү.",
      });
    case "inactive":
      throw new DomainError({
        code: "account-inactive",
        status: 401,
        title: "Данс идэвхгүй болсон",
        detail: "Энэ дансаар нэвтрэх боломжгүй.",
      });
  }
}

export async function logout(refreshTokenValue: string): Promise<void> {
  const tokenHash = hashRefreshToken(refreshTokenValue);
  const existing = await repo.findRefreshTokenByHash(prisma, tokenHash);
  if (existing && !existing.revokedAt) {
    await repo.revokeRefreshToken(prisma, existing.id);
  }
}

// ФШ-03: түр нууц үгээр нэвтэрсэн хэрэглэгч шинэ нууц үг тохируулна.
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await repo.findUserById(tx, userId);
    if (!user) invalidCredentials();

    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      throw new DomainError({
        code: "current-password-mismatch",
        status: 409,
        title: "Одоогийн нууц үг буруу байна",
        detail: "Одоогийн нууц үгээ зөв оруулна уу.",
      });
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await repo.updatePasswordHash(tx, userId, newHash);
  });
}

// ФШ-05: 30 минутын нэг удаагийн холбоос. Имэйл одоохондоо илгээхгүй,
// outbox-д бичээд консолд хэвлэнэ (SMTP холболт хожим нэмэгдэнэ).
export async function forgotPassword(email: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const user = await repo.findUserByIdentifier(tx, email);
    // Хэрэглэгч олдоогүй ч ижил хариу буцаана: имэйл бүртгэлтэй эсэхийг задруулахгүй.
    if (!user || !user.email) return;

    const resetValue = generatePasswordResetValue();
    await repo.createPasswordReset(tx, {
      userId: user.id,
      tokenHash: hashPasswordResetToken(resetValue),
      expiresAt: passwordResetExpiry(),
    });

    await enqueue(tx, {
      recipientId: user.id,
      channel: "EMAIL",
      template: "password_reset",
      payload: { token: resetValue },
    });

    console.log(`[DEV] Нууц үг сэргээх token (${user.email}): ${resetValue}`);
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const tokenHash = hashPasswordResetToken(token);
    const reset = await repo.findPasswordResetByHash(tx, tokenHash);

    const invalid = () =>
      new DomainError({
        code: "password-reset-invalid",
        status: 409,
        title: "Холбоос хүчингүй",
        detail: "Холбоос хүчингүй, ашиглагдсан эсвэл хугацаа дууссан байна.",
      });

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      throw invalid();
    }

    const newHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    await repo.updatePasswordHash(tx, reset.userId, newHash);
    await repo.markPasswordResetUsed(tx, reset.id);
    // Нууц үг сэргээсний дараа бүх session-ийг хүчингүй болгоно (аюулгүй байдал).
    await repo.revokeAllRefreshTokensForUser(tx, reset.userId);
  });
}

export interface CreateUserResult {
  id: string;
  role: Role;
  phone: string;
  tempPassword: string;
}

// ФШ-02, 03: админ багш/эцэг эхийн данс түр нууц үгтэй үүсгэнэ.
//
// Энэ логикийг enrollment модуль (ФШ-12, 13: шинэ сурагч бүртгэхэд эцэг эхийн
// данс зэрэгцээ үүсэх шаардлагатай) өөрийнхөө транзакц дотроос дахин
// ашигладаг тул "tx авдаг цөм функц" + "өөрөө транзакц нээдэг гаднах wrapper"
// хоёр хэлбэрээр хуваав (CLAUDE.md 6.2, 6.3).
export async function createUserInTx(
  tx: Tx,
  role: "TEACHER" | "PARENT" | "STUDENT",
  phone: string,
  fullName: string,
): Promise<CreateUserResult> {
  const existing = await repo.findUserByPhone(tx, phone);
  if (existing) {
    throw new DomainError({
      code: "phone-taken",
      status: 409,
      title: "Утасны дугаар бүртгэлтэй байна",
      detail: "Энэ утасны дугаартай хэрэглэгч аль хэдийн бүртгэлтэй байна.",
    });
  }

  const tempPassword = randomBytes(6).toString("base64url");
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_COST);
  const user = await repo.createUserWithProfile(tx, { role, phone, passwordHash, fullName });

  return { id: user.id, role: user.role, phone, tempPassword };
}

export function createUser(
  role: "TEACHER" | "PARENT",
  phone: string,
  fullName: string,
): Promise<CreateUserResult> {
  return prisma.$transaction((tx) => createUserInTx(tx, role, phone, fullName));
}

// ФШ-06: данс идэвхгүй болгоход refresh token-ийг шууд хүчингүй болгоно (ADR-004).
export async function updateUserStatus(userId: string, isActive: boolean): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await repo.setUserActive(tx, userId, isActive);
    if (!isActive) {
      await repo.revokeAllRefreshTokensForUser(tx, userId);
    }
  });
}
