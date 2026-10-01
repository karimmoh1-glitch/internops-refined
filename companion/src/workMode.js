// The one owner of Work Mode state in the whole app. The renderer never
// decides anything — it only renders snapshots of this machine.
//
//   OFF ──start()──▶ STARTING ──▶ ON ──stop()──▶ STOPPING ──▶ ENDED_PENDING_REPORT ──dismiss/submit──▶ OFF
//
// Every transition runs under a single async mutex, so a reconcile tick,
// a Start click and an End click can never interleave: the orphaned
// tracker the old renderer-driven poll could create (startTracking() while
// stop-work-mode was awaiting its final flush) is structurally impossible
// here — a tracker exists only while state === ON, and only one at a time.
//
// stop() order is fixed: stop sampling FIRST (synchronously — no further
// OS reads), then flush the outbox, then end the session on the server.
const STATES = Object.freeze({
  OFF: "OFF",
  STARTING: "STARTING",
  ON: "ON",
  STOPPING: "STOPPING",
  ENDED_PENDING_REPORT: "ENDED_PENDING_REPORT",
});

class WorkMode {
  constructor({ api, getToken, createTracker, outbox, onChange = () => {}, log = console }) {
    this.api = api;
    this.getToken = getToken;
    this.createTracker = createTracker; // ({ onBucket }) => tracker with start/stop/pause/resume/running
    this.outbox = outbox;
    this.onChange = onChange;
    this.log = log;
    this.state = STATES.OFF;
    this.session = null; // the server's work session row while ON
    this.report = null; // { sessionId, report, endedAt } while ENDED_PENDING_REPORT
    this.endedReason = null; // "manual" | "server" | "signed-out" | null
    this.lastError = null;
    this.tracker = null;
    this.paused = false;
    this.pauseReason = null;
    this._chain = Promise.resolve();
  }

  // Serialises every transition. Errors propagate to the caller but never
  // break the chain for the next caller.
  _run(fn) {
    const p = this._chain.then(fn, fn);
    this._chain = p.then(() => undefined, () => undefined);
    return p;
  }

  _set(state, patch = {}) {
    this.state = state;
    Object.assign(this, patch);
    try { this.onChange(this.snapshot()); } catch (err) { this.log.error?.("[workMode] onChange failed:", err); }
  }

  snapshot() {
    return {
      state: this.state,
      session: this.session ? { id: this.session.id, startedAt: this.session.startedAt } : null,
      report: this.report,
      endedReason: this.endedReason,
      lastError: this.lastError ? { message: this.lastError.message, status: this.lastError.status ?? null } : null,
      paused: this.paused,
      pauseReason: this.pauseReason,
      trackerRunning: !!(this.tracker && this.tracker.running),
    };
  }

  get isOn() {
    return this.state === STATES.ON;
  }

  get isBusy() {
    return this.state === STATES.STARTING || this.state === STATES.STOPPING;
  }

  _sender() {
    return (rows) => this.api.postActivity(this.getToken(), rows);
  }

  _startTracker() {
    if (this.tracker) this._stopTracker();
    this.tracker = this.createTracker({ onBucket: (row) => this.outbox.enqueue(row) });
    this.tracker.start();
    if (this.paused) this.tracker.pause(this.pauseReason);
  }

  _stopTracker() {
    if (!this.tracker) return;
    const t = this.tracker;
    this.tracker = null;
    t.stop(); // synchronous: timer cleared, in-flight sample discarded, final bucket enqueued
  }

  // Idempotent: a second concurrent call waits for the first and returns
  // the same ON snapshot without a second startSession or tracker.
  start() {
    return this._run(async () => {
      if (this.state === STATES.ON || this.state === STATES.STARTING) return this.snapshot();
      const token = this.getToken();
      if (!token) throw new Error("Not signed in.");
      this._set(STATES.STARTING, { lastError: null, report: null, endedReason: null });
      let session;
      try {
        session = await this.api.startSession(token);
      } catch (err) {
        if (err && err.status === 400 && /already have an active shift/i.test(err.message || "")) {
          // Started elsewhere (web app, another launch) — adopt it.
          try {
            session = await this.api.getActiveSession(token);
          } catch (inner) {
            this._set(STATES.OFF, { lastError: inner });
            throw inner;
          }
        } else {
          this._set(STATES.OFF, { lastError: err });
          throw err;
        }
      }
      if (!session) {
        const err = new Error("The server didn't return an active shift.");
        this._set(STATES.OFF, { lastError: err });
        throw err;
      }
      this.session = session;
      this._startTracker();
      this._set(STATES.ON);
      return this.snapshot();
    });
  }

