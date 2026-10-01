// Windows foreground-window probe backed by ONE long-lived PowerShell
// process. The previous implementation spawned `powershell -Command` with
// an inline Add-Type on every 15s sample, which recompiles the C# helper
// each time (hundreds of ms of CPU, visible in Task Manager). Here the
// helper types are compiled once at startup and the process then loops on
// stdin: each "probe" line answers with exactly one JSON line.
//
// Protocol: write "probe\n" → read one line of JSON
//   { "ProcessName": "Code", "Title": "routes.ts - internops", "AddressBar": "" }
// A request that doesn't answer within QUERY_TIMEOUT_MS kills the helper;
// the next query respawns it. Errors fail closed (null) — never a guess.
//
// NOT verified on a real Windows machine as part of this rewrite; the
// script is conservative (no profile, non-interactive, UTF-8) and every
// failure path degrades to "Observation unavailable".
const { spawn } = require("child_process");
const readline = require("readline");

const QUERY_TIMEOUT_MS = 5000;

const HELPER_SCRIPT = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public class InternOpsForeground {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
}
'@
$uia = $false
try { Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes; $uia = $true } catch {}
$browsers = @('chrome','msedge','brave','firefox','opera','vivaldi')
function Read-AddressBar($hwnd) {
  if (-not $uia) { return '' }
  try {
    $root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
    $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
    $edit = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
    if ($edit) {
      $pattern = $null
      if ($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { return [string]$pattern.Current.Value }
    }
  } catch {}
  return ''
}
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($line -eq $null) { break }
  if ($line -ne 'probe') { continue }
  $name = ''; $title = ''; $addr = ''
  try {
    $hwnd = [InternOpsForeground]::GetForegroundWindow()
    $procId = 0
    [InternOpsForeground]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
    $sb = New-Object System.Text.StringBuilder 512
    [InternOpsForeground]::GetWindowText($hwnd, $sb, 512) | Out-Null
    $title = $sb.ToString()
    $proc = Get-Process -Id $procId -ErrorAction SilentlyContinue
    if ($proc) { $name = $proc.ProcessName }
    if ($browsers -contains $name.ToLower()) { $addr = Read-AddressBar $hwnd }
  } catch {}
  $obj = [PSCustomObject]@{ ProcessName = $name; Title = $title; AddressBar = $addr }
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}
`.trim();

class WinProbe {
  constructor({ spawnImpl = spawn, timeoutMs = QUERY_TIMEOUT_MS } = {}) {
    this.spawnImpl = spawnImpl;
    this.timeoutMs = timeoutMs;
    this.child = null;
    this.rl = null;
    this.queue = []; // pending { resolve, reject, timer }
    this.disposed = false;
  }

  _ensure() {
    if (this.child && !this.child.killed && this.child.exitCode === null) return;
    const encoded = Buffer.from(HELPER_SCRIPT, "utf16le").toString("base64");
    const child = this.spawnImpl("powershell.exe", ["-NoProfile", "-NonInteractive", "-NoLogo", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
      stdio: ["pipe", "pipe", "ignore"],
      windowsHide: true,
    });
    this.child = child;
    this.rl = readline.createInterface({ input: child.stdout });
    this.rl.on("line", (line) => this._onLine(line));
    child.on("exit", () => {
      if (this.child === child) {
        this.child = null;
        this.rl = null;
      }
      this._failAll(new Error("foreground probe exited"));
    });
    child.on("error", (err) => this._failAll(err));
    child.stdin.on("error", () => {});
  }

  _onLine(line) {
    const pending = this.queue.shift();
    if (!pending) return;
    clearTimeout(pending.timer);
    try {
      const parsed = JSON.parse(line);
      pending.resolve({
        processName: parsed.ProcessName || null,
        title: parsed.Title || null,
        addressBar: parsed.AddressBar || null,
      });
    } catch (err) {
      pending.reject(err);
    }
  }

  _failAll(err) {
    const pending = this.queue;
    this.queue = [];
    for (const p of pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
  }

  query() {
    if (this.disposed) return Promise.reject(new Error("probe disposed"));
    return new Promise((resolve, reject) => {
      try {
        this._ensure();
      } catch (err) {
        reject(err);
        return;
      }
      const entry = { resolve, reject, timer: null };
      entry.timer = setTimeout(() => {
        const idx = this.queue.indexOf(entry);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error("foreground probe timed out"));
        this._kill(); // a wedged helper is respawned on the next query
      }, this.timeoutMs);
      this.queue.push(entry);
      this.child.stdin.write("probe\n", (err) => {
        if (err) {
          const idx = this.queue.indexOf(entry);
          if (idx >= 0) this.queue.splice(idx, 1);
          clearTimeout(entry.timer);
          reject(err);
        }
      });
    });
  }

  _kill() {
    const child = this.child;
    this.child = null;
    this.rl = null;
    try { child?.kill(); } catch { /* already gone */ }
  }

  dispose() {
    this.disposed = true;
    this._failAll(new Error("probe disposed"));
    this._kill();
  }
}

let probe = null;
function getProbe() {
  if (!probe) probe = new WinProbe();
  return probe;
}

module.exports = { WinProbe, getProbe, HELPER_SCRIPT };
