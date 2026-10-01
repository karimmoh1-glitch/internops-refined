// The sampler's hard OFF/ON boundary, idle bucket splitting, and lock/sleep
// pausing. Uses a fake clock and drives _sample() directly where timing
// matters, so the suite is deterministic and fast.
const test = require("node:test");
const assert = require("node:assert/strict");
const { ActivityTracker } = require("../src/activityTracker");

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

function makeTracker(opts = {}) {
  const buckets = [];
  let clock = 1_000_000;
  const tracker = new ActivityTracker({
    sampleIntervalMs: 10_000,
    minBucketSeconds: 0,
    idleThresholdSeconds: 300,
    maxBucketSeconds: 3600,
    getContext: async () => makeContext(),
    onBucket: (row) => buckets.push(row),
    now: () => clock,
    ...opts,
  });
  return { tracker, buckets, advance: (ms) => { clock += ms; }, clock: () => clock };
}

test("start() turns collection on; stop() turns it off and no sample fires afterwards", async () => {
  let calls = 0;
  const buckets = [];
  const tracker = new ActivityTracker({
    sampleIntervalMs: 10,
    minBucketSeconds: 0,
    getContext: async () => { calls++; return makeContext(); },
    onBucket: (row) => buckets.push(row),
  });
  assert.equal(tracker.running, false);
  tracker.start();
  assert.equal(tracker.running, true);
  await sleep(60);
  assert.ok(calls >= 2, "expected multiple samples while running");
  assert.ok(tracker.current, "expected an open bucket");

  tracker.stop();
  assert.equal(tracker.running, false);
  assert.equal(tracker.current, null, "stop() closes the open bucket");
  const callsAtStop = calls;
  await sleep(50);
  assert.equal(calls, callsAtStop, "no sample fires after stop()");
});

test("start() is idempotent — a second call does not create a second timer", async () => {
  let calls = 0;
  const tracker = new ActivityTracker({
    sampleIntervalMs: 10,
    minBucketSeconds: 0,
    getContext: async () => { calls++; return makeContext(); },
    onBucket: () => {},
  });
  tracker.start();
  const gen = tracker.generation;
  tracker.start();
  assert.equal(tracker.generation, gen);
  await sleep(45);
  tracker.stop();
  assert.ok(calls <= 6, `expected one timer's worth of samples, got ${calls}`);
});

test("a sample already in flight when stop() is called cannot mutate state afterward", async () => {
  let release;
  const slow = new Promise((resolve) => { release = resolve; });
  const buckets = [];
  const tracker = new ActivityTracker({
    sampleIntervalMs: 5,
    minBucketSeconds: 0,
    getContext: async () => slow,
    onBucket: (row) => buckets.push(row),
  });
  tracker.start();
  await sleep(15);
  tracker.stop();
  release(makeContext({ application: "Chrome" }));
  await sleep(15);
  assert.equal(tracker.current, null, "a late sample must not open a bucket after stop()");
  assert.equal(buckets.length, 0);
});

test("a context change closes one bucket and opens another; durations match the timestamps (±2s server rule)", async () => {
  let doc = "auth.ts";
  const { tracker, buckets, advance } = makeTracker({ getContext: async () => makeContext({ documentName: doc }) });
  tracker.running = true; // drive _sample directly
  await tracker._sample(tracker.generation);
  advance(30_000);
  await tracker._sample(tracker.generation); // same bucket
  doc = "routes.ts";
  advance(15_000);
  await tracker._sample(tracker.generation); // change → close auth.ts (45s)
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].documentName, "auth.ts");
  assert.equal(buckets[0].durationSeconds, 45);
  const span = (new Date(buckets[0].endedAt) - new Date(buckets[0].startedAt)) / 1000;
  assert.ok(Math.abs(span - buckets[0].durationSeconds) <= 2);
  assert.equal(tracker.current.context.documentName, "routes.ts");
  tracker.stop();
  assert.equal(buckets.length, 2);
  assert.equal(buckets[1].documentName, "routes.ts");
});

