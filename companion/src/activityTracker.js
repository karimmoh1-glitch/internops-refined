// Real OS-level activity sampling — macOS only for v1. Reads the name of
// the frontmost application via AppleScript/System Events, which needs no
// special permission for the app name alone (unlike window titles or
// screen content, which we deliberately never touch). Samples are
// aggregated client-side into per-application duration buckets and only
// the aggregate is ever sent to the server — never a raw event stream.
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function getFrontmostApplication() {
  try {
    const { stdout } = await execAsync(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { timeout: 5000 }
    );
    return stdout.trim() || null;
  } catch {
    // Permission not yet granted, or a transient AppleScript failure —
    // fail closed (no sample) rather than guessing.
    return null;
  }
}

class ActivityTracker {
  constructor({ sampleIntervalMs, onFlush, flushIntervalMs }) {
    this.sampleIntervalMs = sampleIntervalMs;
    this.flushIntervalMs = flushIntervalMs;
    this.onFlush = onFlush;
    this.timer = null;
    this.flushTimer = null;
    this.current = null; // { application, startedAt }
    this.buckets = []; // completed { application, startedAt, endedAt, durationSeconds }
  }

  start() {
    this.stop();
    this.timer = setInterval(() => this._sample(), this.sampleIntervalMs);
    this.flushTimer = setInterval(() => this._flush(), this.flushIntervalMs);
    this._sample();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.timer = null;
    this.flushTimer = null;
    this._closeCurrent();
  }

  async _sample() {
    const app = await getFrontmostApplication();
    if (!app) return;
    if (this.current && this.current.application === app) return; // still on the same app
    this._closeCurrent();
    this.current = { application: app, startedAt: new Date() };
  }

  _closeCurrent() {
    if (!this.current) return;
    const endedAt = new Date();
    const durationSeconds = Math.round((endedAt.getTime() - this.current.startedAt.getTime()) / 1000);
    if (durationSeconds >= 5) {
      this.buckets.push({
        application: this.current.application,
        startedAt: this.current.startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationSeconds,
      });
    }
    this.current = null;
  }

  async _flush() {
    this._closeCurrent();
    if (this.buckets.length === 0) return;
    const toSend = this.buckets;
    this.buckets = [];
    try {
      await this.onFlush(toSend);
    } catch {
      // Best-effort — put unsent samples back so the next flush retries.
      this.buckets = toSend.concat(this.buckets);
    }
  }

  // Flush immediately (e.g. when Work Mode is stopped) rather than waiting
  // for the next interval.
  async flushNow() {
    this._closeCurrent();
    await this._flush();
  }
}

module.exports = { ActivityTracker, getFrontmostApplication };
