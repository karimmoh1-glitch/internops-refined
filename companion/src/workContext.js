// The single cross-platform entry point for everything we're legitimately
// allowed to observe about the current foreground work context. Platform
// differences live entirely inside this module (and winProbe.js for the
// persistent Windows helper) — callers never branch on process.platform.
//
// Every field is independently OBSERVED (we got a real value from the OS)
// or null, meaning UNKNOWN — never guessed, never a fallback dressed up as
// data. A null commonly means the OS gates the signal behind a permission
// (macOS Accessibility for window titles, per-app Automation for browser
// tabs) the user hasn't granted — a legitimate UNKNOWN, not an error.
//
// Deliberately never touched: keystrokes, mouse position/content, screen
// pixels, clipboard, full URLs (only the hostname), passwords, or any
// window content beyond its title string.
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);

const EXEC_TIMEOUT_MS = 5000;

// Browsers we know how to ask for their active tab's URL on macOS (each
// needs its own Automation permission, which the OS prompts for).
const MACOS_BROWSERS = new Set(["Google Chrome", "Safari", "Arc", "Microsoft Edge", "Brave Browser"]);

// Windows process names (without .exe) whose UI Automation address bar we
// attempt to read, mapped to their normalised display names below.
const WINDOWS_BROWSER_PROCESSES = new Set(["chrome", "msedge", "brave", "firefox", "opera", "vivaldi"]);

// Windows reports a process image name; the server categorises by the
// human application name macOS reports. Normalise the common ones so the
// same real app lands in the same category on both platforms. Unknown
// names pass through unchanged (still observed, just not prettified).
const WINDOWS_PROCESS_NAMES = Object.freeze({
  chrome: "Google Chrome",
  msedge: "Microsoft Edge",
  firefox: "Mozilla Firefox",
  brave: "Brave Browser",
  opera: "Opera",
  vivaldi: "Vivaldi",
  code: "Visual Studio Code",
  "code - insiders": "Visual Studio Code",
  devenv: "Visual Studio",
  idea64: "IntelliJ IDEA",
  pycharm64: "PyCharm",
  webstorm64: "WebStorm",
  rider64: "Rider",
  sublime_text: "Sublime Text",
  notepad: "Notepad",
  "notepad++": "Notepad++",
  windowsterminal: "Windows Terminal",
  powershell: "PowerShell",
  pwsh: "PowerShell",
  cmd: "Command Prompt",
  explorer: "File Explorer",
  winword: "Microsoft Word",
  excel: "Microsoft Excel",
  powerpnt: "Microsoft PowerPoint",
  outlook: "Microsoft Outlook",
  olk: "Microsoft Outlook",
  onenote: "Microsoft OneNote",
  teams: "Microsoft Teams",
  "ms-teams": "Microsoft Teams",
  msteams: "Microsoft Teams",
  slack: "Slack",
  discord: "Discord",
  zoom: "Zoom",
  figma: "Figma",
  notion: "Notion",
  obsidian: "Obsidian",
  postman: "Postman",
  spotify: "Spotify",
  acrobat: "Adobe Acrobat",
  acrord32: "Adobe Acrobat Reader",
  photoshop: "Adobe Photoshop",
  illustrator: "Adobe Illustrator",
  "internops companion": "InternOps Companion",
});

function normalizeWindowsProcessName(processName) {
  if (!processName || typeof processName !== "string") return null;
  const trimmed = processName.trim().replace(/\.exe$/i, "");
  if (!trimmed) return null;
  return WINDOWS_PROCESS_NAMES[trimmed.toLowerCase()] || trimmed;
}

