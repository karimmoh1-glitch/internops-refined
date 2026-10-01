import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_KEY, readAuth, type StoredAuth } from "./api";

export type AuthUser = StoredAuth["user"];

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<{ pending: boolean; user?: AuthUser }>;
  acceptInvite: (token: string, name: string, password: string) => Promise<AuthUser>;
  signOut: (reason?: string) => void;
  refresh: () => Promise<void>;
  expiredReason: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function parseError(res: Response, fallback: string): Promise<Error & { applicationStatus?: string }> {
  let body: any = null;
  try { body = await res.json(); } catch { /* ignore */ }
  const err: Error & { applicationStatus?: string } = new Error(body?.message || fallback);
  if (body?.applicationStatus) err.applicationStatus = body.applicationStatus;
  return err;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<StoredAuth | null>(() => readAuth());
  const [ready, setReady] = useState(false);
  const [expiredReason, setExpiredReason] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const persist = useCallback((next: StoredAuth | null) => {
    if (next) localStorage.setItem(AUTH_KEY, JSON.stringify(next));
    else localStorage.removeItem(AUTH_KEY);
    setAuth(next);
  }, []);

  const signOut = useCallback((reason?: string) => {
    persist(null);
    queryClient.clear();
    if (reason) setExpiredReason(reason);
  }, [persist, queryClient]);

  // Role and name come from the server, not from whatever was stored at
  // login — a promoted or renamed user sees the change on next load.
  const refresh = useCallback(async () => {
    const current = readAuth();
    if (!current) { setReady(true); return; }
    try {
      const res = await fetch("/api/auth/me", { headers: { Authorization: `Bearer ${current.token}` } });
      if (res.status === 401) { signOut("Your session has ended. Sign in again to continue."); return; }
      if (res.ok) {
        const me = await res.json();
        persist({ token: current.token, user: { id: me.id, name: me.name, email: me.email, role: me.role, companyId: me.companyId } });
      }
    } catch { /* offline: keep the stored session */ }
    finally { setReady(true); }
  }, [persist, signOut]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => signOut("Your session has ended. Sign in again to continue.");
    window.addEventListener("internops:unauthorized", onUnauthorized);
    const onStorage = (e: StorageEvent) => { if (e.key === AUTH_KEY) setAuth(readAuth()); };
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("internops:unauthorized", onUnauthorized); window.removeEventListener("storage", onStorage); };
  }, [signOut]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (!res.ok) throw await parseError(res, "Login failed");
    const data = await res.json();
    setExpiredReason(null);
    persist({ token: data.token, user: data.user });
    return data.user as AuthUser;
  }, [persist]);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, email, password }) });
    if (!res.ok) throw await parseError(res, "Signup failed");
    const data = await res.json();
    if (data.pending) return { pending: true };
    persist({ token: data.token, user: data.user });
    return { pending: false, user: data.user as AuthUser };
  }, [persist]);

  const acceptInvite = useCallback(async (token: string, name: string, password: string) => {
    const res = await fetch(`/api/invitations/accept/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password }) });
    if (!res.ok) throw await parseError(res, "Failed to accept invitation");
    const data = await res.json();
    persist({ token: data.token, user: data.user });
    return data.user as AuthUser;
  }, [persist]);

  const value = useMemo<AuthContextValue>(() => ({
    user: auth?.user ?? null, token: auth?.token ?? null, ready, login, signup, acceptInvite, signOut, refresh, expiredReason,
  }), [auth, ready, login, signup, acceptInvite, signOut, refresh, expiredReason]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
