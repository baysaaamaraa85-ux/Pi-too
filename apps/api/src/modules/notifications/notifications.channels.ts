import type { NotificationChannel } from "../../generated/prisma/client.js";

// ФБШ-28: суваг бүр нэг интерфэйсийг хэрэгжүүлнэ. Шинэ суваг (жишээ нь SMS) нэмэхэд зөвхөн
// шинэ adapter бичиж registry-д бүртгэнэ, бусад модулийн код өөрчлөгдөхгүй.

export interface MessageRecipient {
  id: string;
  email: string | null;
  phone: string | null;
  pushSubscriptions: { endpoint: string; p256dh: string; auth: string }[];
}

export interface OutgoingMessage {
  notificationId: string;
  recipient: MessageRecipient;
  title: string;
  body: string;
  url?: string;
}

// Амжилттай бол resolve. Дахин оролдох боломжгүй (хаяггүй г.м.) бол PermanentChannelError.
export interface ChannelAdapter {
  readonly channel: NotificationChannel;
  send(message: OutgoingMessage): Promise<void>;
}

// Сувгийн тохиргоо хийгдээгүй, эсвэл хүлээн авагчид хаяг байхгүй: дахин оролдоод ч болохгүй.
export class PermanentChannelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentChannelError";
  }
}

export type ChannelRegistry = Partial<Record<NotificationChannel, ChannelAdapter>>;
