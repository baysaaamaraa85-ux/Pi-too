import type { Role } from "@pitoo/contracts";
import { getAccessToken, setAccessToken } from "./token-store";

// RFC 9457 (CLAUDE.md 6.6).
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  [key: string]: unknown;
}

export class ApiError extends Error {
  readonly problem: ProblemDetails;
  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.problem = problem;
  }
}

export interface SessionUser {
  id: string;
  role: Role;
  mustChangePassword: boolean;
}

let refreshPromise: Promise<SessionUser | null> | null = null;

// Refresh cookie-гоор access token-ийг шинэчилж, хэрэглэгчийн мэдээллийг буцаана.
async function refreshSession(): Promise<SessionUser | null> {
  refreshPromise ??= (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", { method: "POST", credentials: "include" });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const data = (await res.json()) as { accessToken: string; user: SessionUser };
      setAccessToken(data.accessToken);
      return data.user;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
}

// Хуудас ачаалах үед (access token санах ойд байхгүй) нэг удаа дуудна.
export function bootstrapSession(): Promise<SessionUser | null> {
  return refreshSession();
}

async function request<T>(path: string, options: RequestOptions, isRetry = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

  const res = await fetch(`/api/v1${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  // /auth/* (нэвтрэх, refresh) дээр 401 бол дахин refresh хийхгүй, шууд алдаа буцаана.
  if (res.status === 401 && !isRetry && !path.startsWith("/auth/")) {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, options, true);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("json") ? await res.json() : undefined;

  if (!res.ok) {
    throw new ApiError(
      (payload as ProblemDetails) ?? {
        type: "https://pi-too.mn/errors/unknown",
        title: "Алдаа гарлаа",
        status: res.status,
        detail: "Сервертэй холбогдоход алдаа гарлаа.",
      },
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, { method: "POST", body, idempotencyKey }),
  put: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, { method: "PUT", body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
