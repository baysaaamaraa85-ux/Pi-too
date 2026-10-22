// Хөгжүүлэлтийн туслах скрипт: хэрэглэгчийн нууц үгийг шинэчилнэ.
// Ашиглах: npx tsx prisma/reset-password.ts <утас> <шинэ нууц үг>
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "../src/shared/db/prisma.js";

const [phone, newPassword] = process.argv.slice(2);

if (!phone || !newPassword) {
  console.error("Ашиглах: npx tsx prisma/reset-password.ts <утас> <шинэ нууц үг>");
  process.exit(1);
}

async function main() {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    console.error(`${phone} утастай хэрэглэгч олдсонгүй.`);
    process.exit(1);
  }
  // ФБШ-18: bcrypt, cost >= 10.
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, failedLogins: 0, lockedUntil: null },
    }),
    // Хуучин нэвтрэлтийн token-уудыг хүчингүй болгоно.
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  console.log(`${phone}: нууц үг шинэчлэгдлээ.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
