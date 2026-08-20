const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const { ActivityTracker } = require("./activityTracker");
const authStore = require("./authStore");
const api = require("./api");
const { reconcileTrackingState } = require("./reconcile");
const { SAMPLE_INTERVAL_MS, SYNC_INTERVAL_MS } = require("./config");

let mainWindow = null;
let tray = null;
let session = null; // { token, user }
let tracker = null;
let workModeActive = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 620,
    resizable: false,
    title: "InternOps Companion",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.on("close", (e) => {
    // Menu-bar-style app: closing the window doesn't stop an active Work
    // Mode session (that requires the explicit Stop button) — it just
    // hides the window, matching the "clear indication, explicit control"
    // requirement rather than silently killing tracking on an accidental
    // click.
    if (workModeActive && !app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  // A small solid-color dot, same asset on every platform. (An earlier
  // version used macOS's NSImageNameStatusAvailable named image, which
  // resolves to nothing on Windows/Linux and left the tray icon blank
  // there — a real file works everywhere.)
  let icon = nativeImage.createFromPath(path.join(__dirname, "renderer", "tray-icon.png"));
  if (icon.isEmpty()) icon = nativeImage.createFromNamedImage("NSImageNameStatusAvailable");
  tray = new Tray(icon);
  tray.setToolTip("InternOps Companion");
  updateTrayMenu();
  tray.on("click", () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function updateTrayMenu() {
  if (!tray) return;
  tray.setTitle(workModeActive ? " ● Work Mode" : "");
  const menu = Menu.buildFromTemplate([
    { label: workModeActive ? "Work Mode Active" : "Work Mode Off", enabled: false },
    { type: "separator" },
    { label: "Show InternOps Companion", click: () => mainWindow?.show() },
    { type: "separator" },
    { label: "Quit", click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

async function flushActivity(activities) {
  if (!session) return;
  await api.postActivity(session.token, activities);
}

// The Companion UI's live "Currently: VS Code / auth.ts" readout reads
// straight from the tracker's open bucket — never a separate, potentially
// stale copy of the same fact.
function currentContext() {
  if (!workModeActive || !tracker || !tracker.current) return null;
  const ctx = tracker.current.lastContext;
  return {
    application: ctx.application,
    documentName: ctx.documentName,
    browserDomain: ctx.browserDomain,
    idleSeconds: ctx.idleSeconds,
  };
}

function startTracking() {
  workModeActive = true;
  tracker = new ActivityTracker({
    sampleIntervalMs: SAMPLE_INTERVAL_MS,
    flushIntervalMs: SYNC_INTERVAL_MS,
    onFlush: flushActivity,
    onPermissionIssue: () => send("activity-permission-needed"),
  });
  tracker.start();
  updateTrayMenu();
}

async function stopTracking() {
  workModeActive = false;
  if (tracker) {
    await tracker.flushNow();
    tracker.stop();
    tracker = null;
  }
  updateTrayMenu();
}

app.whenReady().then(() => {
  createWindow();
  createTray();
  const saved = authStore.loadSession();
  if (saved) {
    session = saved;
    send("session-restored", { user: saved.user });
  }
});

app.on("window-all-closed", () => {
  // Menu-bar-style utility app — stay alive in the tray on macOS even
  // with no windows open, same as most menu-bar apps.
  if (process.platform !== "darwin") app.quit();
});

// --- IPC: everything the renderer can ask for. The token never leaves
// this process — the renderer only ever sees { user } and status flags. ---

ipcMain.handle("login", async (_e, { email, password }) => {
  const result = await api.login(email, password);
  if (result.user.role !== "intern") {
    throw new Error("The InternOps Companion is for interns. Sign in to the web app as an admin instead.");
  }
  session = { token: result.token, user: result.user };
  authStore.saveSession(session);
  return { user: session.user };
});

ipcMain.handle("logout", async () => {
  if (workModeActive) await stopTracking();
  session = null;
  authStore.clearSession();
  return { ok: true };
});

ipcMain.handle("get-status", async () => {
  if (!session) return { loggedIn: false };
  try {
    const active = await api.getActiveSession(session.token);
    const action = reconcileTrackingState(!!active, workModeActive);
    if (action === "start") startTracking(); // reconnect case: a shift was already active (e.g. app restarted mid-shift)
    if (action === "stop") await stopTracking(); // server-side end (admin, another device, or invalidation) the client hadn't heard about yet
    let nextBest = null;
    try {
      nextBest = await api.getNextBest(session.token);
    } catch {
      // Non-critical — the status view still works without it.
    }
    return {
      loggedIn: true,
      user: session.user,
      workModeActive,
      activeSession: active,
      currentTask: nextBest?.recommended?.task ?? null,
      currentContext: currentContext(),
    };
  } catch (err) {
    if (err.status === 401) {
      session = null;
      authStore.clearSession();
      return { loggedIn: false, sessionExpired: true };
    }
    throw err;
  }
});

ipcMain.handle("start-work-mode", async () => {
  if (!session) throw new Error("Not signed in.");
  const active = await api.startSession(session.token);
  startTracking();
  return active;
});

ipcMain.handle("stop-work-mode", async () => {
  if (!session) throw new Error("Not signed in.");
  await stopTracking();
  const result = await api.endSession(session.token);
  return result;
});

ipcMain.handle("get-summary", async (_e, sessionId) => {
  if (!session) throw new Error("Not signed in.");
  return api.getSummary(session.token, sessionId);
});

ipcMain.handle("update-summary-note", async (_e, { sessionId, note }) => {
  if (!session) throw new Error("Not signed in.");
  return api.updateSummary(session.token, sessionId, note);
});

ipcMain.handle("submit-summary", async (_e, sessionId) => {
  if (!session) throw new Error("Not signed in.");
  return api.submitSummary(session.token, sessionId);
});
