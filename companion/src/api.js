// Thin HTTP client for the InternOps server. Every call goes through
// request(): one User-Agent, one timeout, one error shape, and one place
// where a 401 on an authenticated call is turned into "session expired"
// for the whole app (see configure({ onUnauthorized })).
const { API_URL, REQUEST_TIMEOUT_MS } = require("./config");

class ApiError extends Error {
  constructor(message, status, { network = false, data = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 0 for network-level failures
    this.network = network;
    this.data = data;
    if (cause) this.cause = cause;
  }
  // Server rejected the request outright; retrying the same payload will
  // never succeed. 408 (timeout) and 429 (rate limit) are the exceptions.
  get permanent() {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429;
  }
}

let userAgent = "InternOps-Companion/0.0.0 (unknown)";
let onUnauthorized = null;
let baseUrl = API_URL;
let fetchImpl = (...args) => globalThis.fetch(...args);

function platformLabel(platform) {
  if (platform === "darwin") return "macOS";
  if (platform === "win32") return "Windows";
  return "Linux";
}

function configure({ version, platform = process.platform, onUnauthorized: handler, apiUrl, fetch } = {}) {
  if (version) userAgent = `InternOps-Companion/${version} (${platformLabel(platform)})`;
  if (handler !== undefined) onUnauthorized = handler;
  if (apiUrl) baseUrl = apiUrl;
  if (fetch) fetchImpl = fetch;
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { "User-Agent": userAgent, Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    const timedOut = err?.name === "AbortError";
    throw new ApiError(timedOut ? "The server took too long to respond." : "Can't reach the InternOps server.", 0, { network: true, cause: err });
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page) — fall through with data=null.
  }

  if (res.status === 401 && token) {
    // Only authenticated calls mean "your session is gone". A 401 from
    // /api/auth/login is just a wrong password and is handled by the caller.
    try { onUnauthorized?.(data?.message || "Session expired"); } catch { /* never let the hook break the call */ }
  }

  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status, { data });
  }
  return data;
}

module.exports = {
  ApiError,
  configure,
  request,
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/api/auth/me", { token }),
  getActiveSession: (token) => request("/api/work-sessions/active", { token }),
  startSession: (token) => request("/api/work-sessions/start", { method: "POST", token }),
  endSession: (token) => request("/api/work-sessions/end", { method: "POST", token }),
  postActivity: (token, activities) => request("/api/work-sessions/activity", { method: "POST", token, body: { activities } }),
  getMyTasks: (token) => request("/api/tasks/mine", { token }),
  getNextBest: (token) => request(`/api/tasks/next-best?tzOffsetMinutes=${new Date().getTimezoneOffset()}`, { token }),
  getSummary: (token, sessionId) => request(`/api/work-sessions/${encodeURIComponent(sessionId)}/summary`, { token }),
  updateSummary: (token, sessionId, internNote) => request(`/api/work-sessions/${encodeURIComponent(sessionId)}/summary`, { method: "PATCH", token, body: { internNote } }),
  submitSummary: (token, sessionId) => request(`/api/work-sessions/${encodeURIComponent(sessionId)}/summary/submit`, { method: "POST", token }),
  getDevices: (token) => request("/api/devices", { token }),
  revokeDevice: (token, id) => request(`/api/devices/${encodeURIComponent(id)}`, { method: "DELETE", token }),
};
