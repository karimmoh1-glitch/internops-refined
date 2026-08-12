import { useState, useCallback, useEffect } from "react";
import { parseErrorMessage } from "@/lib/api-error";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "intern";
  companyId: string | null;
}

interface AuthState {
  token: string;
  user: AuthUser;
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(() => {
    const stored = localStorage.getItem("internops_auth");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (auth) {
      localStorage.setItem("internops_auth", JSON.stringify(auth));
    } else {
      localStorage.removeItem("internops_auth");
    }
  }, [auth]);

  const persistAuth = useCallback((state: AuthState) => {
    localStorage.setItem("internops_auth", JSON.stringify(state));
    setAuth(state);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = await res.clone().json().catch(() => null);
      const error: Error & { applicationStatus?: "pending" | "rejected" } = new Error(
        await parseErrorMessage(res, "Login failed")
      );
      if (body?.applicationStatus === "pending" || body?.applicationStatus === "rejected") {
        error.applicationStatus = body.applicationStatus;
      }
      throw error;
    }
    const data = await res.json();
    const state: AuthState = { token: data.token, user: data.user };
    persistAuth(state);
    return state.user;
  }, [persistAuth]);

  // Normally signup creates a pending application that a manager must
  // approve — nothing to log into yet. The one exception is a freshly
  // deployed instance with zero managers: that signup bootstraps the first
  // admin account directly and the server returns a real token, same
  // shape as login, so we persist it here too.
  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Signup failed"));
    }
    const data = await res.json();
    if (data.token && data.user) {
      persistAuth({ token: data.token, user: data.user });
      return { bootstrapped: true as const };
    }
    return { bootstrapped: false as const };
  }, [persistAuth]);

  const acceptInvite = useCallback(async (token: string, name: string, password: string) => {
    const res = await fetch(`/api/invitations/accept/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, password }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Failed to accept invitation"));
    }
    const data = await res.json();
    const state: AuthState = { token: data.token, user: data.user };
    persistAuth(state);
    return state.user;
  }, [persistAuth]);

  const signOut = useCallback(() => {
    setAuth(null);
    localStorage.removeItem("internops_auth");
    localStorage.removeItem("internops_user");
  }, []);

  return {
    user: auth?.user ?? null,
    token: auth?.token ?? null,
    isAuthenticated: !!auth,
    login,
    signup,
    acceptInvite,
    signOut,
  };
}
