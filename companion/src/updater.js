// Update checking/download/install, wrapped so that nothing here can ever
// crash the app or leave it in a broken state — every failure is caught,
// logged, and reported to the renderer as a status the user can see; the
// app simply keeps running on its current version. Update checks/installs
// are also never allowed to run while Work Mode is active (see
// isWorkModeActive below) — a shift in progress must never be interrupted.
const { autoUpdater } = require("electron-updater");

let isWorkModeActive = () => false;
let onStatus = () => {};

// electron-updater auto-downloads by default; we want explicit control so
// a download can never start mid-shift even if a check happened to run
// right as Work Mode started.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// Test-only override — never set in production. Lets a local integration
// test point a running build at a local static file server instead of
// real GitHub Releases, without touching the production publish config.
if (process.env.INTERNOPS_UPDATE_FEED_URL) {
  autoUpdater.setFeedURL({ provider: "generic", url: process.env.INTERNOPS_UPDATE_FEED_URL });
}

function setup({ isWorkModeActiveFn, onStatusFn }) {
  isWorkModeActive = isWorkModeActiveFn;
  onStatus = onStatusFn;

  autoUpdater.on("checking-for-update", () => onStatus({ state: "checking" }));

  autoUpdater.on("update-available", (info) => {
    onStatus({ state: "available", version: info.version });
    if (isWorkModeActive()) {
      onStatus({ state: "deferred", version: info.version, reason: "Work Mode is active — will download once the shift ends." });
      return;
    }
    autoUpdater.downloadUpdate().catch((err) => {
      console.error("[updater] download failed:", err);
      onStatus({ state: "error", message: firstLine(err?.message) || "Download failed." });
    });
  });

  autoUpdater.on("update-not-available", () => onStatus({ state: "up-to-date" }));

  autoUpdater.on("download-progress", (p) => onStatus({ state: "downloading", percent: Math.round(p.percent) }));

  autoUpdater.on("update-downloaded", (info) => {
    onStatus({ state: "downloaded", version: info.version });
    // Never install while a shift could still be running — checked again
    // here (not just at update-available time) because a download can
    // take a while, and Work Mode could have started during it.
    if (!isWorkModeActive()) {
      onStatus({ state: "ready-to-install", version: info.version });
    }
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error event:", err);
    onStatus({ state: "error", message: firstLine(err?.message) || "Update check failed." });
  });
}

// The first line of an electron-updater error is the actual message
// ("Cannot find latest-mac.yml...", "net::ERR_INTERNET_DISCONNECTED",
// etc.); everything after that is an HTTP header dump and a stack trace —
// useful in the log, not on screen.
function firstLine(message) {
  return String(message || "").split("\n")[0];
}

async function checkForUpdates() {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    // Network failure, no releases published yet, GitHub unreachable —
    // all non-fatal. The app keeps running on its current version either
    // way; this just means the user doesn't hear about a new one yet.
    console.error("[updater] check failed:", err);
    onStatus({ state: "error", message: firstLine(err?.message) || "Couldn't check for updates." });
  }
}

// Only ever called explicitly by the user (or once a deferred/pending
// install becomes safe) — never automatically, and never while Work Mode
// is active.
function installNow() {
  if (isWorkModeActive()) {
    onStatus({ state: "error", message: "Can't install while a shift is active." });
    return;
  }
  autoUpdater.quitAndInstall();
}

module.exports = { setup, checkForUpdates, installNow, autoUpdater };
