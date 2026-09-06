"use client";

import type { AuthSessionDto, AuthUserDto } from "@thread/types";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { authRequest, refreshSession } from "./auth-client";

interface AuthContextValue {
  readonly accessToken: string | null;
  readonly status: "unknown" | "authenticated" | "anonymous";
  readonly user: AuthUserDto | null;
  establish(session: AuthSessionDto): void;
  refresh(): Promise<AuthSessionDto | null>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionDto | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("unknown");
  const establish = useCallback((next: AuthSessionDto) => {
    setSession(next);
    setStatus("authenticated");
  }, []);
  const refreshInFlight = useRef<Promise<AuthSessionDto | null> | null>(null);
  const refresh = useCallback(() => {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = refreshSession()
      .then((next) => {
        establish(next);
        return next;
      })
      .catch(() => {
        setSession(null);
        setStatus("anonymous");
        return null;
      })
      .finally(() => {
        refreshInFlight.current = null;
      });
    return refreshInFlight.current;
  }, [establish]);
  const logout = useCallback(async () => {
    try {
      await authRequest<void>("/logout", { method: "POST" });
    } finally {
      setSession(null);
      setStatus("anonymous");
    }
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.accessToken ?? null,
      establish,
      logout,
      refresh,
      status,
      user: session?.user ?? null,
    }),
    [establish, logout, refresh, session, status],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
