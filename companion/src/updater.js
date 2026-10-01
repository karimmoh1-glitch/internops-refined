// Update checking/download/install, wrapped so that nothing here can ever
// crash the app or leave it in a broken state — every failure is caught,
// logged, and reported as a status the user can see. Nothing downloads or
// installs while Work Mode is active: a shift in progress is never
// interrupted. Outside a shift, a downloaded update installs itself on
// the next quit (autoInstallOnAppQuit) so the user never has to think
// about it; inside a shift that flag is switched off.
const { autoUpdater } = require("electron-updater");

let isWorkModeActive = () => false;
let onStatus = () => {};
let status = { state: "idle" };

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

// Test-only override — lets a local integration test point a running build
// at a static file server instead of real GitHub Releases.
if (process.env.INTERNOPS_UPDATE_FEED_URL) {
  autoUpdater.setFeedURL({ provider: "generic", url: process.env.INTERNOPS_UPDATE_FEED_URL });
}

function setStatus(next) {
  status = next;
  try { onStatus(next); } catch { /* never let a listener break the updater */ }
}

function firstLine(message) {
  return String(message || "").split("\n")[0];
}

function setup({ isWorkModeActiveFn, onStatusFn }) {
  isWorkModeActive = isWorkModeActiveFn;
  onStatus = onStatusFn;

  autoUpdater.on("checking-for-update", () => setStatus({ state: "checking" }));

  autoUpdater.on("update-available", (info) => {
    if (isWorkModeActive()) {
      setStatus({ state: "deferred", version: info.version, reason: "Work Mode is active — it will download once the shift ends." });
      return;
    }
    setStatus({ state: "available", version: info.version });
    autoUpdater.downloadUpdate().catch((err) => {
      console.error("[updater] download failed:", err);
      setStatus({ state: "error", message: firstLine(err?.message) || "Download failed." });
    });
  });

  autoUpdater.on("update-not-available", () => setStatus({ state: "up-to-date", checkedAt: Date.now() }));
  autoUpdater.on("download-progress", (p) => setStatus({ state: "downloading", percent: Math.round(p.percent) }));

  autoUpdater.on("update-downloaded", (info) => {
    // Checked again here, not just at update-available time: a download
    // can take a while and Work Mode may have started during it.
    setStatus({ state: isWorkModeActive() ? "downloaded" : "ready-to-install", version: info.version });
    syncInstallOnQuit();
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] error event:", err);
    setStatus({ state: "error", message: firstLine(err?.message) || "Update check failed." });
  });
}

// autoInstallOnAppQuit is true exactly when a quit could not interrupt a
// shift. Called by main on every Work Mode transition.
function syncInstallOnQuit() {
  autoUpdater.autoInstallOnAppQuit = !isWorkModeActive();
  if (status.state === "downloaded" && !isWorkModeActive()) {
    setStatus({ state: "ready-to-install", version: status.version });
  }
}

async function checkForUpdates({ manual = false } = {}) {
  try {
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.error("[updater] check failed:", err);
    setStatus({ state: "error", message: firstLine(err?.message) || "Couldn't check for updates.", manual });
  }
}

// User-initiated only; refuses while Work Mode is active.
function installNow() {
  if (isWorkModeActive()) {
    setStatus({ state: "error", message: "Can't install while a shift is active." });
    return false;
  }
  autoUpdater.quitAndInstall();
  return true;
}

function getStatus() {
  return status;
}

module.exports = { setup, checkForUpdates, installNow, syncInstallOnQuit, getStatus, autoUpdater };
