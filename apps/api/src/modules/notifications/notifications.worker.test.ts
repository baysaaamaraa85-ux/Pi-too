import { randomInt, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { prisma } from "../../shared/db/prisma.js";
import { Role, type NotificationChannel } from "../../generated/prisma/client.js";
import { notifyUser } from "../../shared/outbox/notify-user.js";
import {
  PermanentChannelError,
  type ChannelAdapter,
  type ChannelRegistry,
  type OutgoingMessage,
} from "./notifications.channels.js";
import { BASE_DELAY_MS, MAX_ATTEMPTS, processOutbox, retryDelayMs } from "./notifications.worker.js";
import { renderNotification } from "./notifications.templates.js";

const app = createApp();
const ORIGIN = "http://localhost:5173";

function phone8(): string {
  return String(randomInt(10_000_000, 99_999_999));
}

async function makeUser(role: Role, opts: { email?: string; fullName?: string; channels?: string[] } = {}) {
  const phone = phone8();
  const user = await prisma.user.create({
    data: { role, phone, email: opts.email, passwordHash: await bcrypt.hash("Correct123!", 10) },
  });
  if (role === Role.PARENT) {
    await prisma.parent.create({
      data: { userId: user.id, fullName: opts.fullName ?? "Эцэг", phone, notifyChannels: opts.channels ?? [] },
    });
  }
  const login = await request(app).post("/api/v1/auth/login").send({ identifier: phone, password: "Correct123!" });
  return { id: user.id, phone, token: login.body.accessToken as string };
}

async function queue(recipientId: string, channel: NotificationChannel, template = "lesson_cancelled") {
  return prisma.notificationOutbox.create({
    data: { recipientId, channel, template, payload: { startsAt: new Date().toISOString(), token: "abc" } },
  });
}

function capture(channel: NotificationChannel, opts: { delayMs?: number; fail?: Error } = {}) {
  const messages: OutgoingMessage[] = [];
  const adapter: ChannelAdapter = {
    channel,
    async send(message) {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs));
      if (opts.fail) throw opts.fail;
      messages.push(message);
    },
  };
  return { adapter, messages };
}

const run = (registry: ChannelRegistry, now?: Date) =>
  processOutbox(registry, { appOrigin: ORIGIN, batchSize: 1000, now });