test("idle ≥ 300s closes the active bucket; subsequent samples form a separate bucket with the real idle reading and the real app", async () => {
  let idle = 0;
  const { tracker, buckets, advance } = makeTracker({ getContext: async () => makeContext({ idleSeconds: idle }) });
  tracker.running = true;
  await tracker._sample(tracker.generation); // active, t=0
  advance(60_000);
  idle = 120;
  await tracker._sample(tracker.generation); // still active (<300)
  advance(60_000);
  idle = 300;
  await tracker._sample(tracker.generation); // crosses threshold → split
  assert.equal(buckets.length, 1, "the active span closes when idle crosses the threshold");
  assert.equal(buckets[0].durationSeconds, 120);
  assert.equal(buckets[0].idleSeconds, 120, "the closed active bucket keeps its last (sub-threshold) idle reading");
  assert.ok(tracker.current.idle, "a new idle-flagged bucket is open");
  assert.equal(tracker.current.context.application, "VS Code", "no invented 'idle' app — the real one stays");

  advance(300_000);
  idle = 600;
  await tracker._sample(tracker.generation); // still idle → same bucket, reading updated
  assert.equal(buckets.length, 1);

  advance(15_000);
  idle = 2;
  await tracker._sample(tracker.generation); // user is back → idle bucket closes
  assert.equal(buckets.length, 2);
  assert.equal(buckets[1].application, "VS Code");
  assert.equal(buckets[1].idleSeconds, 600, "the idle bucket carries its last idle reading");
  assert.equal(buckets[1].durationSeconds, 315);
  assert.ok(!tracker.current.idle);
  tracker.stop();
});

test("pause() closes the open bucket and makes samples no-ops; resume() opens a fresh bucket (locked time never counted)", async () => {
  let calls = 0;
  const { tracker, buckets, advance } = makeTracker({ getContext: async () => { calls++; return makeContext(); } });
  tracker.start(); // immediate sample
  await sleep(5);
  assert.ok(tracker.current);
  advance(20_000);
  tracker.pause("locked");
  assert.equal(buckets.length, 1, "pre-lock span is recorded with what was observed");
  assert.equal(buckets[0].durationSeconds, 20);
  assert.equal(tracker.current, null);
  assert.equal(tracker.running, true, "pausing is not stopping — Work Mode stays on");

  const callsAtPause = calls;
  advance(3_600_000); // an hour locked
  await tracker._sample(tracker.generation);
  assert.equal(calls, callsAtPause, "no OS query while paused");
  assert.equal(tracker.current, null, "nothing opened while paused");

  tracker.resume();
  await sleep(5);
  assert.ok(tracker.current, "a fresh bucket opens on resume");
  assert.equal(tracker.current.startedAt, 1_000_000 + 20_000 + 3_600_000, "the new bucket starts now, not before the lock");
  tracker.stop();
  assert.equal(buckets.length, 2);
  assert.equal(buckets[1].durationSeconds, 0);
});

test("a sample that resolves after pause() is discarded", async () => {
  let release;
  const { tracker, buckets } = makeTracker({ getContext: () => new Promise((r) => { release = r; }) });
  tracker.start();
  await sleep(5);
  tracker.pause("sleep");
  release(makeContext());
  await sleep(5);
  assert.equal(tracker.current, null);
  assert.equal(buckets.length, 0);
  tracker.stop();
});

test("a failed observation closes the open bucket rather than extending it on a guess, and warns after 3 failures", async () => {
  let ok = true;
  let warned = 0;
  const samples = [];
  const { tracker, buckets, advance } = makeTracker({
    getContext: async () => (ok ? makeContext() : { application: null, idleSeconds: 0 }),
    onPermissionIssue: () => { warned++; },
    onSample: (ctx) => samples.push(ctx),
  });
  tracker.running = true;
  await tracker._sample(tracker.generation);
  advance(10_000);
  ok = false;
  await tracker._sample(tracker.generation);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].durationSeconds, 10);
  await tracker._sample(tracker.generation);
  await tracker._sample(tracker.generation);
  assert.equal(warned, 1);
  assert.equal(samples.filter((s) => s === null).length, 3);
  ok = true;
  await tracker._sample(tracker.generation);
  assert.equal(tracker.consecutiveFailures, 0);
  assert.equal(tracker.warned, false, "a successful sample re-arms the warning");
  tracker.stop();
});

test("a bucket longer than maxBucketSeconds is split so no row approaches the server's 6h cap", async () => {
  const { tracker, buckets, advance } = makeTracker({ maxBucketSeconds: 3600 });
  tracker.running = true;
  await tracker._sample(tracker.generation);
  advance(3_600_000);
  await tracker._sample(tracker.generation);
  assert.equal(buckets.length, 1);
  assert.equal(buckets[0].durationSeconds, 3600);
  assert.ok(tracker.current);
  tracker.stop();
});

test("buckets shorter than minBucketSeconds are dropped as blips", async () => {
  const { tracker, buckets, advance } = makeTracker({ minBucketSeconds: 5 });
  tracker.running = true;
  await tracker._sample(tracker.generation);
  advance(2_000);
  tracker.stop();
  assert.equal(buckets.length, 0);
});
