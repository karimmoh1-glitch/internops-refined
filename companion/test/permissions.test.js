// The macOS window-title permission decision (two gates: Automation to
// System Events, and Accessibility) and how check() combines pre-flight
// results with what the sampler has actually seen. No OS calls: the live
// signals are seeded through workContext's test seam and probe=false.
const test = require("node:test");
const assert = require("node:assert/strict");
const { windowTitleStatus, check } = require("../src/permissions");
const workContext = require("../src/workContext");

test("windowTitleStatus: a denied Apple Event wins, and names Automation (or both when Accessibility is also off)", () => {
  assert.deepEqual(windowTitleStatus({ accessibility: null, systemEvents: "denied", live: { status: "unknown" } }), { status: "denied", gate: "automation" });
  assert.deepEqual(windowTitleStatus({ accessibility: false, systemEvents: "denied", live: { status: "unknown" } }), { status: "denied", gate: "both" });
  assert.deepEqual(windowTitleStatus({ accessibility: true, systemEvents: "denied", live: { status: "ok" } }), { status: "denied", gate: "automation" }, "a current denial beats a stale ok");
});

test("windowTitleStatus: Accessibility off → denied/accessibility; both open → ok even before the first sample", () => {
  assert.deepEqual(windowTitleStatus({ accessibility: false, systemEvents: "ok", live: { status: "unknown" } }), { status: "denied", gate: "accessibility" });
  assert.deepEqual(windowTitleStatus({ accessibility: true, systemEvents: "ok", live: { status: "unknown" } }), { status: "ok", gate: null });
  assert.deepEqual(windowTitleStatus({ accessibility: true, systemEvents: "unknown", live: { status: "ok" } }), { status: "ok", gate: null }, "a real observed title is proof enough");
});

test("windowTitleStatus: with nothing known it is unknown, never guessed; a live denial carries its gate", () => {
  assert.deepEqual(windowTitleStatus({ accessibility: null, systemEvents: "unknown", live: { status: "unknown" } }), { status: "unknown", gate: null });
  assert.deepEqual(windowTitleStatus({ accessibility: null, systemEvents: "unknown", live: { status: "error" } }), { status: "error", gate: null });
  assert.deepEqual(windowTitleStatus({ accessibility: null, systemEvents: "ok", live: { status: "denied", gate: "accessibility" } }), { status: "denied", gate: "accessibility" });
});

test("check({ probe: false }) reflects the sampler: app observed without any permission, title denied with its gate", { skip: process.platform !== "darwin" && "macOS-only decision" }, async () => {
  workContext._noteSignal("app", "ok");
  workContext._noteSignal("systemEvents", "denied", "Not authorized to send Apple events to System Events. (-1743)");
  workContext._noteSignal("windowTitle", "denied", "(-1743)", { gate: "automation" });
  workContext._noteSignal("browserDomain", "ok", null, { browser: "Safari" });
  const p = await check({ probe: false });
  assert.equal(p.platform, "macos");
  assert.equal(p.app, "ok");
  assert.equal(p.windowTitle, "denied");
  assert.ok(p.windowTitleGate === "automation" || p.windowTitleGate === "both");
  assert.equal(p.browserDomain, "ok");
  assert.equal(p.browser, "Safari");
  assert.equal(p.needsAttention, true);
});