function extractDomain(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const candidate = rawUrl.trim();
  if (!candidate) return null;
  try {
    const u = new URL(candidate);
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
// rather than guess. A leading unsaved-changes marker ("● ", "* ") is
// stripped because it is state, not part of the name.
function inferDocumentName(windowTitle) {
  if (!windowTitle || typeof windowTitle !== "string") return null;
  const cleaned = windowTitle.replace(/^[●•*]\s*/, "").trim();
  const match = cleaned.match(/^(.+?)\s+[–—-]\s+.+$/); // en dash, em dash, or hyphen
  if (!match) return null;
  const candidate = match[1].trim();
  return candidate.length > 0 && candidate.length < 200 ? candidate : null;
}

// --- Permission signal bookkeeping ------------------------------------
// Each signal records the outcome of its most recent attempt so the
// Permissions screen can show ✔/✖ per signal without a separate probe.
const signals = {
  app: { status: "unknown", error: null, at: null }, // "ok" | "denied" | "error" | "unknown"
  windowTitle: { status: "unknown", error: null, at: null },
  browserDomain: { status: "unknown", error: null, at: null, browser: null },
};
function note(signal, status, error = null, extra = {}) {
  signals[signal] = { status, error: error ? String(error).split("\n")[0].slice(0, 200) : null, at: Date.now(), ...extra };
}
function getSignals() {
  return JSON.parse(JSON.stringify(signals));
}
// macOS error codes: -1743 "Not authorized to send Apple events",
// -25211 / "assistive access" for Accessibility.
function isPermissionError(err) {
  const text = String(err?.stderr || err?.message || err || "");
  return /-1743|not authori[sz]ed|assistive access|not allowed|-25211|-10004/i.test(text);
}

async function osascript(script) {
  const { stdout } = await execFileAsync("osascript", ["-e", script], { timeout: EXEC_TIMEOUT_MS });
  return stdout.trim();
}

async function getFrontmostApplicationMacOS() {
  return (await osascript('tell application "System Events" to get name of first application process whose frontmost is true')) || null;
}

// Requires Accessibility permission — without it this throws and we
// correctly report UNKNOWN rather than a stale/wrong title.
async function getWindowTitleMacOS() {
  const title = await osascript('tell application "System Events" to tell (first process whose frontmost is true) to get title of front window');
  return title.length > 0 ? title : null;
}

// Requires per-browser Automation permission. Extracts only the hostname.
async function getBrowserDomainMacOS(appName) {
  if (!MACOS_BROWSERS.has(appName)) return null;
  const tellTarget = appName === "Safari" ? "URL of front document" : "URL of active tab of front window";
  const url = await osascript(`tell application "${appName}" to get ${tellTarget}`);
  return extractDomain(url);
}

function getIdleSeconds() {
  try {
    // Lazy so this module loads in plain Node (tests) where `electron` is
    // just the path to the binary.
    const { powerMonitor } = require("electron");
    return powerMonitor ? powerMonitor.getSystemIdleTime() : null;
  } catch {
    return null;
  }
}

const EMPTY = (platform, idleSeconds) => ({ application: null, windowTitle: null, documentName: null, browserDomain: null, idleSeconds, platform, contextSource: null });

async function getMacOSContext(idleSeconds) {
  let application = null;
  try {
    application = await getFrontmostApplicationMacOS();
    note("app", application ? "ok" : "error");
  } catch (err) {
    note("app", isPermissionError(err) ? "denied" : "error", err?.stderr || err?.message);
  }
  if (!application) return EMPTY("macos", idleSeconds);

  let windowTitle = null;
  try {
    windowTitle = await getWindowTitleMacOS();
    note("windowTitle", "ok");
  } catch (err) {
    // A window-less frontmost app (Finder with no window) also throws; only
    // call it "denied" when the error says so.
    note("windowTitle", isPermissionError(err) ? "denied" : "error", err?.stderr || err?.message);
  }

  let browserDomain = null;
  if (MACOS_BROWSERS.has(application)) {
    try {
      browserDomain = await getBrowserDomainMacOS(application);
      note("browserDomain", "ok", null, { browser: application });
    } catch (err) {
      note("browserDomain", isPermissionError(err) ? "denied" : "error", err?.stderr || err?.message, { browser: application });
    }
  }

  return {
    application,
    windowTitle,
    documentName: inferDocumentName(windowTitle),
    browserDomain,
    idleSeconds,
    platform: "macos",
    contextSource: "applescript",
  };
}

let winProbe = null;
async function getWindowsContext(idleSeconds) {
  if (!winProbe) winProbe = require("./winProbe").getProbe();
  let result = null;
  try {
    result = await winProbe.query();
    note("app", result?.processName ? "ok" : "error");
  } catch (err) {
    note("app", "error", err?.message);
  }
  if (!result || !result.processName) return EMPTY("windows", idleSeconds);
  const application = normalizeWindowsProcessName(result.processName);
  const windowTitle = result.title || null;
  note("windowTitle", windowTitle ? "ok" : "error");
  let browserDomain = null;
  if (WINDOWS_BROWSER_PROCESSES.has(result.processName.toLowerCase())) {
    const value = result.addressBar || "";
    browserDomain = value ? extractDomain(/^https?:\/\//i.test(value) ? value : `https://${value}`) : null;
    note("browserDomain", browserDomain ? "ok" : "error", browserDomain ? null : "address bar not readable via UI Automation", { browser: application });
  }
  return {
    application,
    windowTitle,
    documentName: inferDocumentName(windowTitle),
    browserDomain,
    idleSeconds,
    platform: "windows",
    contextSource: "win32",
  };
}

// The one function callers use. Every field fails closed to null/UNKNOWN
// independently — a browser-domain failure never blocks the application
// name, a window-title permission gap never blocks idle time.
async function getCurrentWorkContext() {
  const idleSeconds = getIdleSeconds();
  if (process.platform === "darwin") return getMacOSContext(idleSeconds);
  if (process.platform === "win32") return getWindowsContext(idleSeconds);
  return EMPTY("unsupported", idleSeconds);
}

function shutdown() {
  try { winProbe?.dispose(); } catch { /* best effort */ }
  winProbe = null;
}

module.exports = {
  getCurrentWorkContext,
  extractDomain,
  inferDocumentName,
  normalizeWindowsProcessName,
  WINDOWS_PROCESS_NAMES,
  MACOS_BROWSERS,
  getSignals,
  isPermissionError,
  shutdown,
};
