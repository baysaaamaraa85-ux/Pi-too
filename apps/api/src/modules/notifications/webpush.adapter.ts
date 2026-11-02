import webpush from "web-push";
import { PermanentChannelError, type ChannelAdapter, type OutgoingMessage } from "./notifications.channels.js";

export interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

// ФШ-62: Web Push (VAPID). Нэг хэрэглэгч олон төхөөрөмжтэй байж болно. Бүх төхөөрөмж
// амжилтгүй бол л алдаа гэж үзнэ.
export function createWebPushAdapter(config: WebPushConfig): ChannelAdapter {
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return {
    channel: "PUSH",
    async send(message: OutgoingMessage) {
      const subs = message.recipient.pushSubscriptions;
      if (subs.length === 0) {
        throw new PermanentChannelError("Хүлээн авагч push мэдэгдэлд бүртгүүлээгүй байна.");
      }
      const payload = JSON.stringify({
        id: message.notificationId,
        title: message.title,
        body: message.body,
        url: message.url,
      });
      const results = await Promise.allSettled(
        subs.map((s) =>
          webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload),
        ),
      );
      if (results.every((r) => r.status === "rejected")) {
        const first = results[0] as PromiseRejectedResult;
        throw first.reason instanceof Error ? first.reason : new Error("Push илгээж чадсангүй");
      }
    },
  };
}
