import type {
  NotificationChannelValue,
  NotificationRowDto,
  NotificationSettingsDto,
  NotificationsQuery,
  SubscribePushInput,
  UpdateNotificationSettingsInput,
} from "@pitoo/contracts";
import { Prisma, Role } from "../../generated/prisma/client.js";
import { env } from "../../config/env.js";
import { prisma } from "../../shared/db/prisma.js";
import { writeAudit } from "../../shared/audit/write-audit.js";
import { DomainError } from "../../shared/errors/domain-error.js";

// М9 Мэдэгдэл (ФШ-62, 63): сувгийн тохиргоо, push бүртгэл, хүргэлтийн төлөв, админы жагсаалт.

interface Actor {
  id: string;
  role: Role;
}

function rejected(status: number, code: string, title: string, detail: string): never {
  throw new DomainError({ code, status, title, detail });
}

const VALID_CHANNELS = ["PUSH", "EMAIL", "SMS"] as const;

function channelsOf(stored: Prisma.JsonValue): NotificationChannelValue[] {
  return (Array.isArray(stored) ? stored : []).filter(
    (c): c is NotificationChannelValue => typeof c === "string" && (VALID_CHANNELS as readonly string[]).includes(c),
  );
}

// ФШ-63: хүргэгдээгүй (алдаатай, удаан хүлээгдэж буй) мэдэгдлийн жагсаалт.
export async function listNotifications(q: NotificationsQuery) {
  const where: Prisma.NotificationOutboxWhereInput = q.status ? { status: q.status } : {};
  const [rows, total] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where,
      include: { recipient: { include: { teacher: true, parent: true, student: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
    }),
    prisma.notificationOutbox.count({ where }),
  ]);
  const items: NotificationRowDto[] = rows.map((r) => ({
    id: r.id,
    recipientId: r.recipientId,
    recipientName:
      r.recipient.teacher?.fullName ??
      r.recipient.parent?.fullName ??
      r.recipient.student?.fullName ??
      r.recipient.phone ??
      r.recipient.email ??
      "Админ",
    recipientContact: r.recipient.phone ?? r.recipient.email,
    channel: r.channel,
    template: r.template,
    status: r.status,
    attempts: r.attempts,
    lastError: r.lastError,
    createdAt: r.createdAt.toISOString(),
    sentAt: r.sentAt?.toISOString() ?? null,
  }));
  return { items, page: q.page, limit: q.limit, total };
}

// Админ алдаатай мэдэгдлийг дахин илгээхээр дараалалд буцаана.
export function retryNotification(actor: Actor, id: string) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.notificationOutbox.findUnique({ where: { id } });
    if (!found) rejected(404, "notification-not-found", "Мэдэгдэл олдсонгүй", "Заасан мэдэгдэл байхгүй.");
    if (found.status !== "FAILED") {
      rejected(409, "notification-not-failed", "Дахин илгээх шаардлагагүй", "Зөвхөн алдаатай мэдэгдлийг дахин илгээнэ.");
    }
    await tx.notificationOutbox.update({
      where: { id },
      data: { status: "PENDING", attempts: 0, lastError: null, nextAttemptAt: null },
    });
    await writeAudit(tx, { entity: "notification", entityId: id, action: "RETRY", actorId: actor.id });
    return { id, status: "PENDING" as const };
  });
}

// ФБШ-06, 14: хамгийн хуучин хүлээгдэж буй мэдэгдлийн нас (секундээр), /health-д.
export async function oldestPendingAgeSeconds(): Promise<number | null> {
  const oldest = await prisma.notificationOutbox.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  return oldest ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000) : null;
}

// ФШ-63: push мэдэгдэл төхөөрөмж дээр хүрсэнийг service worker баталгаажуулна.
export function acknowledge(actor: Actor, id: string) {
  return prisma.$transaction(async (tx) => {
    const found = await tx.notificationOutbox.findUnique({ where: { id } });
    if (!found) rejected(404, "notification-not-found", "Мэдэгдэл олдсонгүй", "Заасан мэдэгдэл байхгүй.");
    if (found.recipientId !== actor.id) {
      rejected(403, "forbidden-notification", "Эрх хүрэхгүй байна", "Энэ мэдэгдэл танд ирээгүй байна.");
    }
    if (found.status === "SENT") {
      await tx.notificationOutbox.update({
        where: { id },
        data: { status: "DELIVERED", deliveredAt: new Date() },
      });
    }
    return { id };
  });
}

export function subscribePush(actor: Actor, input: SubscribePushInput) {
  return prisma.pushSubscription
    .upsert({
      where: { endpoint: input.endpoint },
      update: { userId: actor.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
      create: { userId: actor.id, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth },
    })
    .then((s) => ({ id: s.id }));
}

export async function unsubscribePush(actor: Actor, endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: actor.id } });
}

export async function getSettings(actor: Actor): Promise<NotificationSettingsDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.id },
    include: { parent: true, pushSubscriptions: { select: { id: true } } },
  });
  return {
    channels: user.parent ? channelsOf(user.parent.notifyChannels) : [],
    email: user.email,
    pushSubscribed: user.pushSubscriptions.length > 0,
    vapidPublicKey: env.VAPID_PUBLIC_KEY ?? null,
  };
}

// ФШ-62: эцэг эх мэдэгдлийн сувгаа сонгоно. Имэйл сувгийн хувьд имэйл хаяг заавал.
export function updateSettings(actor: Actor, input: UpdateNotificationSettingsInput) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: actor.id }, include: { parent: true } });
    if (!user.parent) {
      rejected(403, "forbidden-settings", "Эрх хүрэхгүй байна", "Мэдэгдлийн суваг сонгох нь эцэг эхэд зориулагдсан.");
    }
    const email = input.email === undefined ? user.email : input.email;
    if (input.channels.includes("EMAIL") && !email) {
      rejected(409, "email-required", "Имэйл хаяг шаардлагатай", "Имэйл сувгийг сонгохын тулд имэйл хаягаа оруулна уу.");
    }
    try {
      await tx.user.update({ where: { id: actor.id }, data: { email } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        rejected(409, "email-taken", "Имэйл бүртгэлтэй байна", "Энэ имэйл хаягтай өөр хэрэглэгч бүртгэлтэй байна.");
      }
      throw error;
    }
    await tx.parent.update({ where: { userId: actor.id }, data: { notifyChannels: input.channels } });
    return { channels: input.channels, email };
  });
}
