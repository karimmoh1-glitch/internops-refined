const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, nativeTheme, powerMonitor, shell, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const config = require("./config");
const api = require("./api");
const authStore = require("./authStore");
const { Outbox } = require("./outbox");
const { ActivityTracker } = require("./activityTracker");
const { WorkMode, STATES } = require("./workMode");
const workContext = require("./workContext");
const permissions = require("./permissions");
const updater = require("./updater");
const { formatHMS, connectionStatus: connectionStatusFor, trayStatusLine } = require("./status");

// Without a single-instance lock a second launch would load the same
// persisted session, see the same active shift on the server, and start
// its own sampler — double-counting the same real machine. Only the first
// instance runs; later launches hand off to it and quit.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return; // module-level return is valid — each CommonJS file is wrapped in a function
}
app.on("second-instance", () => showWindow());

// ---------------------------------------------------------------------
// State. Everything the renderer shows is derived from these; the renderer
// never holds state of its own beyond "which view am I on".
// ---------------------------------------------------------------------
let mainWindow = null;
let tray = null;
const trayIcons = { off: null, on: null };
let session = null; // { token, user }
let sessionExpired = null; // message while the "Session expired" screen should show
let loggingOut = false;
let outbox = null;
let workMode = null;
let task = null;
let taskFetchedAt = 0;
let observation = { status: "unavailable", at: null };
let completion = null; // { endedAt, durationSeconds } after a report is submitted, until the next shift
const connection = { failures: 0, lastOkAt: null, lastError: null };
let permissionState = { platform: process.platform === "darwin" ? "macos" : process.platform === "win32" ? "windows" : "unsupported", app: "unknown", windowTitle: "unknown", windowTitleGate: null, browserDomain: "unknown", browser: null, needsAttention: false };
let updateStatus = updater.getStatus();
let reconcileTimer = null;
let flushTimer = null;
let trayTimer = null;
let quitting = false;
let pendingNavigate = null;
const pauseReasons = new Set();

const isMac = process.platform === "darwin";

function userDataPath(name) {
  return path.join(app.getPath("userData"), name);
}

function connectionStatus() {
  return connectionStatusFor(connection);
}

