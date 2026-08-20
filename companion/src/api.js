const { API_URL } = require("./config");

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", token, body } = {}) {
  const headers = { "User-Agent": `InternOps-Companion/1.3.0 (${process.platform})` };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON response (e.g. a proxy error page) — fall through with data=null.
  }

  if (!res.ok) {
    throw new ApiError(data?.message || `Request failed (${res.status})`, res.status);
  }
  return data;
}

module.exports = {
  ApiError,
  login: (email, password) => request("/api/auth/login", { method: "POST", body: { email, password } }),
  me: (token) => request("/api/tasks/mine", { token }), // cheap authenticated ping that also doubles as "am I still logged in"
  getActiveSession: (token) => request("/api/work-sessions/active", { token }),
  startSession: (token) => request("/api/work-sessions/start", { method: "POST", token }),
  endSession: (token) => request("/api/work-sessions/end", { method: "POST", token }),
  postActivity: (token, activities) => request("/api/work-sessions/activity", { method: "POST", token, body: { activities } }),
  getMyTasks: (token) => request("/api/tasks/mine", { token }),
  getNextBest: (token) => request(`/api/tasks/next-best?tzOffsetMinutes=${new Date().getTimezoneOffset()}`, { token }),
  getSummary: (token, sessionId) => request(`/api/work-sessions/${sessionId}/summary`, { token }),
  updateSummary: (token, sessionId, internNote) => request(`/api/work-sessions/${sessionId}/summary`, { method: "PATCH", token, body: { internNote } }),
  submitSummary: (token, sessionId) => request(`/api/work-sessions/${sessionId}/summary/submit`, { method: "POST", token }),
};