describe("М9 Outbox илгээх worker (ФШ-60...63, ФБШ-06, ADR-006)", () => {
  it("амжилттай илгээвэл SENT болж, имэйл хаяг, монгол гарчигтайгаар adapter-т очно", async () => {
    const user = await makeUser(Role.PARENT, { email: `${randomUUID().slice(0, 8)}@test.mn` });
    const row = await queue(user.id, "EMAIL");
    const email = capture("EMAIL");
    await run({ EMAIL: email.adapter });

    const stored = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.status).toBe("SENT");
    expect(stored.attempts).toBe(1);
    expect(stored.sentAt).not.toBeNull();
    const msg = email.messages.find((m) => m.notificationId === row.id)!;
    expect(msg.recipient.email).toBe(user.id ? (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email : null);
    expect(msg.title).toBe("Хичээл цуцлагдлаа");
  });

  it("алдаа гарвал 30, 60, 120, 240 секундээр экспоненциал хүлээж, 5 дахь оролдлогын дараа FAILED болно", async () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([30_000, 60_000, 120_000, 240_000]);
    expect(MAX_ATTEMPTS).toBe(5);

    const user = await makeUser(Role.PARENT);
    const row = await queue(user.id, "PUSH");
    const failing = capture("PUSH", { fail: new Error("сүлжээний алдаа") });
    let now = new Date();

    for (let attempt = 1; attempt <= 4; attempt++) {
      await run({ PUSH: failing.adapter }, now);
      const state = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
      expect(state.status).toBe("PENDING");
      expect(state.attempts).toBe(attempt);
      expect(state.nextAttemptAt?.getTime()).toBe(now.getTime() + BASE_DELAY_MS * 2 ** (attempt - 1));
      // Хүлээх хугацаа дуусаагүй үед дахин оролдохгүй.
      await run({ PUSH: failing.adapter }, new Date(now.getTime() + 1000));
      expect((await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(attempt);
      now = new Date(state.nextAttemptAt!.getTime() + 1);
    }
    await run({ PUSH: failing.adapter }, now);
    const final = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(final.status).toBe("FAILED");
    expect(final.attempts).toBe(5);
    expect(final.lastError).toBe("сүлжээний алдаа");
  });

  it("ФШ-63: хаяггүй (PermanentChannelError) эсвэл суваг тохируулаагүй бол шууд FAILED, шалтгаантай", async () => {
    const user = await makeUser(Role.PARENT);
    const noAddress = await queue(user.id, "EMAIL");
    const unconfigured = await queue(user.id, "SMS");
    await run({
      EMAIL: capture("EMAIL", { fail: new PermanentChannelError("Имэйл хаяг бүртгэгдээгүй") }).adapter,
    });
    const a = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: noAddress.id } });
    const b = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: unconfigured.id } });
    expect([a.status, a.attempts, a.lastError]).toEqual(["FAILED", 1, "Имэйл хаяг бүртгэгдээгүй"]);
    expect(b.status).toBe("FAILED");
    expect(b.lastError).toContain("тохируулагдаагүй");
  });

  it("FOR UPDATE SKIP LOCKED: хоёр worker зэрэг ажиллахад мөр бүр нэг л удаа илгээгдэнэ", async () => {
    const user = await makeUser(Role.PARENT);
    const row = await queue(user.id, "EMAIL");
    const slow = capture("EMAIL", { delayMs: 400 });
    await Promise.all([run({ EMAIL: slow.adapter }), run({ EMAIL: slow.adapter })]);
    expect(slow.messages.filter((m) => m.notificationId === row.id)).toHaveLength(1);
    expect((await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } })).attempts).toBe(1);
  });

  it("ФБШ-06: 20 үзэгдлийн мэдэгдэл бүгд нэг циклд илгээгдэж, 5 минутаас хол бага хугацаа", async () => {
    const user = await makeUser(Role.PARENT);
    const rows = await Promise.all(Array.from({ length: 20 }, () => queue(user.id, "PUSH", "attendance_recorded")));
    const started = Date.now();
    const push = capture("PUSH");
    await run({ PUSH: push.adapter });
    expect(Date.now() - started).toBeLessThan(5 * 60_000);
    const states = await prisma.notificationOutbox.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
    expect(states.every((s) => s.status === "SENT")).toBe(true);
  });

  it("ФШ-62: эцэг эхийн сонгосон сувгаар л мэдэгдэл бичигдэнэ (зөвхөн имэйл бол push үгүй)", async () => {
    const emailOnly = await makeUser(Role.PARENT, { channels: ["EMAIL"] });
    const both = await makeUser(Role.PARENT, { channels: ["PUSH", "EMAIL"] });
    const none = await makeUser(Role.PARENT);
    const teacher = await makeUser(Role.TEACHER);
    await prisma.$transaction(async (tx) => {
      for (const id of [emailOnly.id, both.id, none.id, teacher.id]) {
        await notifyUser(tx, id, "attendance_recorded", { studentName: "Х" });
      }
    });
    const channelsOf = async (id: string) =>
      (await prisma.notificationOutbox.findMany({ where: { recipientId: id } })).map((r) => r.channel).sort();
    expect(await channelsOf(emailOnly.id)).toEqual(["EMAIL"]);
    expect(await channelsOf(both.id)).toEqual(["EMAIL", "PUSH"]);
    expect(await channelsOf(none.id)).toEqual(["PUSH"]);
    expect(await channelsOf(teacher.id)).toEqual(["PUSH"]);
  });

  it("ФШ-05: нууц үг сэргээх имэйл холбоостой очно, 30 минутын нэг удаагийн token-оор шинэ нууц үг тохируулна", async () => {
    const email = `${randomUUID().slice(0, 8)}@test.mn`;
    const user = await makeUser(Role.PARENT, { email });
    const res = await request(app).post("/api/v1/auth/password/forgot").send({ email });
    expect(res.status).toBe(204);

    const smtp = capture("EMAIL");
    await run({ EMAIL: smtp.adapter });
    const msg = smtp.messages.find((m) => m.recipient.id === user.id)!;
    expect(msg.title).toBe("Нууц үг сэргээх");
    const token = /token=([A-Za-z0-9_-]+)/.exec(msg.body)?.[1];
    expect(token).toBeTruthy();

    const reset = await request(app).post("/api/v1/auth/password/reset").send({ token, newPassword: "ShinePass123!" });
    expect(reset.status).toBe(204);
    const again = await request(app).post("/api/v1/auth/password/reset").send({ token, newPassword: "BusadPass123!" });
    expect(again.status).not.toBe(204);
    const login = await request(app).post("/api/v1/auth/login").send({ identifier: email, password: "ShinePass123!" });
    expect(login.status).toBe(200);
  });

  it("загварууд монгол бичвэртэй: ирцийн төлөв, үлдсэн багц (академик цаг), чөлөө", () => {
    const r = renderNotification(
      "attendance_recorded",
      { studentName: "Хулан", status: "EXCUSED", remainingHours: 36, leavesLeft: 2, lessonStartsAt: "2026-11-02T02:00:00.000Z" },
      ORIGIN,
    );
    expect(r.body).toContain("Хулан: Чөлөөтэй (2026.11.02 10:00)");
    expect(r.body).toContain("Үлдсэн багц 36 академик цаг, чөлөө 2");
  });
});

