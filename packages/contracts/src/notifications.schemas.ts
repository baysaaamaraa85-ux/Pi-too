import { z } from "zod";
import { pageQuerySchema } from "./common.schemas.js";

// М9 Мэдэгдэл (ФШ-60...64).

export const NotificationChannelValue = z.enum(["PUSH", "EMAIL", "SMS"]);
export type NotificationChannelValue = z.infer<typeof NotificationChannelValue>;

export const NOTIFICATION_CHANNEL_LABELS: Record<NotificationChannelValue, string> = {
  PUSH: "Апп-ын мэдэгдэл (push)",
  EMAIL: "Имэйл",
  SMS: "SMS",
};

export const NOTIFICATION_STATUS_LABELS = {
  PENDING: "Хүлээгдэж байна",
  SENT: "Илгээсэн",
  DELIVERED: "Хүргэгдсэн",
  FAILED: "Алдаатай",
} as const;
export type NotificationStatusValue = keyof typeof NOTIFICATION_STATUS_LABELS;

// ФШ-62: эцэг эх мэдэгдлийн сувгаа сонгоно.
export const updateNotificationSettingsSchema = z.object({
  channels: z.array(NotificationChannelValue).max(3),
  email: z.union([z.literal("").transform(() => null), z.email("Зөв имэйл хаяг оруулна уу")]).optional(),
});
export type UpdateNotificationSettingsInput = z.infer<typeof updateNotificationSettingsSchema>;

export const subscribePushSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
export type SubscribePushInput = z.infer<typeof subscribePushSchema>;

export const unsubscribePushSchema = z.object({ endpoint: z.url() });

// ФШ-63: админы хүргэгдээгүй мэдэгдлийн жагсаалт.
export const notificationsQuerySchema = pageQuerySchema.extend({
  status: z.enum(["PENDING", "SENT", "DELIVERED", "FAILED"]).optional(),
});
export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;

export type NotificationRowDto = {
  id: string;
  recipientId: string;
  recipientName: string;
  recipientContact: string | null;
  channel: NotificationChannelValue;
  template: string;
  status: NotificationStatusValue;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
};

export type NotificationSettingsDto = {
  channels: NotificationChannelValue[];
  email: string | null;
  pushSubscribed: boolean;
  vapidPublicKey: string | null;
};
