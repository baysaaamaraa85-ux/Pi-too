import type { Role } from "@pitoo/contracts";
import * as React from "react";
import { api, bootstrapSession, type SessionUser } from "@/shared/api-client/client";
import { setAccessToken, subscribeAccessToken } from "@/shared/api-client/token-store";

export type AuthUser = SessionUser;

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "anonymous";
  login: (identifier: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  passwordChanged: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [status, setStatus] = React.useState<AuthContextValue["status"]>("loading");

  // Хуудас ачаалах үед refresh cookie-гоор session сэргээнэ (access token санах ойд л байдаг).
  React.useEffect(() => {
    let cancelled = false;
    void bootstrapSession().then((session) => {
      if (cancelled) return;
      setUser(session);
      setStatus(session ? "authenticated" : "anonymous");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Хүсэлтийн явцад refresh амжилтгүй болбол (token цуцлагдсан) нэвтрээгүй төлөвт орно.
  React.useEffect(
    () =>
      subscribeAccessToken((token) => {
        if (token === null) {
          setUser(null);
          setStatus("anonymous");
        }
      }),
    [],
  );

  const login = React.useCallback(async (identifier: string, password: string) => {
    const result = await api.post<{
      accessToken: string;
      user: { id: string; role: Role; mustChangePassword: boolean };
    }>("/auth/login", { identifier, password });
    setAccessToken(result.accessToken);
    setUser(result.user);
    setStatus("authenticated");
    return result.user;
  }, []);

  const logout = React.useCallback(async () => {
    await api.post("/auth/logout").catch(() => undefined);
    setAccessToken(null);
  }, []);

  const passwordChanged = React.useCallback(() => {
    setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
  }, []);

  const value = React.useMemo(
    () => ({ user, status, login, logout, passwordChanged }),
    [user, status, login, logout, passwordChanged],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth нь AuthProvider дотор ашиглагдах ёстой");
  return ctx;
}
