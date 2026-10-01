// Persistent outbox for closed activity buckets. Rows are appended to a
// JSON-lines file the moment a bucket closes, so a crash, a quit, or an
// offline stretch never loses what was already observed. flush() drains
// the file in chunks of at most `maxRowsPerRequest` rows:
//   - success          → rows removed; `rejected` from the server is logged
//   - network / 5xx    → rows kept; exponential backoff before the next try
//   - permanent 4xx    → rows dropped and the reason logged (the server has
//                        said "no" to this exact payload; e.g. "This shift
//                        has ended" — retrying can never succeed)
// Pure Node (fs only) so it is testable without Electron.
const fs = require("fs");
const path = require("path");

class Outbox {
  constructor({ filePath, maxRowsPerRequest = 200, baseBackoffMs = 5_000, maxBackoffMs = 5 * 60_000, now = () => Date.now(), log = console } = {}) {
    if (!filePath) throw new Error("Outbox needs a filePath");
    this.filePath = filePath;
    this.maxRowsPerRequest = maxRowsPerRequest;
    this.baseBackoffMs = baseBackoffMs;
    this.maxBackoffMs = maxBackoffMs;
    this.now = now;
    this.log = log;
    this.rows = [];
    this.failures = 0; // consecutive failed flush attempts
    this.nextAttemptAt = 0;
    this.lastError = null;
    this.lastSuccessAt = null;
    this._inflight = null;
    this._load();
  }

  get size() {
    return this.rows.length;
  }

  get backoffMs() {
    if (this.failures === 0) return 0;
    return Math.min(this.maxBackoffMs, this.baseBackoffMs * 2 ** (this.failures - 1));
  }

  _load() {
    let text;
    try {
      text = fs.readFileSync(this.filePath, "utf8");
    } catch {
      return; // no outbox yet
    }
    let corrupt = 0;
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const row = JSON.parse(trimmed);
        if (row && typeof row === "object" && row.application) this.rows.push(row);
        else corrupt++;
      } catch {
        corrupt++;
      }
    }
    if (corrupt > 0) {
      this.log.warn?.(`[outbox] skipped ${corrupt} unreadable line(s) in ${path.basename(this.filePath)}`);
      this._rewrite();
    }
  }

  _rewrite() {
    const tmp = `${this.filePath}.tmp`;
    const text = this.rows.map((r) => JSON.stringify(r)).join("\n") + (this.rows.length ? "\n" : "");
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(tmp, text);
      fs.renameSync(tmp, this.filePath);
    } catch (err) {
      this.log.error?.("[outbox] could not persist outbox:", err);
    }
  }

  enqueue(rows) {
    const list = Array.isArray(rows) ? rows : [rows];
    if (list.length === 0) return;
    this.rows.push(...list);
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.appendFileSync(this.filePath, list.map((r) => JSON.stringify(r)).join("\n") + "\n");
    } catch (err) {
      this.log.error?.("[outbox] could not append to outbox:", err);
    }
  }

  clear() {
    this.rows = [];
    this.failures = 0;
    this.nextAttemptAt = 0;
    this._rewrite();
  }

  // Drains the outbox through `sender(rows) => Promise<{created, rejected}>`.
  // Concurrent calls share one in-flight drain. `force` ignores backoff —
  // used on End Shift / quit / wake, where a fresh attempt is always worth
  // one round trip.
  flush(sender, { force = false } = {}) {
    if (this._inflight) return this._inflight;
    if (!force && this.now() < this.nextAttemptAt) {
      return Promise.resolve({ sent: 0, dropped: 0, rejected: 0, skipped: true, remaining: this.rows.length });
    }
    this._inflight = this._drain(sender).finally(() => { this._inflight = null; });
    return this._inflight;
  }

  async _drain(sender) {
    const result = { sent: 0, dropped: 0, rejected: 0, skipped: false, failed: false, remaining: 0 };
    while (this.rows.length > 0) {
      const chunk = this.rows.slice(0, this.maxRowsPerRequest);
      let response;
      try {
        response = await sender(chunk);
      } catch (err) {
        if (err && err.permanent) {
          this.log.warn?.(`[outbox] dropping ${chunk.length} row(s) — server rejected them (${err.status}): ${err.message}`);
          this.rows.splice(0, chunk.length);
          result.dropped += chunk.length;
          this._rewrite();
          continue;
        }
        this.failures++;
        this.nextAttemptAt = this.now() + this.backoffMs;
        this.lastError = err;
        result.failed = true;
        this.log.warn?.(`[outbox] flush failed (${err?.status || "network"}): ${err?.message}; retrying in ${Math.round(this.backoffMs / 1000)}s with ${this.rows.length} row(s) queued`);
        break;
      }
      this.rows.splice(0, chunk.length);
      this._rewrite();
      this.failures = 0;
      this.nextAttemptAt = 0;
      this.lastError = null;
      this.lastSuccessAt = this.now();
      const created = Number(response?.created ?? chunk.length);
      const rejected = Number(response?.rejected ?? 0);
      result.sent += created;
      result.rejected += rejected;
      if (rejected > 0) {
        this.log.warn?.(`[outbox] server accepted ${created} and rejected ${rejected} row(s) in this chunk (outside the shift window, malformed, or duration/timestamp mismatch)`);
      }
    }
    result.remaining = this.rows.length;
    return result;
  }
}

module.exports = { Outbox };
