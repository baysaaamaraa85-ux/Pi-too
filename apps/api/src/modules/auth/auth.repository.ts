import type { Tx } from "../../shared/db/prisma.js";
import type { Role } from "../../generated/prisma/client.js";

export function findUserByIdentifier(tx: Tx, identifier: string) {
  return tx.user.findFirst({
    where: { OR: [{ phone: identifier }, { email: identifier }] },
  });
}

export function findUserById(tx: Tx, id: string) {
  return tx.user.findUnique({ where: { id } });
}

export function findUserByPhone(tx: Tx, phone: string) {
  return tx.user.findUnique({ where: { phone } });
}

export function recordFailedLogin(tx: Tx, id: string, failedLogins: number, lockedUntil: Date | null) {
  return tx.user.update({ where: { id }, data: { failedLogins, lockedUntil } });
}

export function resetFailedLogins(tx: Tx, id: string) {
  return tx.user.update({ where: { id }, data: { failedLogins: 0, lockedUntil: null } });
}

export function updatePasswordHash(tx: Tx, id: string, passwordHash: string) {
  return tx.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: false },
  });
}

export function setUserActive(tx: Tx, id: string, isActive: boolean) {
  return tx.user.update({ where: { id }, data: { isActive } });
}

export function findUserByEmail(tx: Tx, email: string) {
  return tx.user.findUnique({ where: { email } });
}

// ФШ-03: админ шинэ түр нууц үг өгөхөд хэрэглэгч заавал солино.
export function setTemporaryPassword(tx: Tx, id: string, passwordHash: string) {
  return tx.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true, failedLogins: 0, lockedUntil: null },
  });
}

export function createUserWithProfile(
  tx: Tx,
  params: { role: Role; phone: string; email?: string; passwordHash: string; fullName: string },
) {
  return tx.user.create({
    data: {
      role: params.role,
      phone: params.phone,
      email: params.email,
      passwordHash: params.passwordHash,
      mustChangePassword: true,
      teacher:
        params.role === "TEACHER" ? { create: { fullName: params.fullName } } : undefined,
      parent:
        params.role === "PARENT"
          ? { create: { fullName: params.fullName, phone: params.phone } }
          : undefined,
    },
  });
}

export function createRefreshToken(
  tx: Tx,
  params: { userId: string; tokenHash: string; expiresAt: Date },
) {
  return tx.refreshToken.create({ data: params });
}

export function findRefreshTokenByHash(tx: Tx, tokenHash: string) {
  return tx.refreshToken.findUnique({ where: { tokenHash } });
}

export function revokeRefreshToken(tx: Tx, id: string) {
  return tx.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
}

export function revokeAllRefreshTokensForUser(tx: Tx, userId: string) {
  return tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function createPasswordReset(
  tx: Tx,
  params: { userId: string; tokenHash: string; expiresAt: Date },
) {
  return tx.passwordReset.create({ data: params });
}

export function findPasswordResetByHash(tx: Tx, tokenHash: string) {
  return tx.passwordReset.findUnique({ where: { tokenHash } });
}

export function markPasswordResetUsed(tx: Tx, id: string) {
  return tx.passwordReset.update({ where: { id }, data: { usedAt: new Date() } });
}
