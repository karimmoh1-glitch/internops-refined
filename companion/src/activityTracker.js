// Real OS-level activity sampling. Reads only the name of the frontmost
// application — on macOS via AppleScript/System Events, on Windows via a
// small Win32 foreground-window lookup through PowerShell. Neither needs
// special permission for the app name alone (unlike window titles or
// screen content, which we deliberately never touch). Samples are
// aggregated client-side into per-application duration buckets and only
// the aggregate is ever sent to the server — never a raw event stream.
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

const WIN_FOREGROUND_APP_SCRIPT = `
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class InternOpsForeground {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
'@
$hwnd = [InternOpsForeground]::GetForegroundWindow()
$procId = 0
[InternOpsForeground]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
(Get-Process -Id $procId).ProcessName
`.trim();

async function getFrontmostApplication() {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${WIN_FOREGROUND_APP_SCRIPT.replace(/"/g, '\\"')}"`,
        { timeout: 5000 }
      );
      return stdout.trim() || null;
    }
    const { stdout } = await execAsync(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { timeout: 5000 }
    );
    return stdout.trim() || null;
  } catch {
    // Permission not yet granted, unsupported platform, or a transient
    // failure — fail closed (no sample) rather than guessing.
    return null;
  }
}

// Consecutive failed samples before we tell the intern something's wrong —
// high enough to ride out one transient AppleScript hiccup, low enough
// that a real permission problem is surfaced well within the first minute
// rather than silently costing them the whole shift.
const PERMISSION_WARNING_THRESHOLD = 3;

class ActivityTracker {
  constructor({ sampleIntervalMs, onFlush, flushIntervalMs, onPermissionIssue }) {
    this.sampleIntervalMs = sampleIntervalMs;
    this.flushIntervalMs = flushIntervalMs;
    this.onFlush = onFlush;
    this.onPermissionIssue = onPermissionIssue;
    this.timer = null;
    this.flushTimer = null;
    this.current = null; // { application, startedAt }
    this.buckets = []; // completed { application, startedAt, endedAt, durationSeconds }
    this.consecutiveFailures = 0;
    this.warned = false;
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
    if (!app) {
      this.consecutiveFailures++;
      if (!this.warned && this.consecutiveFailures >= PERMISSION_WARNING_THRESHOLD) {
        this.warned = true;
        this.onPermissionIssue?.();
      }
      return;
    }
    this.consecutiveFailures = 0;
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
