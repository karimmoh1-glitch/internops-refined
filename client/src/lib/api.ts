import { QueryClient, type QueryFunction } from "@tanstack/react-query";

export const AUTH_KEY = "internops_auth";

export interface StoredAuth { token: string; user: { id: string; name: string; email: string; role: "admin" | "intern"; companyId: string | null } }

export function readAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as StoredAuth) : null;
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const auth = readAuth();
  return auth ? { Authorization: `Bearer ${auth.token}` } : {};
}

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, message: string, body?: any) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

// A 401 anywhere means the session is gone (expired token, revoked
// device, deactivated account). One event, handled once by AuthProvider,
// instead of every screen guessing.
function handleUnauthorized() {
  window.dispatchEvent(new CustomEvent("internops:unauthorized"));
}

async function toError(res: Response): Promise<ApiError> {
  let message = res.status === 429 ? "Too many requests. Please wait a moment." : res.statusText || "Something went wrong. Please try again.";
  let body: any = null;
  try {
    body = await res.json();
    if (body?.message) message = body.message;
  } catch { /* non-JSON error body */ }
  return new ApiError(res.status, message, body);
}

export async function api<T = any>(method: string, url: string, data?: unknown): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders() };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: data !== undefined ? JSON.stringify(data) : undefined });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Backwards-compatible alias for the handful of older call sites.
export async function apiRequest(method: string, url: string, data?: unknown): Promise<Response> {
  const headers: Record<string, string> = { ...authHeaders() };
  if (data !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: data !== undefined ? JSON.stringify(data) : undefined });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw await toError(res);
  return res;
}

export const defaultQueryFn: QueryFunction = async ({ queryKey }) => {
  const url = queryKey.filter((k) => typeof k === "string").join("/");
  const res = await fetch(url, { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw await toError(res);
  return res.json();
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      refetchOnWindowFocus: true,
      staleTime: 20_000,
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});

export function tzOffset(): number {
  return new Date().getTimezoneOffset();
}

// Server-Sent Events over fetch (EventSource can't send auth headers).
export async function streamSSE(url: string, body: unknown, onEvent: (event: string, data: any) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch(url, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) throw await toError(res);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("Streaming isn't supported in this browser.");
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const ev = block.match(/^event: (.+)$/m)?.[1];
      const dataLine = block.match(/^data: (.+)$/m)?.[1];
      if (ev && dataLine) {
        try { onEvent(ev, JSON.parse(dataLine)); } catch { /* ignore malformed */ }
      }
    }
  }
}
