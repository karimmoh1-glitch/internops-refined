const test = require("node:test");
const assert = require("node:assert/strict");
const { validateApiUrl } = require("../src/config");
const api = require("../src/api");

test("validateApiUrl accepts https and loopback http only", () => {
  assert.deepEqual(validateApiUrl("https://internops-refined-1.onrender.com"), { ok: true, url: "https://internops-refined-1.onrender.com" });
  assert.deepEqual(validateApiUrl("https://example.com/api/"), { ok: true, url: "https://example.com/api" });
  assert.equal(validateApiUrl("http://localhost:5001").ok, true);
  assert.equal(validateApiUrl("http://127.0.0.1:5001").ok, true);
  assert.equal(validateApiUrl("http://[::1]:5001").ok, true);
});

test("validateApiUrl refuses plain http to a real host and nonsense", () => {
  const r = validateApiUrl("http://internops.example.com");
  assert.equal(r.ok, false);
  assert.match(r.reason, /Refusing plain http/);
  assert.equal(validateApiUrl("ftp://x").ok, false);
  assert.equal(validateApiUrl("nope").ok, false);
  assert.equal(validateApiUrl("").ok, false);
});

test("api sends the versioned User-Agent and fires onUnauthorized only for authenticated 401s", async () => {
  const calls = [];
  let unauthorized = 0;
  api.configure({
    version: "1.4.0",
    platform: "darwin",
    apiUrl: "https://api.test",
    onUnauthorized: () => { unauthorized++; },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return { ok: false, status: 401, json: async () => ({ message: "nope" }) };
    },
  });
  await assert.rejects(() => api.login("a@b.c", "pw"), (err) => err.status === 401 && err.permanent === true);
  assert.equal(unauthorized, 0, "a login 401 is a wrong password, not an expired session");
  await assert.rejects(() => api.getActiveSession("tok"));
  assert.equal(unauthorized, 1);
  assert.equal(calls[0].init.headers["User-Agent"], "InternOps-Companion/1.4.0 (macOS)");
  assert.equal(calls[0].url, "https://api.test/api/auth/login");
  assert.equal(calls[1].init.headers.Authorization, "Bearer tok");
});

test("api wraps fetch failures as network ApiErrors (status 0, not permanent)", async () => {
  api.configure({ fetch: async () => { throw new TypeError("fetch failed"); } });
  await assert.rejects(() => api.getActiveSession("tok"), (err) => err.network === true && err.status === 0 && err.permanent === false);
});
