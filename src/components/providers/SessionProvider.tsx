"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    image?: string;
  };
};

type Props = {
  children: React.ReactNode;
};

type AuthContextValue = {
  data: AuthSession | null;
  status: "loading" | "authenticated" | "unauthenticated";
  refreshSession: () => Promise<AuthSession | null>;
  signOut: (callbackUrl?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export default function AuthSessionProvider({ children }: Props) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<
    "loading" | "authenticated" | "unauthenticated"
  >("loading");

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok || !data.session) {
        setSession(null);
        setStatus("unauthenticated");
        return null;
      }

      setSession(data.session);
      setStatus("authenticated");
      return data.session as AuthSession;
    } catch {
      setSession(null);
      setStatus("unauthenticated");
      return null;
    }
  }, []);

  const signOut = useCallback(async (callbackUrl = "/login") => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setSession(null);
      setStatus("unauthenticated");
      window.location.href = callbackUrl;
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      data: session,
      status,
      refreshSession,
      signOut,
    }),
    [refreshSession, session, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used within AuthSessionProvider");
  }

  return value;
}
