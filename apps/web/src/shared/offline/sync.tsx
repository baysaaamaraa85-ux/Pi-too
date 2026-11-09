import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Link } from "react-router";
import { useAuth } from "@/features/auth/auth-context";
import { ApiError, api, isNetworkError } from "@/shared/api-client/client";
import { Button } from "@/shared/ui/button";
import {
  listQueued,
  markRejected,
  removeQueued,
  subscribeQueue,
  type QueuedAttendance,
} from "./attendance-queue";

const RETRY_MS = 15_000;

function subscribeOnline(listener: () => void) {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);
  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

export function useOnline(): boolean {
  return React.useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

// Нэвтэрсэн хэрэглэгчийн дараалал (өөрчлөлт бүрт шинэчлэгдэнэ).
export function useQueue(): QueuedAttendance[] {
  const { user } = useAuth();
  const [items, setItems] = React.useState<QueuedAttendance[]>([]);
  const userId = user?.id;
  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const load = () =>
      void listQueued(userId)
        .then((next) => {
          if (!cancelled) setItems(next);
        })
        .catch(() => {
          // IndexedDB байхгүй (хувийн цонх) бол дараалал хоосон гэж үзнэ.
        });
    load();
    const unsubscribe = subscribeQueue(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId]);
  return userId ? items : [];
}

let flushing = false;

// Хуучин нь эхэндээ, нэг нэгээр нь илгээнэ. Сүлжээний алдаа, 401, 5xx бол зогсоод дараа дахин оролдоно
// (өгөгдөл хэвээр). Сервер татгалзсан (4xx) бол rejected болгож хэрэглэгчид харуулна.
export async function flushQueue(userId: string): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of await listQueued(userId)) {
      if (item.status !== "pending") continue;
      try {
        await api.put(
          `/lessons/${item.lessonId}/attendance`,
          { entries: item.entries, reason: item.reason },
          item.key,
        );
        await removeQueued(item.lessonId);
        sent += 1;
      } catch (error) {
        if (isNetworkError(error)) break;
        if (error instanceof ApiError && error.problem.status >= 400 && error.problem.status < 500) {
          if (error.problem.status === 401) break;
          await markRejected(item.lessonId, error.problem.detail);
          continue;
        }
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}

// Холболт сэргэх, цонх идэвхжих, 15 секунд тутам дарааллыг илгээнэ. Илгээгдмэгц хуудасны
// өгөгдлийг шинэчилнэ.
export function useOfflineSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id;
  const online = useOnline();
  const queue = useQueue();
  const pending = queue.filter((item) => item.status === "pending").length;

  React.useEffect(() => {
    if (!userId || !online || pending === 0) return;
    let stopped = false;
    const attempt = () =>
      void flushQueue(userId).then((sent) => {
        if (!stopped && sent > 0) void queryClient.invalidateQueries();
      });
    attempt();
    const timer = window.setInterval(attempt, RETRY_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [userId, online, pending, queryClient]);

  return { online, queue, pending };
}

// ФБШ-15, 3.7: "Сүлжээгүй байна, холбогдмогц илгээнэ" туузан мэдэгдэл. Мөн илгээгдэж буй ба
// сервер татгалзсан ирцийг харуулна.
export function OfflineBanner() {
  const { user } = useAuth();
  const { online, queue, pending } = useOfflineSync();
  const rejected = queue.filter((item) => item.status === "rejected");
  if (online && pending === 0 && rejected.length === 0) return null;

  return (
    <div className="sticky top-16 z-30 grid gap-px" data-testid="offline-banner">
      {!online || pending > 0 ? (
        <p
          role="status"
          className="bg-warning-bg px-4 py-2.5 text-center text-sm font-semibold text-warning"
          data-testid="offline-status"
        >
          {!online
            ? user?.role === "TEACHER"
              ? "Сүлжээгүй байна, холбогдмогц илгээнэ"
              : "Сүлжээгүй байна"
            : `Илгээгдээгүй ирц: ${pending}. Илгээж байна...`}
          {!online && pending > 0 ? ` (хадгалсан ирц: ${pending})` : ""}
        </p>
      ) : null}
      {rejected.map((item) => (
        <div
          key={item.lessonId}
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 bg-danger-bg px-4 py-2.5 text-sm font-semibold text-danger"
          data-testid="offline-rejected"
        >
          <span>
            Ирц илгээгдсэнгүй: {item.error}{" "}
            <Link to={`/teacher/attendance/${item.lessonId}`} className="underline">
              Хичээлийг нээх
            </Link>
          </span>
          <Button variant="secondary" onClick={() => void removeQueued(item.lessonId)}>
            Хаах
          </Button>
        </div>
      ))}
    </div>
  );
}
