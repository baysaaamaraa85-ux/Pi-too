import type { NotificationRowDto, NotificationSettingsDto, Paginated } from "@pitoo/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { api } from "@/shared/api-client/client";

export function useNotificationList(status: string, page: number) {
  const params = new URLSearchParams({ page: String(page), limit: "20" });
  if (status) params.set("status", status);
  return useQuery({
    queryKey: ["notifications", status, page],
    queryFn: () => api.get<Paginated<NotificationRowDto>>(`/notifications?${params.toString()}`),
    refetchInterval: 30_000,
  });
}

export function useRetryNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/retry`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useNotificationSettings() {
  return useQuery({
    queryKey: ["notification-settings"],
    queryFn: () => api.get<NotificationSettingsDto>("/me/notification-settings"),
  });
}

export function useSaveNotificationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { channels: string[]; email: string }) =>
      api.put("/me/notification-settings", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-settings"] }),
  });
}

function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

// ФШ-62: хөтчийг push мэдэгдэлд бүртгэнэ (VAPID).
export function usePushSubscribe(vapidPublicKey: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!pushSupported()) throw new Error("Энэ хөтөч push мэдэгдэл дэмжихгүй байна.");
      if (!vapidPublicKey) throw new Error("Push тохиргоо хийгдээгүй байна.");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Мэдэгдэл хүлээн авах зөвшөөрөл өгөөгүй байна.");
      // Үйлдвэрлэлд PWA-ийн service worker (push-sw.js-ийг агуулсан) бүртгэгдсэн байна. Хөгжүүлэлтийн
      // сервер дээр PWA идэвхгүй тул push-sw.js-ийг тусад нь бүртгэнэ.
      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/push-sw.js"));
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        }));
      const json = subscription.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      await api.post("/push-subscriptions", { endpoint: json.endpoint, keys: json.keys });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notification-settings"] }),
  });
}

// Service worker "хүрсэн" гэж мэдэгдэхэд API-д баталгаажуулна (DELIVERED).
export function usePushAck() {
  React.useEffect(() => {
    if (!pushSupported()) return;
    const handler = (event: MessageEvent) => {
      const data = event.data as { type?: string; id?: string | null } | undefined;
      if (data?.type === "push-received" && data.id) void api.post(`/notifications/${data.id}/ack`).catch(() => {});
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []);
}
