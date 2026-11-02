import type { Env } from "../../config/env.js";
import type { ChannelRegistry } from "./notifications.channels.js";
import { createSmsAdapter } from "./sms.adapter.js";
import { createSmtpAdapter } from "./smtp.adapter.js";
import { createWebPushAdapter } from "./webpush.adapter.js";

// Орчны тохиргооноос (config/env.ts) сувгуудыг бүртгэнэ. Тохиргоо дутуу суваг registry-д
// орохгүй, тэр суваг руу очих мэдэгдэл "суваг тохируулагдаагүй" алдаатай FAILED болж
// админы жагсаалтад (ФШ-63) гарна.
export function buildChannelRegistry(env: Env): ChannelRegistry {
  const registry: ChannelRegistry = { SMS: createSmsAdapter() };
  if (env.SMTP_HOST) {
    registry.EMAIL = createSmtpAdapter({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
    });
  }
  if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
    registry.PUSH = createWebPushAdapter({
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT,
    });
  }
  return registry;
}
