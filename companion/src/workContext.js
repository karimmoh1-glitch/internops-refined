// The single cross-platform entry point for everything we're legitimately
// allowed to observe about the current foreground work context. Platform
// differences live entirely inside this module — callers never branch on
// process.platform.
//
// Every field is independently OBSERVED (we got a real value from the OS)
// or null, meaning UNKNOWN — never guessed, never a fallback value dressed
// up as data. A field commonly comes back null not because something is
// broken but because the OS gates it behind a permission (macOS
// Accessibility for window titles, per-app Automation for browser tabs)
// that the user hasn't granted — that's a legitimate UNKNOWN, not an error.
//
// What this deliberately never touches: keystrokes, mouse position/content,
// screen pixels, clipboard, full URLs (only the domain), passwords, or any
// window content beyond its title string.
const { exec } = require("child_process");
const { promisify } = require("util");
const { powerMonitor } = require("electron");
const execAsync = promisify(exec);

const EXEC_TIMEOUT_MS = 5000;

// Browsers we know how to ask for their active tab's URL (macOS, via
// per-app Automation permission — a separate OS prompt from the general
// "control this computer" one, and the user can grant or deny it per app).
const MACOS_BROWSERS = new Set(["Google Chrome", "Safari", "Arc", "Microsoft Edge"]);
// Same set, matched against the Windows process name reported by Win32.
const WINDOWS_BROWSER_PROCESSES = new Set(["chrome", "msedge"]);

function extractDomain(rawUrl) {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null; // never leak chrome://, file://, etc.
    return u.hostname || null;
  } catch {
    return null;
  }
}

// Best-effort, deterministic (never AI) extraction of a document/file name
// from a raw window title — never invented, only ever a substring already
// present in the title we observed. Editors and browsers both commonly use
// "<document> — <app/context>" or "<document> - <app/context>"; we take the
// first segment when that shape is present, otherwise we report UNKNOWN
// rather than guess.
function inferDocumentName(windowTitle) {
  if (!windowTitle) return null;
  const match = windowTitle.match(/^(.+?)\s+[–—-]\s+.+$/); // en dash, em dash, or hyphen
  if (!match) return null;
  const candidate = match[1].trim();
  return candidate.length > 0 && candidate.length < 200 ? candidate : null;
}

async function getFrontmostApplicationMacOS() {
  const { stdout } = await execAsync(
    `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
    { timeout: EXEC_TIMEOUT_MS }
  );
  return stdout.trim() || null;
}

// Requires the user to have granted System Events (i.e. this app) the
// Accessibility permission — without it, this AppleScript call throws and
// we correctly report UNKNOWN rather than a stale/wrong title.
async function getWindowTitleMacOS(appName) {
  const escaped = appName.replace(/"/g, '\\"');
  const { stdout } = await execAsync(
    `osascript -e 'tell application "System Events" to tell (first process whose frontmost is true) to get title of front window'`,
    { timeout: EXEC_TIMEOUT_MS }
  );
  const title = stdout.trim();
  return title.length > 0 ? title : null;
}

// Requires per-browser Automation permission (System Settings > Privacy &
// Security > Automation). Deliberately extracts only the domain — never the
// full URL, which could carry search queries or other sensitive parameters.
async function getBrowserDomainMacOS(appName) {
  if (!MACOS_BROWSERS.has(appName)) return null;
  const tellTarget = appName === "Safari" ? "URL of front document" : "URL of active tab of front window";
  const { stdout } = await execAsync(
    `osascript -e 'tell application "${appName}" to get ${tellTarget}'`,
    { timeout: EXEC_TIMEOUT_MS }
  );
  return extractDomain(stdout.trim());
}

const WIN_FOREGROUND_SCRIPT = `
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
$hwnd = [InternOpsForeground]::GetForegroundWindow()
$procId = 0
[InternOpsForeground]::GetWindowThreadProcessId($hwnd, [ref]$procId) | Out-Null
$title = New-Object System.Text.StringBuilder 512
[InternOpsForeground]::GetWindowText($hwnd, $title, 512) | Out-Null
$proc = Get-Process -Id $procId
[PSCustomObject]@{ ProcessName = $proc.ProcessName; Title = $title.ToString() } | ConvertTo-Json -Compress
`.trim();

async function getForegroundWindows32() {
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${WIN_FOREGROUND_SCRIPT.replace(/"/g, '\\"')}"`,
    { timeout: EXEC_TIMEOUT_MS }
  );
  const parsed = JSON.parse(stdout.trim());
  return { processName: parsed.ProcessName || null, title: parsed.Title || null };
}

