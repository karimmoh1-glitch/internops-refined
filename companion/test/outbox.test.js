// Persistent outbox: survives a restart, chunks to the server cap, backs
// off exponentially on network/5xx, drops permanently on 4xx with a logged
// reason, and surfaces `rejected` counts.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { Outbox } = require("../src/outbox");
const { ApiError } = require("../src/api");

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "internops-outbox-"));
  return path.join(dir, "outbox.jsonl");
}
function row(i) {
  return { application: "VS Code", startedAt: new Date(i * 1000).toISOString(), endedAt: new Date(i * 1000 + 10_000).toISOString(), durationSeconds: 10 };
}
function logger() {
  const lines = [];
  return { lines, warn: (m) => lines.push(m), error: (m) => lines.push(m) };
}

test("enqueue persists to disk and a new Outbox on the same file loads the rows back", () => {
  const file = tmpFile();
  const a = new Outbox({ filePath: file });
  a.enqueue(row(1));
  a.enqueue([row(2), row(3)]);
  assert.equal(a.size, 3);
  const lines = fs.readFileSync(file, "utf8").trim().split("\n");
  assert.equal(lines.length, 3);
  const b = new Outbox({ filePath: file });
  assert.equal(b.size, 3);
  assert.equal(b.rows[2].startedAt, row(3).startedAt);
});

test("a corrupt line is skipped and the file is rewritten clean", () => {
  const file = tmpFile();
  fs.writeFileSync(file, JSON.stringify(row(1)) + "\n{not json\n" + JSON.stringify(row(2)) + "\n");
  const log = logger();
  const ob = new Outbox({ filePath: file, log });
  assert.equal(ob.size, 2);
  assert.ok(log.lines.some((l) => /unreadable/.test(l)));
  assert.equal(fs.readFileSync(file, "utf8").trim().split("\n").length, 2);
});

test("flush sends rows in chunks of at most maxRowsPerRequest and empties the file on success", async () => {
  const file = tmpFile();
  const ob = new Outbox({ filePath: file, maxRowsPerRequest: 200 });
  ob.enqueue(Array.from({ length: 450 }, (_, i) => row(i)));
  const sizes = [];
  const result = await ob.flush(async (rows) => { sizes.push(rows.length); return { created: rows.length, rejected: 0 }; });
  assert.deepEqual(sizes, [200, 200, 50]);
  assert.equal(result.sent, 450);
  assert.equal(ob.size, 0);
  assert.equal(fs.readFileSync(file, "utf8"), "");
});

test("network failure keeps the rows, sets exponential backoff, and skips flushes until it elapses", async () => {
  const file = tmpFile();
  let now = 1_000_000;
  const log = logger();
  const ob = new Outbox({ filePath: file, baseBackoffMs: 1000, maxBackoffMs: 8000, now: () => now, log });
  ob.enqueue([row(1), row(2)]);
  const fail = async () => { throw new ApiError("Can't reach the InternOps server.", 0, { network: true }); };

  let r = await ob.flush(fail);
  assert.equal(r.failed, true);
  assert.equal(ob.size, 2, "rows kept");
  assert.equal(ob.backoffMs, 1000);
  assert.equal(ob.nextAttemptAt, now + 1000);

  r = await ob.flush(fail); // too soon
  assert.equal(r.skipped, true);
  assert.equal(ob.failures, 1);

  now += 1000;
  await ob.flush(fail);
  assert.equal(ob.backoffMs, 2000);
  now += 2000;
  await ob.flush(fail);
  assert.equal(ob.backoffMs, 4000);
  now += 4000;
  await ob.flush(fail);
  assert.equal(ob.backoffMs, 8000);
  now += 8000;
  await ob.flush(fail);
  assert.equal(ob.backoffMs, 8000, "capped at maxBackoffMs");

  // force ignores backoff; success resets it.
  let sent = 0;
  r = await ob.flush(async (rows) => { sent += rows.length; return { created: rows.length, rejected: 0 }; }, { force: true });
  assert.equal(sent, 2);
  assert.equal(ob.failures, 0);
  assert.equal(ob.backoffMs, 0);
  assert.equal(ob.size, 0);
  assert.ok(log.lines.some((l) => /retrying in/.test(l)));
});

test("5xx is treated like a network failure (retry later)", async () => {
  const ob = new Outbox({ filePath: tmpFile(), log: logger() });
  ob.enqueue(row(1));
  const r = await ob.flush(async () => { throw new ApiError("Failed to record work activity", 500); });
  assert.equal(r.failed, true);
  assert.equal(ob.size, 1);
});

test("429 and 408 are retried, not dropped", async () => {
  const ob = new Outbox({ filePath: tmpFile(), log: logger() });
  ob.enqueue(row(1));
  await ob.flush(async () => { throw new ApiError("Too many activity submissions.", 429); });
  assert.equal(ob.size, 1);
  await ob.flush(async () => { throw new ApiError("timeout", 408); }, { force: true });
  assert.equal(ob.size, 1);
});

test("a permanent 4xx drops the chunk, logs why, and keeps draining the rest", async () => {
  const file = tmpFile();
  const log = logger();
  const ob = new Outbox({ filePath: file, maxRowsPerRequest: 2, log });
  ob.enqueue([row(1), row(2), row(3)]);
  let call = 0;
  const r = await ob.flush(async (rows) => {
    call++;
    if (call === 1) throw new ApiError("This shift has ended — no further activity is recorded.", 400);
    return { created: rows.length, rejected: 0 };
  });
  assert.equal(r.dropped, 2);
  assert.equal(r.sent, 1);
  assert.equal(ob.size, 0);
  assert.equal(ob.failures, 0, "a drop is not a failure — no backoff");
  assert.ok(log.lines.some((l) => /dropping 2 row/.test(l) && /This shift has ended/.test(l)));
  assert.equal(fs.readFileSync(file, "utf8"), "");
});

test("`rejected` in a successful response is surfaced and logged, and the rows are not retried", async () => {
  const log = logger();
  const ob = new Outbox({ filePath: tmpFile(), log });
  ob.enqueue([row(1), row(2), row(3)]);
  const r = await ob.flush(async () => ({ created: 2, rejected: 1 }));
  assert.equal(r.sent, 2);
  assert.equal(r.rejected, 1);
  assert.equal(ob.size, 0);
  assert.ok(log.lines.some((l) => /rejected 1 row/.test(l)));
});

test("concurrent flush() calls share one drain", async () => {
  const ob = new Outbox({ filePath: tmpFile() });
  ob.enqueue([row(1)]);
  let calls = 0;
  const sender = async (rows) => { calls++; await new Promise((r) => setTimeout(r, 10)); return { created: rows.length, rejected: 0 }; };
  const [a, b] = await Promise.all([ob.flush(sender), ob.flush(sender)]);
  assert.equal(calls, 1);
  assert.equal(a, b);
});

test("clear() empties memory and disk", () => {
  const file = tmpFile();
  const ob = new Outbox({ filePath: file });
  ob.enqueue([row(1), row(2)]);
  ob.clear();
  assert.equal(ob.size, 0);
  assert.equal(fs.readFileSync(file, "utf8"), "");
});
