// The Work Mode state machine: start/stop idempotence, stop ordering
// (sampling off → flush → end), reconcile adoption/termination, and —
// the audit's headline — proof that nothing can start a tracker while a
// stop is mid-flight, so no sampler is ever orphaned after End Shift.
const test = require("node:test");
const assert = require("node:assert/strict");
const { WorkMode, STATES } = require("../src/workMode");
const { ApiError } = require("../src/api");

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

class FakeTracker {
  constructor(onBucket) {
    this.onBucket = onBucket;
    this.running = false;
    this.paused = false;
    this.stops = 0;
  }
  start() { this.running = true; }
  stop() {
    this.running = false;
    this.stops++;
    this.onBucket({ application: "VS Code", startedAt: new Date(Date.now() - 10_000).toISOString(), endedAt: new Date().toISOString(), durationSeconds: 10 });
  }
  pause(r) { this.paused = true; this.reason = r; }
  resume() { this.paused = false; }
}

class FakeOutbox {
  constructor() { this.rows = []; this.flushes = 0; this.delay = null; }
  get size() { return this.rows.length; }
  get nextAttemptAt() { return 0; }
  enqueue(row) { this.rows.push(row); }
  clear() { this.rows = []; }
  async flush(sender) {
    this.flushes++;
    if (this.delay) await this.delay.promise;
    if (this.rows.length === 0) return { sent: 0, dropped: 0, rejected: 0, remaining: 0 };
    const chunk = this.rows.splice(0);
    try {
      await sender(chunk);
      return { sent: chunk.length, dropped: 0, rejected: 0, remaining: 0 };
    } catch (err) {
      if (err.permanent) return { sent: 0, dropped: chunk.length, rejected: 0, remaining: 0 };
      this.rows.unshift(...chunk);
      return { sent: 0, dropped: 0, rejected: 0, failed: true, remaining: this.rows.length };
    }
  }
}

function makeFakeApi() {
  const api = {
    active: null,
    startCalls: 0,
    endCalls: 0,
    posted: [],
    endDelay: null,
    endSessionError: null,
    async startSession() {
      api.startCalls++;
      if (api.active) throw new ApiError("You already have an active shift.", 400);
      api.active = { id: `s${api.startCalls}`, startedAt: new Date().toISOString() };
      return api.active;
    },
    async endSession() {
      api.endCalls++;
      if (api.endDelay) await api.endDelay.promise;
      if (api.endSessionError) throw api.endSessionError;
      if (!api.active) throw new ApiError("You don't have an active shift to end.", 400);
      const ended = { ...api.active, endedAt: new Date().toISOString(), durationSeconds: 100 };
      api.active = null;
      return { session: ended, summary: { durationSeconds: 100 }, report: { durationSeconds: 100, activityBreakdown: [], tasksCompleted: 1, tasksSubmitted: 0, nextStep: null } };
    },
    async getActiveSession() { return api.active; },
    async postActivity(_token, rows) {
      if (!api.active) throw new ApiError("This shift has ended — no further activity is recorded.", 400);
      api.posted.push(...rows);
      return { created: rows.length, rejected: 0, sessionId: api.active.id };
    },
  };
  return api;
}

function harness({ token = "tok" } = {}) {
  const api = makeFakeApi();
  const outbox = new FakeOutbox();
  const trackers = [];
  const transitions = [];
  const wm = new WorkMode({
    api,
    getToken: () => token,
    createTracker: ({ onBucket }) => { const t = new FakeTracker(onBucket); trackers.push(t); return t; },
    outbox,
    onChange: (snap) => transitions.push(snap.state),
    log: { warn() {}, error() {} },
  });
  return { api, outbox, trackers, transitions, wm, running: () => trackers.filter((t) => t.running) };
}

test("start() → ON with exactly one tracker; a concurrent second start() shares it", async () => {
  const h = harness();
  const [a, b] = await Promise.all([h.wm.start(), h.wm.start()]);
  assert.equal(a.state, STATES.ON);
  assert.equal(b.state, STATES.ON);
  assert.equal(h.api.startCalls, 1);
  assert.equal(h.trackers.length, 1);
  assert.deepEqual(h.transitions, [STATES.STARTING, STATES.ON]);
});