  // Idempotent: calling stop() while OFF is a no-op; while ON it is the
  // only path that ends the shift. Sampling stops before anything else.
  stop() {
    return this._run(async () => {
      if (this.state !== STATES.ON) return this.snapshot();
      const token = this.getToken();
      this._set(STATES.STOPPING, { lastError: null });
      this._stopTracker();
      try {
        await this.outbox.flush(this._sender(), { force: true });
      } catch (err) {
        this.log.warn?.("[workMode] final flush failed; rows stay queued:", err?.message);
      }
      let result;
      try {
        result = await this.api.endSession(token);
      } catch (err) {
        if (err && err.status === 400) {
          // "You don't have an active shift to end" — the server already
          // ended it (admin, max-shift cutoff, other device). Nothing to report.
          this._set(STATES.OFF, { session: null, endedReason: "server", lastError: err });
          return this.snapshot();
        }
        // Network/5xx: the shift is still active on the server and we are
        // still signed in, so resume observing rather than pretend it ended.
        this._startTracker();
        this._set(STATES.ON, { lastError: err });
        throw err;
      }
      const endedSession = result?.session || this.session;
      this._set(STATES.ENDED_PENDING_REPORT, {
        session: null,
        endedReason: "manual",
        report: {
          sessionId: endedSession?.id ?? this.session?.id ?? null,
          endedAt: endedSession?.endedAt ?? new Date().toISOString(),
          startedAt: endedSession?.startedAt ?? this.session?.startedAt ?? null,
          report: result?.report ?? null,
          summary: result?.summary ?? null,
          submitted: false,
        },
      });
      return this.snapshot();
    });
  }

  // Brings local state in line with the server. Called on a timer from the
  // main process (never from the renderer). Network errors propagate so the
  // caller can show "Reconnecting…"; they never change local state.
  reconcile() {
    return this._run(async () => {
      if (this.isBusy) return this.snapshot();
      const token = this.getToken();
      if (!token) {
        if (this.state === STATES.ON) this._stopTracker();
        if (this.state !== STATES.OFF) this._set(STATES.OFF, { session: null, endedReason: "signed-out" });
        return this.snapshot();
      }
      const active = await this.api.getActiveSession(token);
      if (active && this.state !== STATES.ON) {
        // A shift is running on the server (started on the web, or we
        // restarted mid-shift). Adopt it — keep any unsent report around.
        this.session = active;
        this._startTracker();
        this._set(STATES.ON, { endedReason: null });
      } else if (!active && this.state === STATES.ON) {
        this._stopTracker();
        this._set(STATES.OFF, { session: null, endedReason: "server" });
        // Whatever is queued belongs to a shift that is over; the server
        // answers 400 and the outbox drops it with a logged reason.
        this.outbox.flush(this._sender(), { force: true }).catch(() => {});
      } else if (active && this.state === STATES.ON && active.id !== this.session?.id) {
        this.session = active;
        this._set(STATES.ON);
      }
      return this.snapshot();
    });
  }

  // Session gone (401) or sign-out: stop observing immediately. Does not
  // touch the server.
  forceOff(reason = "signed-out") {
    return this._run(async () => {
      this._stopTracker();
      this._set(STATES.OFF, { session: null, endedReason: reason, report: null });
      return this.snapshot();
    });
  }

  flush({ force = false } = {}) {
    if (!this.getToken()) return Promise.resolve({ sent: 0, dropped: 0, rejected: 0, skipped: true, remaining: this.outbox.size });
    return this.outbox.flush(this._sender(), { force });
  }

  pause(reason) {
    this.paused = true;
    this.pauseReason = reason;
    this.tracker?.pause(reason);
    this.onChange(this.snapshot());
  }

  resume() {
    this.paused = false;
    this.pauseReason = null;
    this.tracker?.resume();
    this.onChange(this.snapshot());
  }

  markReportSubmitted() {
    if (this.state === STATES.ENDED_PENDING_REPORT) {
      this._set(STATES.OFF, { report: null });
    }
  }

  dismissReport() {
    if (this.state === STATES.ENDED_PENDING_REPORT) {
      this._set(STATES.OFF, { report: null });
    }
  }

  // Restore an unsent report after a restart (main persists it).
  restoreReport(report) {
    if (this.state === STATES.OFF && report && report.sessionId) {
      this._set(STATES.ENDED_PENDING_REPORT, { report });
    }
  }
}

module.exports = { WorkMode, STATES };
