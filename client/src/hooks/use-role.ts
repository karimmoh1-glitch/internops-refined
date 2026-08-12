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

  const login = useCallback(async (email: string, password: string, expectedRole?: "admin" | "intern") => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, expectedRole }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Login failed"));
    }
    const data = await res.json();
    const state: AuthState = { token: data.token, user: data.user };
    persistAuth(state);
    return state.user;
  }, [persistAuth]);

  // Signup no longer logs the user in — it creates a pending application
  // that a manager must approve before any account (or login access)
  // exists, so there's nothing to persist here.
  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, "Signup failed"));
    }
    return res.json();
  }, []);

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