describe("М9 Мэдэгдлийн API (ФШ-62, 63)", () => {
  it("ФШ-63: админ алдаатай мэдэгдлийг хүлээн авагчтай нь харж, дахин илгээнэ; бусад үүрэгт 403", async () => {
    const admin = await makeUser(Role.ADMIN);
    const parent = await makeUser(Role.PARENT, { fullName: "Нэртэй Эцэг" });
    const row = await queue(parent.id, "EMAIL");
    await run({});

    const list = await request(app).get("/api/v1/notifications?status=FAILED").set("Authorization", `Bearer ${admin.token}`);
    expect(list.status).toBe(200);
    const found = list.body.items.find((n: { id: string }) => n.id === row.id);
    expect(found).toMatchObject({ recipientName: "Нэртэй Эцэг", status: "FAILED", channel: "EMAIL" });

    const retry = await request(app).post(`/api/v1/notifications/${row.id}/retry`).set("Authorization", `Bearer ${admin.token}`);
    expect(retry.status).toBe(200);
    const stored = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect([stored.status, stored.attempts]).toEqual(["PENDING", 0]);

    expect((await request(app).get("/api/v1/notifications").set("Authorization", `Bearer ${parent.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/notifications/${row.id}/retry`).set("Authorization", `Bearer ${parent.token}`)).status).toBe(403);
  });

  it("ФШ-63: push төхөөрөмж дээр хүрвэл хүлээн авагч баталгаажуулж DELIVERED болно, бусад хүн 403", async () => {
    const parent = await makeUser(Role.PARENT);
    const other = await makeUser(Role.PARENT);
    const row = await queue(parent.id, "PUSH");
    await prisma.notificationOutbox.update({ where: { id: row.id }, data: { status: "SENT" } });

    expect((await request(app).post(`/api/v1/notifications/${row.id}/ack`).set("Authorization", `Bearer ${other.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/notifications/${row.id}/ack`).set("Authorization", `Bearer ${parent.token}`)).status).toBe(200);
    const stored = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.status).toBe("DELIVERED");
    expect(stored.deliveredAt).not.toBeNull();
  });

  it("ФШ-62: эцэг эх сувгаа сонгоно; имэйлгүйгээр имэйл суваг 409; багш сонгох боломжгүй; push бүртгэл", async () => {
    const parent = await makeUser(Role.PARENT);
    const teacher = await makeUser(Role.TEACHER);
    const put = (token: string, body: object) =>
      request(app).put("/api/v1/me/notification-settings").set("Authorization", `Bearer ${token}`).send(body);

    expect((await put(parent.token, { channels: ["EMAIL"] })).status).toBe(409);
    const ok = await put(parent.token, { channels: ["EMAIL", "PUSH"], email: `${randomUUID().slice(0, 8)}@test.mn` });
    expect(ok.status).toBe(200);
    expect((await put(teacher.token, { channels: ["PUSH"] })).status).toBe(403);

    const endpoint = `https://push.example.test/${randomUUID()}`;
    const sub = await request(app)
      .post("/api/v1/push-subscriptions")
      .set("Authorization", `Bearer ${parent.token}`)
      .send({ endpoint, keys: { p256dh: "p256", auth: "auth" } });
    expect(sub.status).toBe(201);
    const settings = await request(app).get("/api/v1/me/notification-settings").set("Authorization", `Bearer ${parent.token}`);
    expect(settings.body).toMatchObject({ channels: ["EMAIL", "PUSH"], pushSubscribed: true });

    await request(app).delete("/api/v1/push-subscriptions").set("Authorization", `Bearer ${parent.token}`).send({ endpoint });
    expect(await prisma.pushSubscription.count({ where: { endpoint } })).toBe(0);
  });
});
