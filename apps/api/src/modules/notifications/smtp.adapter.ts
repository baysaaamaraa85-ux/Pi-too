import nodemailer from "nodemailer";
import { PermanentChannelError, type ChannelAdapter, type OutgoingMessage } from "./notifications.channels.js";

export interface SmtpConfig {
  host: string;
  port: number;
  from: string;
  user?: string;
  pass?: string;
  secure?: boolean;
}

// ФШ-05, 62: имэйл (SMTP). Хөгжүүлэлтэд Mailpit (1025), үйлдвэрлэлд TLS :587 (ФБШ-21).
export function createSmtpAdapter(config: SmtpConfig): ChannelAdapter {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure ?? false,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
  return {
    channel: "EMAIL",
    async send(message: OutgoingMessage) {
      if (!message.recipient.email) {
        throw new PermanentChannelError("Хүлээн авагчид имэйл хаяг бүртгэгдээгүй байна.");
      }
      await transport.sendMail({
        from: config.from,
        to: message.recipient.email,
        subject: message.title,
        text: message.url && !message.body.includes(message.url) ? `${message.body}\n\n${message.url}` : message.body,
      });
    },
  };
}