// Best-effort address-bar read via Windows UI Automation — meaningfully
// more fragile than the macOS Automation path (no dedicated per-browser
// API; this walks the accessibility tree looking for the address bar edit
// control). Not independently verified against a real Windows browser
// window as part of this change — fails closed to UNKNOWN on any error,
// same as every other signal here, rather than risk a wrong guess.
async function getBrowserDomainWindows(processName) {
  if (!WINDOWS_BROWSER_PROCESSES.has(processName)) return null;
  const script = `
Add-Type -AssemblyName UIAutomationClient
$hwnd = (Get-Process -Name '${processName}' | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1).MainWindowHandle
if (-not $hwnd) { exit }
$root = [System.Windows.Automation.AutomationElement]::FromHandle($hwnd)
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Edit)
$edit = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $cond)
if ($edit) { $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value }
`.trim();
  const { stdout } = await execAsync(
    `powershell -NoProfile -NonInteractive -Command "${script.replace(/"/g, '\\"')}"`,
    { timeout: EXEC_TIMEOUT_MS }
  );
  const value = stdout.trim();
  if (!value) return null;
  // The address bar often shows a bare host without a scheme; URL() needs one to parse.
  return extractDomain(/^https?:\/\//i.test(value) ? value : `https://${value}`);
}

// Coarse, aggregate-only signal — seconds since the last keyboard/mouse
// input system-wide, via Electron's own idle clock. Never raw key/mouse
// events, positions, or content; just "how long has nothing moved."
function getIdleSeconds() {
  try {
    return powerMonitor.getSystemIdleTime();
  } catch {
    return null;
  }
}

// The one function callers use. Every field fails closed to null/UNKNOWN
// independently — a browser-domain failure never blocks the application
// name, a window-title permission gap never blocks idle time.
async function getCurrentWorkContext() {
  const platform = process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "unsupported";
  const idleSeconds = getIdleSeconds();

  if (platform === "macos") {
    let application = null;
    try { application = await getFrontmostApplicationMacOS(); } catch { /* permission not granted or transient failure — UNKNOWN */ }
    if (!application) return { application: null, windowTitle: null, documentName: null, browserDomain: null, idleSeconds, platform, contextSource: null };

    let windowTitle = null;
    try { windowTitle = await getWindowTitleMacOS(application); } catch { /* Accessibility permission not granted — UNKNOWN */ }

    let browserDomain = null;
    try { browserDomain = await getBrowserDomainMacOS(application); } catch { /* Automation permission not granted for this app — UNKNOWN */ }

    return {
      application,
      windowTitle,
      documentName: inferDocumentName(windowTitle),
      browserDomain,
      idleSeconds,
      platform,
      contextSource: "applescript",
    };
  }

  if (platform === "windows") {
    let processName = null, title = null;
    try {
      const result = await getForegroundWindows32();
      processName = result.processName;
      title = result.title;
    } catch { /* transient failure — UNKNOWN */ }
    if (!processName) return { application: null, windowTitle: null, documentName: null, browserDomain: null, idleSeconds, platform, contextSource: null };

    let browserDomain = null;
    try { browserDomain = await getBrowserDomainWindows(processName); } catch { /* best-effort UI Automation path failed — UNKNOWN */ }

    return {
      application: processName,
      windowTitle: title || null,
      documentName: inferDocumentName(title),
      browserDomain,
      idleSeconds,
      platform,
      contextSource: "win32",
    };
  }

  // Unsupported platform (e.g. Linux) — genuinely UNKNOWN across the board,
  // not zeros dressed up as data.
  return { application: null, windowTitle: null, documentName: null, browserDomain: null, idleSeconds, platform, contextSource: null };
}

module.exports = { getCurrentWorkContext, extractDomain, inferDocumentName };
