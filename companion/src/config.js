// Single place for the API base URL and every timing constant. Defaults to
// production; override with INTERNOPS_API_URL for local development
// (e.g. `INTERNOPS_API_URL=http://localhost:5001 npm start`).
//
// Plain http:// is refused unless the host is a loopback address — a
// mistyped env var must never silently send a session token in the clear.
const DEFAULT_API_URL = "https://internops-refined-1.onrender.com";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function validateApiUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { ok: false, reason: `"${raw}" is not a valid URL.` };
  }
  const base = u.origin + u.pathname.replace(/\/+$/, "");
  if (u.protocol === "https:") return { ok: true, url: base };
  if (u.protocol === "http:" && LOOPBACK_HOSTS.has(u.hostname)) return { ok: true, url: base };
  if (u.protocol === "http:") {
    return { ok: false, reason: `Refusing plain http:// API URL "${raw}" — only https:// (or http://localhost for development) is allowed.` };
  }
  return { ok: false, reason: `Unsupported API URL scheme "${u.protocol}".` };
}

const apiUrlCheck = validateApiUrl(process.env.INTERNOPS_API_URL || DEFAULT_API_URL);

module.exports = {
  validateApiUrl,
  API_URL_CHECK: apiUrlCheck,
  API_URL: apiUrlCheck.ok ? apiUrlCheck.url : DEFAULT_API_URL,
  // The web app lives at the same origin as the API unless overridden.
  WEB_URL: process.env.INTERNOPS_WEB_URL || (apiUrlCheck.ok ? apiUrlCheck.url : DEFAULT_API_URL),

  // How often to sample the frontmost application while Work Mode is on.
  SAMPLE_INTERVAL_MS: 15_000,
  // How often the persistent outbox is flushed to the server.
  FLUSH_INTERVAL_MS: 5 * 60_000,
  // Seconds without keyboard/mouse input before a bucket is closed and the
  // following samples are recorded with their idle reading.
  IDLE_THRESHOLD_SECONDS: 300,
  // Buckets shorter than this are dropped as blips; buckets longer than the
  // max are split so a single row never approaches the server's 6h cap.
  MIN_BUCKET_SECONDS: 5,
  MAX_BUCKET_SECONDS: 60 * 60,
  // Server-side cap on rows per activity request.
  MAX_ROWS_PER_REQUEST: 200,
  // Reconcile local state against the server on this cadence.
  RECONCILE_ACTIVE_MS: 10_000,
  RECONCILE_IDLE_MS: 30_000,
  // How often to re-read the recommended task while a shift is on.
  TASK_REFRESH_MS: 60_000,
  // Per-request timeout for every API call.
  REQUEST_TIMEOUT_MS: 15_000,
  // How often to check GitHub Releases for a newer Companion build.
  UPDATE_CHECK_INTERVAL_MS: 4 * 60 * 60_000,
};
