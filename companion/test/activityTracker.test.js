// Proves the hard OFF_WORK / WORK_MODE boundary from the Companion spec:
// start → collection on, stop → collection off with no delayed restarts,
// and a sample that was already in flight when stop() was called must not
// leak state after stop. Uses a mock getContext (no real OS calls) with
// short intervals so the whole suite runs in well under a second.
const test = require("node:test");
const assert = require("node:assert/strict");
const { ActivityTracker } = require("../src/activityTracker");
const { reconcileTrackingState } = require("../src/reconcile");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeContext(overrides = {}) {
  return {
    application: "VS Code",
    windowTitle: "auth.ts — internops",
    documentName: "auth.ts",
    browserDomain: null,
    idleSeconds: 0,
    platform: "macos",
    contextSource: "applescript",
    ...overrides,
  };
}

test("START turns collection ON — samples are taken and a bucket opens", async () => {
  let calls = 0;
  const tracker = new ActivityTracker({
    sampleIntervalMs: 15,
    flushIntervalMs: 10_000,
    minBucketSeconds: 0,
    onFlush: async () => {},
    getContext: async () => { calls++; return makeContext(); },
  });

  assert.equal(tracker.running, false);
  tracker.start();
  assert.equal(tracker.running, true);
  await sleep(120);

  assert.ok(calls >= 2, "expected multiple samples while running");
  assert.ok(tracker.current, "expected an open bucket while an app is in the foreground");
  tracker.stop();
});

test("END turns collection OFF — no new samples, no new buckets", async () => {
  let calls = 0;
  const tracker = new ActivityTracker({
    sampleIntervalMs: 15,
    flushIntervalMs: 10_000,
    minBucketSeconds: 0,
    onFlush: async () => {},
    getContext: async () => { calls++; return makeContext(); },
  });

  tracker.start();
  await sleep(40);
  tracker.stop();
  assert.equal(tracker.running, false);
  assert.equal(tracker.current, null, "stop() must close out any open bucket");

  const callsAtStop = calls;
  await sleep(80); // well past several would-be sample intervals
  assert.equal(calls, callsAtStop, "no sample should ever fire after stop()");
});

test("END produces no delayed collector restart via the flush timer", async () => {
  const flushedBatches = [];
  const tracker = new ActivityTracker({
    sampleIntervalMs: 15,
    flushIntervalMs: 20,
    minBucketSeconds: 0,
    onFlush: async (batch) => { flushedBatches.push(batch); },
    getContext: async () => makeContext(),
  });

  tracker.start();
  await sleep(40);
  tracker.stop();
  const batchesAtStop = flushedBatches.length;

  await sleep(100); // several flush intervals' worth of time
  assert.equal(flushedBatches.length, batchesAtStop, "no flush (and so no send) should occur after stop()");
});

test("a sample already in flight when stop() is called cannot mutate state afterward", async () => {
  let releaseSample;
  const slowContext = new Promise((resolve) => { releaseSample = resolve; });
  const tracker = new ActivityTracker({
    sampleIntervalMs: 5,
    flushIntervalMs: 10_000,
    minBucketSeconds: 0,
    onFlush: async () => {},
    // First call hangs until we release it (simulating a slow OS query);
    // that's the one that will still be "in flight" when stop() runs.
    getContext: async () => slowContext,
  });

  tracker.start();
  await sleep(20); // give the interval a chance to fire the slow sample at least once
  tracker.stop();
  assert.equal(tracker.current, null);

  // Now let the slow OS call finally resolve, *after* stop() already ran.
  releaseSample(makeContext({ application: "Chrome" }));
  await sleep(20);

  assert.equal(tracker.current, null, "a late-resolving sample must not open a bucket after stop()");
  assert.equal(tracker.buckets.length, 0, "a late-resolving sample must not queue a bucket for upload after stop()");
});

test("APP RESTART while OFF_WORK stays OFF (reconcile: no active session, not locally tracking)", () => {
  assert.equal(reconcileTrackingState(false, false), "none");
});

test("APP RESTART during WORK_MODE reconnects without violating the boundary (reconcile: active session, not yet locally tracking)", () => {
  assert.equal(reconcileTrackingState(true, false), "start");
});

test("a server-invalidated session while still locally tracking triggers a stop", () => {
  assert.equal(reconcileTrackingState(false, true), "stop");
});

test("already in sync (tracking with an active session) takes no action", () => {
  assert.equal(reconcileTrackingState(true, true), "none");
});

test("flushNow() sends the final open bucket, then stop() sends nothing further", async () => {
  const flushedBatches = [];
  const tracker = new ActivityTracker({
    sampleIntervalMs: 15,
    flushIntervalMs: 10_000, // long enough that only flushNow() triggers a send in this test
    minBucketSeconds: 0,
    onFlush: async (batch) => { flushedBatches.push(batch); },
    getContext: async () => makeContext(),
  });

  tracker.start();
  await sleep(30);
  await tracker.flushNow();
  assert.equal(flushedBatches.length, 1);
  assert.ok(flushedBatches[0].length >= 1);

  tracker.stop();
  await sleep(50);
  assert.equal(flushedBatches.length, 1, "stop() itself must never flush");
});

test("a context change (different document, same app) closes one bucket and opens another", async () => {
  // Interval-driven timing is inherently racy in a unit test, so this
  // drives _sample() directly (same method the interval calls) instead of
  // depending on wall-clock timing to land a specific number of ticks.
  let currentDocument = "auth.ts";
  const tracker = new ActivityTracker({
    sampleIntervalMs: 10_000, // long enough that the real interval never fires during this test
    flushIntervalMs: 10_000,
    minBucketSeconds: 0,
    onFlush: async () => {},
    getContext: async () => makeContext({ documentName: currentDocument }),
  });

  tracker.start(); // fires one immediate sample (auth.ts)
  await sleep(5);
  await tracker._sample(tracker.generation); // still auth.ts — same bucket, no new entry

  currentDocument = "routes.ts";
  await tracker._sample(tracker.generation); // context changed — closes auth.ts, opens routes.ts

  assert.equal(tracker.buckets.length, 1);
  assert.equal(tracker.buckets[0].documentName, "auth.ts");
  assert.equal(tracker.current.context.documentName, "routes.ts");

  tracker.stop();
  assert.equal(tracker.buckets.length, 2);
  assert.equal(tracker.buckets[1].documentName, "routes.ts");
});

test("breakSegment() closes the open bucket without stopping the tracker (sleep/lock boundary)", async () => {
  const tracker = new ActivityTracker({
    sampleIntervalMs: 10_000,
    flushIntervalMs: 10_000,
    minBucketSeconds: 0,
    onFlush: async () => {},
    getContext: async () => makeContext(),
  });

  tracker.start();
  await sleep(5);
  assert.ok(tracker.current, "expected an open bucket before the break");

  tracker.breakSegment();
  assert.equal(tracker.buckets.length, 1, "the pre-sleep bucket should be closed out, not discarded");
  assert.equal(tracker.current, null, "no bucket should span the sleep/lock gap");
  assert.equal(tracker.running, true, "breakSegment() must not stop the tracker itself — Work Mode is still on");

  // The next sample after waking opens a fresh bucket, not a continuation
  // of the pre-sleep one — proving the sleep gap can never be silently
  // absorbed into a bucket's reported duration.
  await tracker._sample(tracker.generation);
  assert.ok(tracker.current, "a new bucket should open on the next sample after the break");

  tracker.stop();
});