function buildState() {
  return {
    appVersion: app.getVersion(),
    platform: process.platform,
    webUrl: config.WEB_URL,
    auth: { loggedIn: !!session, user: session?.user ?? null, expired: sessionExpired },
    work: workMode ? workMode.snapshot() : { state: STATES.OFF },
    task,
    observation,
    completion,
    connection: {
      status: connectionStatus(),
      queued: outbox ? outbox.size : 0,
      lastOkAt: connection.lastOkAt,
      lastError: connection.lastError,
      nextAttemptAt: outbox ? outbox.nextAttemptAt : 0,
    },
    permissions: permissionState,
    update: updateStatus,
  };
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

let broadcastQueued = false;
function broadcast() {
  // Coalesce bursts (a transition fires onChange, then the caller
  // broadcasts again) into one IPC message per tick.
  if (broadcastQueued) return;
  broadcastQueued = true;
  setImmediate(() => {
    broadcastQueued = false;
    send("state", buildState());
    updateTray();
  });
}

function noteConnectionOk() {
  connection.failures = 0;
  connection.lastOkAt = Date.now();
  connection.lastError = null;
}
function noteConnectionFail(err) {
  connection.failures++;
  connection.lastError = err?.message || String(err);
}

// ---------------------------------------------------------------------
// Window — macOS menu-bar style: close hides, tray/dock/activate re-shows,
// and a destroyed window is always re-created rather than touched.
// ---------------------------------------------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 360,
    height: 560,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    show: false,
    title: "InternOps Companion",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    trafficLightPosition: isMac ? { x: 12, y: 14 } : undefined,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0B0B0C" : "#F7F6F3",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (url !== mainWindow.webContents.getURL()) e.preventDefault();
  });
  mainWindow.webContents.on("did-finish-load", () => {
    send("state", buildState());
    if (pendingNavigate) {
      send("navigate", pendingNavigate);
      pendingNavigate = null;
    }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.on("close", (e) => {
    if (quitting) return;
    e.preventDefault();
    mainWindow.hide();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

function showWindow(view = null) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingNavigate = view;
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (view) send("navigate", view);
}

// ---------------------------------------------------------------------
// Tray
// ---------------------------------------------------------------------
function loadTrayIcon(name) {
  const img = nativeImage.createFromPath(path.join(__dirname, "renderer", name));
  if (!img.isEmpty()) img.setTemplateImage(true);
  return img;
}

function createTray() {
  trayIcons.off = loadTrayIcon("trayTemplate.png");
  trayIcons.on = loadTrayIcon("trayOnTemplate.png");
  tray = new Tray(trayIcons.off);
  tray.setToolTip("InternOps Companion");
  tray.on("click", () => {
    if (isMac) {
      // On macOS the click opens the menu (set below); double-click shows.
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) mainWindow.hide();
    else showWindow();
  });
  tray.on("double-click", () => showWindow());
  updateTray();
}

function elapsedSeconds() {
  const startedAt = workMode?.session?.startedAt;
  if (!startedAt) return 0;
  return (Date.now() - new Date(startedAt).getTime()) / 1000;
}

function updateTray() {
  if (!tray) return;
  const on = workMode?.state === STATES.ON;
  const busy = workMode?.isBusy;
  const pendingReport = workMode?.state === STATES.ENDED_PENDING_REPORT;
  tray.setImage(on ? trayIcons.on : trayIcons.off);
  tray.setTitle(on ? ` ${formatHMS(elapsedSeconds())}` : "");
  const statusLine = trayStatusLine({
    loggedIn: !!session,
    workState: workMode?.state ?? STATES.OFF,
    paused: !!workMode?.paused,
    elapsedSeconds: elapsedSeconds(),
    connection: connectionStatus(),
    queued: outbox ? outbox.size : 0,
    completed: !!completion,
  });
  tray.setToolTip(`InternOps Companion — ${statusLine}`);
  const template = [
    { label: statusLine, enabled: false },
    { type: "separator" },
    {
      label: on ? "End Work Mode…" : busy ? (workMode.state === STATES.STARTING ? "Connecting…" : "Ending…") : "Start Work Mode",
      enabled: !!session && !busy,
      click: () => (on ? showWindow("confirm-end") : ipcStartWork()),
    },
    { type: "separator" },
    { label: "Open InternOps", click: () => shell.openExternal(config.WEB_URL).catch(() => {}) },
    ...(pendingReport ? [{ label: "Open report", click: () => showWindow("report") }] : []),
    { label: "Permissions…", click: () => showWindow("permissions") },
    { label: "Check for updates", click: () => updater.checkForUpdates({ manual: true }) },
    { type: "separator" },
    { label: "Show InternOps Companion", click: () => showWindow() },
    { label: on ? "Quit (shift stays active on the server)" : "Quit", click: () => app.quit() },
  ];
  tray.setContextMenu(Menu.buildFromTemplate(template));
  if (on && !trayTimer) {
    trayTimer = setInterval(() => tray?.setTitle(` ${formatHMS(elapsedSeconds())}`), 1000);
  } else if (!on && trayTimer) {
    clearInterval(trayTimer);
    trayTimer = null;
  }
}

function buildAppMenu() {
  const template = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: "about" },
            { label: "Check for Updates…", click: () => updater.checkForUpdates({ manual: true }) },
            { label: "Permissions…", click: () => showWindow("permissions") },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        }]
      : []),
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "close" }] },
    { label: "Help", submenu: [{ label: "Open InternOps", click: () => shell.openExternal(config.WEB_URL).catch(() => {}) }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------
// Observation + permissions
// ---------------------------------------------------------------------
async function refreshPermissions({ probe = false } = {}) {
  try {
    permissionState = await permissions.check({ probe });
  } catch (err) {
    console.error("[permissions] check failed:", err);
  }
  if (observation.status !== "ok") {
    observation = { ...observation, status: permissionState.app === "denied" ? "permission" : "unavailable" };
  }
  broadcast();
  return permissionState;
}

function handleSample(ctx, meta) {
  if (ctx) {
    observation = {
      status: "ok",
      application: ctx.application,
      windowTitle: ctx.windowTitle ?? null,
      documentName: ctx.documentName,
      browserDomain: ctx.browserDomain,
      idleSeconds: ctx.idleSeconds,
      idle: !!meta.idle,
      at: meta.at,
    };
    // Samples succeeding is the signal that permissions are fine again —
    // the banner clears on its own, without a manual re-check.
    if (permissionState.needsAttention || permissionState.app !== "ok") refreshPermissions({ probe: false });
    else broadcast();
  } else {
    observation = { status: permissionState.app === "denied" ? "permission" : "unavailable", at: meta.at, failures: meta.failures };
    broadcast();
  }
}

function createTracker({ onBucket }) {
  return new ActivityTracker({
    sampleIntervalMs: config.SAMPLE_INTERVAL_MS,
    getContext: workContext.getCurrentWorkContext,
    onBucket,
    onSample: handleSample,
    onPermissionIssue: () => refreshPermissions({ probe: false }),
    idleThresholdSeconds: config.IDLE_THRESHOLD_SECONDS,
    minBucketSeconds: config.MIN_BUCKET_SECONDS,
    maxBucketSeconds: config.MAX_BUCKET_SECONDS,
  });
}

// ---------------------------------------------------------------------
// Pending report persistence (survives a restart)
// ---------------------------------------------------------------------
function persistReport() {
  const file = userDataPath("pending-report.json");
  try {
    if (workMode.state === STATES.ENDED_PENDING_REPORT && workMode.report) {
      fs.writeFileSync(file, JSON.stringify({ userId: session?.user?.id ?? null, report: workMode.report }));
    } else {
      fs.rmSync(file, { force: true });
    }
  } catch (err) {
    console.error("[report] persist failed:", err);
  }
}
function restoreReport() {
  try {
    const raw = JSON.parse(fs.readFileSync(userDataPath("pending-report.json"), "utf8"));
    if (raw?.report && raw.userId === session?.user?.id) workMode.restoreReport(raw.report);
  } catch {
    // none pending
  }
}

// ---------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------
function getToken() {
  return session?.token ?? null;
}

function handleSessionExpired(message) {
  if (!session || loggingOut) return;
  session = null;
  authStore.clearSession();
  sessionExpired = message || "Session expired — sign in again.";
  task = null;
  completion = null;
  workMode.forceOff("session-expired").catch(() => {});
  broadcast();
}

async function refreshTask() {
  if (!session) return;
  try {
    const next = await api.getNextBest(session.token);
    const rec = next?.recommended;
    task = rec?.task ? { id: rec.task.id, title: rec.task.title, status: rec.task.status ?? null, reason: rec.reason ?? null, blockingCount: rec.blockingCount ?? 0 } : null;
    taskFetchedAt = Date.now();
  } catch (err) {
    if (err?.network) noteConnectionFail(err);
    // Non-critical — the previous recommendation stays on screen.
  }
}

async function reconcileTick() {
  if (!session || !workMode) return;
  try {
    await workMode.reconcile();
    noteConnectionOk();
    // Anything still queued (a restart mid-shift, a connection that just
    // came back) goes out now rather than at the next 5-minute flush.
    // Backoff is respected, so a server that is up but refusing is not
    // hammered every 10 seconds.
    if (outbox.size > 0) await flushOutbox();
    // A missed unlock-screen event must never leave sampling paused for a
    // whole shift: if the OS says we're not locked, clear that reason.
    if (pauseReasons.has("locked")) {
      try {
        if (powerMonitor.getSystemIdleState(1) !== "locked") resumeFor("locked");
      } catch { /* unsupported — leave it to the unlock event */ }
    }
    if (workMode.isOn && Date.now() - taskFetchedAt > config.TASK_REFRESH_MS) await refreshTask();
    else if (!task && Date.now() - taskFetchedAt > config.TASK_REFRESH_MS * 5) await refreshTask();
  } catch (err) {
    if (err?.network || err?.status >= 500) noteConnectionFail(err);
    else if (err?.status !== 401) console.error("[reconcile] failed:", err);
  }
  broadcast();
}

function scheduleReconcile(delayMs) {
  if (reconcileTimer) clearTimeout(reconcileTimer);
  reconcileTimer = setTimeout(async () => {
    await reconcileTick();
    scheduleReconcile(workMode?.isOn ? config.RECONCILE_ACTIVE_MS : config.RECONCILE_IDLE_MS);
  }, delayMs);
}

async function flushOutbox({ force = false } = {}) {
  if (!session || !workMode) return;
  try {
    const result = await workMode.flush({ force });
    if (result.failed) noteConnectionFail(outbox.lastError || new Error("flush failed"));
    else if (!result.skipped) noteConnectionOk();
  } catch (err) {
    noteConnectionFail(err);
  }
  broadcast();
}

function pauseFor(reason) {
  pauseReasons.add(reason);
  workMode?.pause(reason);
}
function resumeFor(reason) {
  pauseReasons.delete(reason);
  if (pauseReasons.size === 0) {
    workMode?.resume();
  } else {
    workMode?.pause([...pauseReasons][0]);
  }
}

async function ipcStartWork() {
  if (!session) return { ok: false, error: "Not signed in." };
  try {
    const snap = await workMode.start();
    noteConnectionOk();
    // Switch to the active cadence now, not after the pending idle tick:
    // a revoked device or a server-side end must be noticed within seconds.
    scheduleReconcile(config.RECONCILE_ACTIVE_MS);
    refreshTask().then(broadcast);
    broadcast();
    return { ok: true, work: snap };
  } catch (err) {
    if (err?.network) noteConnectionFail(err);
    broadcast();
    return { ok: false, error: err?.message || "Couldn't start Work Mode.", status: err?.status ?? null };
  }
}

// ---------------------------------------------------------------------
// IPC — every handler returns { ok, ... } rather than throwing so the
// renderer gets clean messages, never "Error invoking remote method".
// ---------------------------------------------------------------------
function handle(channel, fn) {
  ipcMain.handle(channel, async (event, payload) => {
    if (event.sender !== mainWindow?.webContents) return { ok: false, error: "Unknown sender." };
    try {
      const result = await fn(payload || {});
      return result && typeof result === "object" && "ok" in result ? result : { ok: true, ...(result || {}) };
    } catch (err) {
      console.error(`[ipc:${channel}]`, err);
      return { ok: false, error: err?.message || "Something went wrong.", status: err?.status ?? null };
    }
  });
}

handle("get-state", async () => ({ ok: true, state: buildState() }));

handle("login", async ({ email, password }) => {
  const e = typeof email === "string" ? email.trim() : "";
  const p = typeof password === "string" ? password : "";
  if (!e || !p) return { ok: false, error: "Enter your email and password." };
  const result = await api.login(e, p);
  if (!result?.token || !result?.user) return { ok: false, error: "Unexpected response from the server." };
  if (result.user.role !== "intern") {
    return { ok: false, error: "The Companion is for interns. Admins use the web app." };
  }
  if (session?.user?.id && session.user.id !== result.user.id) outbox.clear();
  session = { token: result.token, user: result.user };
  authStore.saveSession(session);
  sessionExpired = null;
  noteConnectionOk();
  restoreReport();
  await reconcileTick();
  await refreshTask();
  scheduleReconcile(workMode.isOn ? config.RECONCILE_ACTIVE_MS : config.RECONCILE_IDLE_MS);
  broadcast();
  return { ok: true, user: session.user };
});

handle("logout", async () => {
  if (!session) return { ok: true };
  if (workMode.state !== STATES.OFF && workMode.state !== STATES.ENDED_PENDING_REPORT) {
    return { ok: false, error: "End your shift before signing out." };
  }
  loggingOut = true;
  const token = session.token;
  try {
    await flushOutbox({ force: true });
    // Logout = revoke this device on the server. The login response carries
    // no device id, so find ours in the list: the server marks the caller's
    // own device `isCurrent`; fall back to the most recently seen Companion.
    try {
      const devices = await api.getDevices(token);
      const live = (devices || []).filter((d) => !d.revokedAt);
      const mine = live.find((d) => d.isCurrent)
        || live.filter((d) => /companion/i.test(d.name || "") || /companion/i.test(d.browser || "")).sort((a, b) => new Date(b.lastSeenAt) - new Date(a.lastSeenAt))[0];
      if (mine) await api.revokeDevice(token, mine.id);
      else console.warn("[logout] could not identify this device on the server; token not revoked server-side");
    } catch (err) {
      console.warn("[logout] device revoke failed:", err?.message);
    }
  } finally {
    session = null;
    sessionExpired = null;
    task = null;
    completion = null;
    authStore.clearSession();
    await workMode.forceOff("signed-out");
    workMode.dismissReport();
    persistReport();
    loggingOut = false;
    broadcast();
  }
  return { ok: true };
});

handle("acknowledge-expired", async () => {
  sessionExpired = null;
  broadcast();
  return { ok: true };
});

handle("start-work", () => ipcStartWork());

handle("stop-work", async () => {
  if (!session) return { ok: false, error: "Not signed in." };
  try {
    const snap = await workMode.stop();
    noteConnectionOk();
    scheduleReconcile(config.RECONCILE_IDLE_MS);
    persistReport();
    broadcast();
    return { ok: true, work: snap };
  } catch (err) {
    if (err?.network) noteConnectionFail(err);
    broadcast();
    return { ok: false, error: err?.message || "Couldn't end the shift.", status: err?.status ?? null };
  }
});

handle("submit-report", async ({ note }) => {
  if (!session) return { ok: false, error: "Not signed in." };
  const pending = workMode.report;
  if (!pending?.sessionId) return { ok: false, error: "There is no report to submit." };
  const text = typeof note === "string" ? note.trim().slice(0, 1000) : "";
  try {
    if (text) await api.updateSummary(session.token, pending.sessionId, text);
    await api.submitSummary(session.token, pending.sessionId);
  } catch (err) {
    if (!(err?.status === 400 && /already been submitted/i.test(err.message || ""))) throw err;
  }
  noteConnectionOk();
  completion = { endedAt: pending.endedAt ?? new Date().toISOString(), durationSeconds: pending.report?.durationSeconds ?? null };
  workMode.markReportSubmitted();
  persistReport();
  broadcast();
  return { ok: true };
});

handle("discard-report", async () => {
  workMode.dismissReport();
  persistReport();
  broadcast();
  return { ok: true };
});

handle("check-permissions", async () => ({ ok: true, permissions: await refreshPermissions({ probe: true }) }));

handle("open-permission-settings", async ({ which }) => {
  const target = which === "automation" ? "automation" : "accessibility";
  return { ok: permissions.openSettings(target) };
});

handle("open-web", async ({ path: p }) => {
  const suffix = typeof p === "string" && /^\/(?!\/)[\w\-./?=&%]*$/.test(p) ? p : "";
  await shell.openExternal(`${config.WEB_URL}${suffix}`);
  return { ok: true };
});

handle("check-updates", async () => {
  updater.checkForUpdates({ manual: true });
  return { ok: true };
});

handle("install-update", async () => ({ ok: updater.installNow() }));

// ---------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------
app.whenReady().then(async () => {
  if (!config.API_URL_CHECK.ok) {
    dialog.showErrorBox("InternOps Companion can't start", config.API_URL_CHECK.reason);
    app.exit(1);
    return;
  }
  api.configure({ version: app.getVersion(), platform: process.platform, onUnauthorized: handleSessionExpired });

  outbox = new Outbox({ filePath: userDataPath("outbox.jsonl"), maxRowsPerRequest: config.MAX_ROWS_PER_REQUEST });
  workMode = new WorkMode({
    api,
    getToken,
    createTracker,
    outbox,
    onChange: () => {
      updater.syncInstallOnQuit();
      if (workMode.state === STATES.STARTING || workMode.state === STATES.ON) completion = null;
      if (workMode.state === STATES.OFF || workMode.state === STATES.ENDED_PENDING_REPORT) persistReport();
      if (workMode.state !== STATES.ON) observation = { status: "unavailable", at: null };
      broadcast();
    },
  });

  session = authStore.loadSession();
  if (session && (!session.token || !session.user)) session = null;
  if (session) restoreReport();

  buildAppMenu();
  createTray();
  createWindow();

  // Lock/sleep are hard activity boundaries: sampling pauses (open bucket
  // closed with what was really observed) and resumes afterwards; locked
  // time is never counted. Wake also retries the outbox and reconciles.
  powerMonitor.on("suspend", () => pauseFor("sleep"));
  powerMonitor.on("lock-screen", () => pauseFor("locked"));
  powerMonitor.on("resume", () => {
    resumeFor("sleep");
    flushOutbox({ force: true });
    scheduleReconcile(1000);
  });
  powerMonitor.on("unlock-screen", () => {
    resumeFor("locked");
    flushOutbox({ force: true });
    scheduleReconcile(1000);
  });
  powerMonitor.on("shutdown", () => {
    workMode.tracker?.stop();
  });

  updater.setup({
    isWorkModeActiveFn: () => workMode.state !== STATES.OFF && workMode.state !== STATES.ENDED_PENDING_REPORT,
    onStatusFn: (status) => {
      updateStatus = status;
      broadcast();
    },
  });
  updater.syncInstallOnQuit();
  updater.checkForUpdates();
  setInterval(() => updater.checkForUpdates(), config.UPDATE_CHECK_INTERVAL_MS);

  flushTimer = setInterval(() => flushOutbox(), config.FLUSH_INTERVAL_MS);
  if (isMac) refreshPermissions({ probe: false });
  scheduleReconcile(0);
  if (session) refreshTask().then(broadcast);
});

app.on("activate", () => showWindow());

// Tray app: closing the last window never quits (close already hides).
app.on("window-all-closed", () => {});

app.on("before-quit", (e) => {
  if (quitting) return;
  quitting = true;
  if (reconcileTimer) clearTimeout(reconcileTimer);
  if (flushTimer) clearInterval(flushTimer);
  if (trayTimer) clearInterval(trayTimer);
  // Stop sampling now (closes the open bucket into the outbox file —
  // synchronous, nothing lost) but do NOT end the shift: the UI tells the
  // user a quit leaves it active on the server.
  workMode?.tracker?.stop();
  workContext.shutdown();
  if (session && outbox && outbox.size > 0) {
    e.preventDefault();
    const deadline = new Promise((resolve) => setTimeout(resolve, 5000));
    Promise.race([workMode.flush({ force: true }).catch(() => {}), deadline]).finally(() => app.quit());
  }
});
