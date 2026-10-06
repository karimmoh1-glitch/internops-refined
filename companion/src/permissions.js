// macOS permission pre-flight and deep links. Three signals, and the gates
// in front of each:
//   app           – none. Read from LaunchServices (lsappinfo); macOS does
//                   not gate it, so it is observed even with nothing granted.
//   windowTitle   – Apple Events to System Events (Automation prompt) AND
//                   Accessibility ("control this computer")
//   browserDomain – per-browser Automation, only testable while that
//                   browser is frontmost, so it stays "unknown" until the
//                   sampler has actually tried it
// Nothing here prompts on its own except the deliberate test Apple Event,
// which is exactly the thing that makes macOS show the Automation prompt.
const { execFile } = require("child_process");
const { promisify } = require("util");
const execFileAsync = promisify(execFile);
const workContext = require("./workContext");

const ACCESSIBILITY_URL = "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility";
const AUTOMATION_URL = "x-apple.systempreferences:com.apple.preference.security?Privacy_Automation";

function electron() {
  return require("electron");
}

function isAccessibilityTrusted() {
  if (process.platform !== "darwin") return null;
  try {
    return electron().systemPreferences.isTrustedAccessibilityClient(false);
  } catch {
    return null;
  }
}

async function testAppleEvent() {
  if (process.platform !== "darwin") return "unsupported";
  try {
    const { stdout } = await execFileAsync(
      "osascript",
      ["-e", 'tell application "System Events" to get name of first application process whose frontmost is true'],
      { timeout: 5000 }
    );
    return stdout.trim() ? "ok" : "error";
  } catch (err) {
    return workContext.isPermissionError(err) ? "denied" : "error";
  }
}

async function testFrontmostApp() {
  if (process.platform !== "darwin") return "unsupported";
  try {
    return (await workContext.getFrontmostApplicationMacOS()) ? "ok" : "error";
  } catch (err) {
    return workContext.isPermissionError(err) ? "denied" : "error";
  }
}

// Pure decision for the macOS window-title signal, from the three inputs
// that bear on it. Exported so it can be tested without the OS. `gate` is
// which setting is missing: "automation", "accessibility", or "both".
//   accessibility: true | false | null (unknown)
//   systemEvents:  "ok" | "denied" | "error" | "unknown"
//   live:          the sampler's last windowTitle attempt { status, gate }
function windowTitleStatus({ accessibility, systemEvents, live }) {
  if (systemEvents === "denied") return { status: "denied", gate: accessibility === false ? "both" : "automation" };
  if (accessibility === false) return { status: "denied", gate: "accessibility" };
  if (live?.status === "denied") return { status: "denied", gate: live.gate || "accessibility" };
  if (live?.status === "ok") return { status: "ok", gate: null };
  if (accessibility === true && systemEvents === "ok") return { status: "ok", gate: null };
  return { status: live?.status === "error" ? "error" : "unknown", gate: null };
}

// Combines the pre-flight checks with what the live sampler has seen most
// recently, so the Permissions screen reflects reality rather than a
// one-time probe.
async function check({ probe = true } = {}) {
  const platform = process.platform;
  const live = workContext.getSignals();
  if (platform === "darwin") {
    const accessibility = isAccessibilityTrusted();
    const appProbe = probe ? await testFrontmostApp() : live.app.status;
    const app = appProbe === "ok" ? "ok" : live.app.status === "ok" ? "ok" : appProbe;
    const systemEvents = probe ? await testAppleEvent() : live.systemEvents.status;
    const title = windowTitleStatus({ accessibility, systemEvents, live: live.windowTitle });
    const browserDomain = live.browserDomain.status;
    return {
      platform: "macos",
      app,
      windowTitle: title.status,
      windowTitleGate: title.gate,
      browserDomain,
      browser: live.browserDomain.browser || null,
      needsAttention: app === "denied" || title.status === "denied" || browserDomain === "denied",
      details: { accessibilityTrusted: accessibility, appleEvents: systemEvents, live },
    };
  }
  if (platform === "win32") {
    return {
      platform: "windows",
      app: live.app.status,
      windowTitle: live.windowTitle.status,
      windowTitleGate: null,
      browserDomain: live.browserDomain.status,
      browser: live.browserDomain.browser || null,
      needsAttention: false, // Windows has no permission gate for these signals
      details: { live },
    };
  }
  return { platform: "unsupported", app: "unsupported", windowTitle: "unsupported", windowTitleGate: null, browserDomain: "unsupported", browser: null, needsAttention: false, details: {} };
}

function openSettings(which) {
  if (process.platform !== "darwin") return false;
  const url = which === "automation" ? AUTOMATION_URL : ACCESSIBILITY_URL;
  electron().shell.openExternal(url).catch(() => {});
  return true;
}

module.exports = { check, openSettings, isAccessibilityTrusted, testAppleEvent, windowTitleStatus, ACCESSIBILITY_URL, AUTOMATION_URL };