test("start() adopts a shift that already exists on the server (400 'already have an active shift')", async () => {
  const h = harness();
  h.api.active = { id: "web-1", startedAt: new Date().toISOString() };
  const snap = await h.wm.start();
  assert.equal(snap.state, STATES.ON);
  assert.equal(snap.session.id, "web-1");
  assert.equal(h.trackers.length, 1);
});

test("start() failure returns to OFF with no tracker", async () => {
  const h = harness();
  h.api.startSession = async () => { throw new ApiError("Can't reach the InternOps server.", 0, { network: true }); };
  await assert.rejects(() => h.wm.start(), /Can't reach/);
  assert.equal(h.wm.state, STATES.OFF);
  assert.equal(h.trackers.length, 0);
});

test("stop(): sampling stops FIRST, then the outbox is flushed, then the session is ended", async () => {
  const h = harness();
  await h.wm.start();
  const order = [];
  const tracker = h.trackers[0];
  const originalStop = tracker.stop.bind(tracker);
  tracker.stop = () => { order.push("tracker.stop"); originalStop(); };
  const originalFlush = h.outbox.flush.bind(h.outbox);
  h.outbox.flush = async (...args) => { order.push("flush"); return originalFlush(...args); };
  const originalEnd = h.api.endSession;
  h.api.endSession = async (...args) => { order.push("endSession"); return originalEnd(...args); };

  const snap = await h.wm.stop();
  assert.deepEqual(order, ["tracker.stop", "flush", "endSession"]);
  assert.equal(snap.state, STATES.ENDED_PENDING_REPORT);
  assert.equal(snap.report.report.tasksCompleted, 1);
  assert.equal(h.api.posted.length, 1, "the final bucket was flushed before the shift ended");
  assert.equal(h.running().length, 0);
});

test("stop() is idempotent: while OFF it is a no-op, and two concurrent stops end the session once", async () => {
  const h = harness();
  assert.equal((await h.wm.stop()).state, STATES.OFF);
  await h.wm.start();
  const [a, b] = await Promise.all([h.wm.stop(), h.wm.stop()]);
  assert.equal(a.state, STATES.ENDED_PENDING_REPORT);
  assert.equal(b.state, STATES.ENDED_PENDING_REPORT);
  assert.equal(h.api.endCalls, 1);
  assert.equal(h.trackers[0].stops, 1);
});

test("RACE: a reconcile that lands while stop() is awaiting its final flush cannot start an orphan tracker", async () => {
  const h = harness();
  await h.wm.start();
  assert.equal(h.running().length, 1);

  // Hold the flush open — this is exactly the window the old renderer poll
  // used to call startTracking() in.
  h.outbox.delay = deferred();
  const stopping = h.wm.stop();
  await new Promise((r) => setImmediate(r));
  assert.equal(h.wm.state, STATES.STOPPING);
  assert.equal(h.running().length, 0, "sampling is already off while the flush is pending");

  // The server still reports the shift as active at this moment (end has
  // not been called yet). A reconcile tick and a stray start() both arrive.
  assert.ok(h.api.active, "precondition: server still has the shift");
  const reconciling = h.wm.reconcile();
  const straggler = h.wm.start();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(h.trackers.length, 1, "nothing may create a tracker while STOPPING");

  h.outbox.delay.resolve();
  await stopping;
  await reconciling;
  await straggler;

  // After everything settles the server has no active shift (end ran), so
  // the straggler start() legitimately opened a NEW shift — but exactly
  // one tracker is running, belonging to that new shift, and the original
  // one is stopped. No orphan.
  assert.equal(h.api.endCalls, 1);
  assert.equal(h.trackers[0].running, false, "the original tracker stays stopped");
  assert.equal(h.running().length <= 1, true);
  if (h.wm.state === STATES.ON) {
    assert.equal(h.running().length, 1);
    assert.equal(h.running()[0], h.trackers[h.trackers.length - 1]);
  } else {
    assert.equal(h.running().length, 0);
  }
});

test("RACE: reconcile queued behind a slow endSession sees the ended shift and does not re-adopt it", async () => {
  const h = harness();
  await h.wm.start();
  h.api.endDelay = deferred();
  const stopping = h.wm.stop();
  await new Promise((r) => setTimeout(r, 5));
  const reconciling = h.wm.reconcile(); // queued behind stop
  h.api.endDelay.resolve();
  await stopping;
  const snap = await reconciling;
  assert.equal(snap.state, STATES.ENDED_PENDING_REPORT);
  assert.equal(h.trackers.length, 1);
  assert.equal(h.running().length, 0);
});

test("stop() when the server already ended the shift (400) goes OFF with endedReason=server and no report", async () => {
  const h = harness();
  await h.wm.start();
  h.api.active = null; // admin ended it
  const snap = await h.wm.stop();
  assert.equal(snap.state, STATES.OFF);
  assert.equal(snap.endedReason, "server");
  assert.equal(snap.report, null);
  assert.equal(h.running().length, 0);
});

test("stop() on a network failure resumes observing and stays ON (the shift is still open on the server)", async () => {
  const h = harness();
  await h.wm.start();
  h.api.endSessionError = new ApiError("Can't reach the InternOps server.", 0, { network: true });
  await assert.rejects(() => h.wm.stop(), /Can't reach/);
  assert.equal(h.wm.state, STATES.ON);
  assert.equal(h.running().length, 1);
  assert.equal(h.trackers[0].running, false, "the first tracker was stopped");
  assert.equal(h.trackers[1].running, true, "a fresh tracker took over");
  h.api.endSessionError = null;
  const snap = await h.wm.stop();
  assert.equal(snap.state, STATES.ENDED_PENDING_REPORT);
  assert.equal(h.running().length, 0);
});

test("reconcile() adopts a shift started elsewhere and stops when the server ends it", async () => {
  const h = harness();
  assert.equal((await h.wm.reconcile()).state, STATES.OFF);
  h.api.active = { id: "web-2", startedAt: new Date().toISOString() };
  const on = await h.wm.reconcile();
  assert.equal(on.state, STATES.ON);
  assert.equal(on.session.id, "web-2");
  assert.equal(h.running().length, 1);
  h.api.active = null;
  const off = await h.wm.reconcile();
  assert.equal(off.state, STATES.OFF);
  assert.equal(off.endedReason, "server");
  assert.equal(h.running().length, 0);
});

test("reconcile() network errors propagate without changing state", async () => {
  const h = harness();
  await h.wm.start();
  h.api.getActiveSession = async () => { throw new ApiError("offline", 0, { network: true }); };
  await assert.rejects(() => h.wm.reconcile(), /offline/);
  assert.equal(h.wm.state, STATES.ON);
  assert.equal(h.running().length, 1);
});

test("forceOff() (401 / sign-out) stops sampling immediately and never calls the server", async () => {
  const h = harness();
  await h.wm.start();
  const snap = await h.wm.forceOff("session-expired");
  assert.equal(snap.state, STATES.OFF);
  assert.equal(snap.endedReason, "session-expired");
  assert.equal(h.running().length, 0);
  assert.equal(h.api.endCalls, 0);
});

test("pause()/resume() forward to the live tracker and survive a tracker swap", async () => {
  const h = harness();
  h.wm.pause("locked");
  await h.wm.start();
  assert.equal(h.trackers[0].paused, true, "a tracker created while paused starts paused");
  h.wm.resume();
  assert.equal(h.trackers[0].paused, false);
});

test("report lifecycle: markReportSubmitted/dismissReport → OFF; restoreReport brings an unsent one back", async () => {
  const h = harness();
  await h.wm.start();
  const snap = await h.wm.stop();
  assert.equal(snap.state, STATES.ENDED_PENDING_REPORT);
  const report = snap.report;
  h.wm.markReportSubmitted();
  assert.equal(h.wm.state, STATES.OFF);
  h.wm.restoreReport(report);
  assert.equal(h.wm.state, STATES.ENDED_PENDING_REPORT);
  h.wm.dismissReport();
  assert.equal(h.wm.state, STATES.OFF);
});

test("starting a new shift while a report is pending adopts the server's view and keeps the sampler count at one", async () => {
  const h = harness();
  await h.wm.start();
  await h.wm.stop();
  const snap = await h.wm.start();
  assert.equal(snap.state, STATES.ON);
  assert.equal(snap.report, null);
  assert.equal(h.running().length, 1);
});
