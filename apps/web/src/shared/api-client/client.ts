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

// fetch сүлжээний алдаанд TypeError шиддэг (сервер хариу өгөөгүй). HTTP алдаа (4xx, 5xx) биш.
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
}

// ФБШ-15: сүлжээгүй үед хуудас дахин ачаалахад refresh cookie-г шалгах боломжгүй. Сүүлд нэвтэрсэн
// хэрэглэгчийн id, үүргийг (token БИШ) хадгалж, ирцийн дэлгэцийг нээж, ирцийг дараалалд хийнэ.
// Сервер бүх хүсэлтийг өөрөө шалгах тул энэ нь зөвхөн дэлгэц харуулахад.
const LAST_USER_KEY = "pitoo.lastUser";

export function rememberUser(user: SessionUser): void {
  try {
    localStorage.setItem(LAST_USER_KEY, JSON.stringify({ id: user.id, role: user.role }));
  } catch {
    // хувийн цонх зэрэгт хадгалахгүй
  }
}

export function forgetUser(): void {
  try {
    localStorage.removeItem(LAST_USER_KEY);
  } catch {
    // ignore
  }
}

function storedUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(LAST_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string; role?: Role };
    if (!parsed.id || !parsed.role) return null;
    return { id: parsed.id, role: parsed.role, mustChangePassword: false };
  } catch {
    return null;
  }
}

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
      rememberUser(data.user);
      return data.user;
    } catch (error) {
      // Сервертэй холбогдож чадсангүй: сүүлд нэвтэрсэн хэрэглэгчээр офлайн ажиллана.
      return isNetworkError(error) ? storedUser() : null;
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

// Файл (Excel, PDF) татах: Authorization толгойтой хүсэлт илгээж, браузерт хадгалуулна.
export async function downloadFile(path: string, filename: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const problem = (await res.json().catch(() => null)) as ProblemDetails | null;
    throw new ApiError(
      problem ?? {
        type: "https://pi-too.mn/errors/unknown",
        title: "Алдаа гарлаа",
        status: res.status,
        detail: "Файлыг татаж чадсангүй.",
      },
    );
  }
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
