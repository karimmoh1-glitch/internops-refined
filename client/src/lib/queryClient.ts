import { QueryClient, QueryFunction } from "@tanstack/react-query";

function getAuthHeaders(): Record<string, string> {
  const stored = localStorage.getItem("internops_auth");
  if (stored) {
    const auth = JSON.parse(stored);
    return { Authorization: `Bearer ${auth.token}` };
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;
  let message = res.statusText || "Something went wrong. Please try again.";
  try {
    const data = await res.json();
    if (data?.message) message = data.message;
  } catch {
    // non-JSON error body (e.g. a proxy/HTML error page) — keep the fallback
  }
  throw new Error(message);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
  };
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      // Interval polling (set per-query where used) only runs while the tab
      // is visible — correct, since there's no point polling a background
      // tab. But that means the moment a user switches away, data can only
      // go stale, with nothing to catch it back up. Refetching on window
      // focus/tab-visible closes that gap: switching back to this tab (or
      // returning from another app) immediately pulls anything missed,
      // gated by staleTime below so it doesn't double-fetch on a focus
      // blip seconds after the last successful fetch.
      refetchOnWindowFocus: true,
      staleTime: 30000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
