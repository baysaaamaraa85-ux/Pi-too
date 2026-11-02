import type { Prisma } from "../../generated/prisma/client.js";
import type { Tx } from "../db/prisma.js";
import { enqueue } from "./enqueue.js";

type Channel = "PUSH" | "EMAIL" | "SMS";
const VALID: readonly string[] = ["PUSH", "EMAIL", "SMS"];

// ФШ-60...62: хэрэглэгчид мэдэгдлийг ТЭРЭЭРИЙН сонгосон сувгаар outbox-д бичнэ. Эцэг эх
// сувгаа (push, имэйл, SMS) сонгосон бол суваг бүрт нэг мөр, сонгоогүй эсвэл эцэг эх биш
// (багш, админ, сурагч) бол push. Үндсэн өөрчлөлттэй нэг транзакцад дуудна (ADR-006).
export async function notifyUser(
  tx: Tx,
  userId: string,
  template: string,
  payload: Prisma.InputJsonValue,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { parent: { select: { notifyChannels: true } } },
  });
  const stored = user?.parent?.notifyChannels;
  const chosen = (Array.isArray(stored) ? stored : []).filter(
    (c): c is Channel => typeof c === "string" && VALID.includes(c),
  );
  const channels: Channel[] = chosen.length > 0 ? chosen : ["PUSH"];
  for (const channel of channels) {
    await enqueue(tx, { recipientId: userId, channel, template, payload });
  }
}
