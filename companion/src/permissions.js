// macOS permission pre-flight and deep links. Three signals, three
// different OS gates:
//   app           – Apple Events to System Events (Automation prompt)
//   windowTitle   – Accessibility ("control this computer")
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

// Combines the pre-flight checks with what the live sampler has seen most
// recently, so the Permissions screen reflects reality rather than a
// one-time probe.
async function check({ probe = true } = {}) {
  const platform = process.platform;
  const live = workContext.getSignals();
  if (platform === "darwin") {
    const accessibility = isAccessibilityTrusted();
    const appleEvents = probe ? await testAppleEvent() : live.app.status;
    const app = appleEvents === "ok" ? "ok" : appleEvents === "denied" ? "denied" : live.app.status === "ok" ? "ok" : live.app.status;
    const windowTitle = accessibility === false ? "denied" : live.windowTitle.status === "ok" ? "ok" : accessibility === true ? "ok" : "unknown";
    const browserDomain = live.browserDomain.status;
    return {
      platform: "macos",
      app,
      windowTitle,
      browserDomain,
      browser: live.browserDomain.browser || null,
      needsAttention: app === "denied" || windowTitle === "denied" || browserDomain === "denied",
      details: { accessibilityTrusted: accessibility, appleEvents, live },
    };
  }
  if (platform === "win32") {
    return {
      platform: "windows",
      app: live.app.status,
      windowTitle: live.windowTitle.status,
      browserDomain: live.browserDomain.status,
      browser: live.browserDomain.browser || null,
      needsAttention: false, // Windows has no permission gate for these signals
      details: { live },
    };
  }
  return { platform: "unsupported", app: "unsupported", windowTitle: "unsupported", browserDomain: "unsupported", browser: null, needsAttention: false, details: {} };
}

function openSettings(which) {
  if (process.platform !== "darwin") return false;
  const url = which === "automation" ? AUTOMATION_URL : ACCESSIBILITY_URL;
  electron().shell.openExternal(url).catch(() => {});
  return true;
}

module.exports = { check, openSettings, isAccessibilityTrusted, testAppleEvent, ACCESSIBILITY_URL, AUTOMATION_URL };
