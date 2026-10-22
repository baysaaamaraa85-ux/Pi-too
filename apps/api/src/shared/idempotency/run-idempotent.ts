import { Prisma } from "../../generated/prisma/client.js";
import { prisma, type Tx } from "../db/prisma.js";

// ФБШ-15, design 6.1 (2, 9-р алхам): ижил Idempotency-Key-тэй хүсэлт нэг л
// удаа боловсруулагдана.
//
// 1) Транзакцаас өмнө хурдан шалгаж, байгаа бол шууд буцаана (6.1-ийн 2-р алхам).
// 2) Байхгүй бол бизнес логикийг ажиллуулж, ЯГ ТЭР ТРАНЗАКЦАД хариуг хадгална
//    (6.1-ийн 9-р алхам) - эс бөгөөс сервер unaд commit хооронд унавал давхар
//    боловсруулна.
// 3) Хоёр хүсэлт ЗЭРЭГ (READ COMMITTED дор хоёулаа "олдсонгүй" гэж харах)
//    ирвэл key-ийн PRIMARY KEY хязгаарлалт нэгийг нь rollback хийнэ; тэр үед
//    хожигдсон хүсэлт ялагчийн хариуг дахин уншиж буцаана (давхар алдаа биш).
export async function runIdempotent<T extends Prisma.InputJsonValue>(
  key: string,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) return existing.response as T;

  try {
    return await prisma.$transaction(async (tx) => {
      const result = await fn(tx);
      await tx.idempotencyKey.create({ data: { key, userId, response: result } });
      return result;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const resolved = await prisma.idempotencyKey.findUnique({ where: { key } });
      if (resolved) return resolved.response as T;
    }
    throw error;
  }
}
