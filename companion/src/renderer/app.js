// Renderer: pure view of the main process's state. The only local state
// here is navigation (which screen is on top) and in-flight button
// busy-ness. Every string goes through textContent — never innerHTML.
//
// Visible states, by name: "Sign in to InternOps", "Ready to work",
// "Connecting…", "Working", "Ending…", "Work session complete",
// "Session expired"; connection row: "Connected" / "Connecting…" /
// "Connection lost — retrying"; observation card: "Permission required" /
// "Observation unavailable".
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const api = window.internops;

  const views = {
    login: $("view-login"),
    expired: $("view-expired"),
    home: $("view-home"),
    report: $("view-report"),
    permissions: $("view-permissions"),
  };

  let state = null;
  let localView = null; // null | "permissions"
  let reportHidden = false; // user pressed "Later"
  let timerHandle = null;
  let lastReportSessionId = null;
  const inflight = { start: false, stop: false };

  // ---------- helpers ----------
  function formatHMS(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
  }
  function formatShort(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    if (h === 0 && m === 0) return `${s}s`;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }
  function setBusy(btn, busy) {
    btn.disabled = !!busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  }
  function showError(el, message) {
    if (!message) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.textContent = message;
    el.hidden = false;
  }
  function setDot(el, tone) {
    el.className = el.className.split(" ").filter((c) => !c.startsWith("dot-") || c === "dot-sm").join(" ");
    if (tone) el.classList.add(`dot-${tone}`);
  }

  // ---------- view resolution ----------
  function resolveView() {
    if (!state) return "login";
    // A gone session outranks any local screen: "Session expired" must be
    // impossible to miss, even if Permissions was open at the time.
    if (state.auth.expired) return "expired";
    if (localView === "permissions") return "permissions";
    if (!state.auth.loggedIn) return "login";
    if (state.work.state === "ENDED_PENDING_REPORT" && !reportHidden) return "report";
    return "home";
  }
  function showView(name) {
    for (const [key, el] of Object.entries(views)) el.hidden = key !== name;
  }

  // ---------- render ----------
  function render() {
    if (!state) return;
    document.body.dataset.platform = state.platform;
    $("app-version").textContent = `v${state.appVersion}`;
    $("btn-perms").dataset.attention = state.permissions?.needsAttention ? "true" : "false";

    const view = resolveView();
    showView(view);
    if (view === "home") renderHome();
    if (view === "report") renderReport();
    if (view === "permissions") renderPermissions();
    if (view === "expired") $("expired-message").textContent = state.auth.expired || "";
    if (view !== "home") stopTimer();
  }

  // Short, human status for each observed signal — shared by the Ready
  // card and the Observed card so the story is the same before and during
  // a shift.
  function signalSummary(p) {
    const mac = p?.platform === "macos";
    const gateLabel = (g) => (g === "both" ? "Needs Automation and Accessibility" : g === "automation" ? "Needs Automation permission" : "Needs Accessibility permission");
    const app = p?.app === "ok" ? ["ok", "Observed"] : p?.app === "denied" ? ["denied", "Permission required"] : p?.app === "unsupported" ? ["unknown", "Not on this platform"] : ["unknown", "Available"];
    const title = p?.windowTitle === "ok" ? ["ok", "Observed"]
      : p?.windowTitle === "denied" ? ["denied", gateLabel(p.windowTitleGate)]
      : p?.windowTitle === "unsupported" ? ["unknown", "Not on this platform"]
      : mac ? ["unknown", "Needs Accessibility"] : ["unknown", "Available"];
    const browser = p?.browserDomain === "ok" ? ["ok", p.browser ? `Observed in ${p.browser}` : "Observed"]
      : p?.browserDomain === "denied" ? ["denied", p.browser ? `Not allowed for ${p.browser}` : "Not allowed"]
      : p?.browserDomain === "unsupported" ? ["unknown", "Not on this platform"]
      : mac ? ["unknown", "Asked per browser"] : ["unknown", "Best effort"];
    return { app, title, browser };
  }

  function renderHome() {
    const work = state.work;
    const on = work.state === "ON";
    // A Start that is still waiting for the server (even queued behind an
    // in-flight request) is "Connecting…" from the user's point of view.
    const starting = work.state === "STARTING" || (inflight.start && work.state === "OFF");
    const busy = starting || work.state === "STOPPING";
    const done = work.state === "OFF" && !!state.completion && !starting;
    const dot = $("status-dot");
    const label = $("status-label");
    const sub = $("status-sub");

    if (starting) {
      setDot(dot, "accent"); label.textContent = "Connecting…"; sub.textContent = "Opening your shift.";
    } else if (work.state === "STOPPING") {
      setDot(dot, "accent"); label.textContent = "Ending…"; sub.textContent = "Observation has stopped. Sending what's left and closing the shift.";
    } else if (on && work.paused) {
      setDot(dot, "warn");
      label.textContent = "Paused";
      sub.textContent = work.pauseReason === "sleep" ? "Nothing is observed while asleep. The shift stays open." : "Nothing is observed while locked. The shift stays open.";
    } else if (on) {
      setDot(dot, "work"); label.textContent = "Working"; sub.textContent = "Observing the application in front.";
    } else if (done) {
      setDot(dot, "ok"); label.textContent = "Work session complete";
      const dur = state.completion.durationSeconds;
      sub.textContent = dur != null ? `Report submitted · ${formatShort(dur)} recorded.` : "Report submitted.";
    } else {
      setDot(dot, null); label.textContent = "Ready to work"; sub.textContent = "Nothing is observed until you start.";
    }

    // Timer
    if (on && work.session?.startedAt) startTimer(work.session.startedAt);
    else stopTimer();

    $("server-ended").hidden = !(work.state === "OFF" && work.endedReason === "server");
    showError($("work-error"), work.lastError && !on && work.state === "OFF" ? work.lastError.message : null);
    $("pending-chip").hidden = work.state !== "ENDED_PENDING_REPORT";

    // Task
    const task = state.task;
    const taskCard = $("task-card");
    if (task) {
      taskCard.hidden = false;
      $("task-title").textContent = task.title;
      $("task-reason").textContent = task.reason || "Recommended next";
    } else {
      taskCard.hidden = !on;
      $("task-title").textContent = "No task recommended right now";
      $("task-reason").textContent = "";
    }

    // Observation (while on) / what will be observed (while off)
    const perms = state.permissions || {};
    const sig = signalSummary(perms);
    const obs = state.observation || {};
    const obsCard = $("observe-card");
    const missing = $("observe-missing");
    obsCard.hidden = !on;
    missing.hidden = true;
    if (on) {
      if (work.paused) {
        obsCard.dataset.tone = "muted";
        $("observe-primary").textContent = "Paused";
        $("observe-secondary").textContent = work.pauseReason === "sleep" ? "Resumes when the Mac wakes." : "Resumes when you unlock.";
      } else if (obs.status === "ok") {
        obsCard.dataset.tone = "";
        const detail = obs.documentName || obs.browserDomain || "";
        $("observe-primary").textContent = detail ? `${obs.application} — ${detail}` : obs.application;
        const parts = [];
        if (obs.idle) parts.push(`No input for ${formatShort(obs.idleSeconds)} — recorded as idle`);
        else if (typeof obs.idleSeconds === "number" && obs.idleSeconds >= 60) parts.push(`No input for ${formatShort(obs.idleSeconds)}`);
        if (obs.browserDomain && obs.documentName) parts.push(obs.browserDomain);
        if (!obs.documentName && obs.windowTitle) parts.push("Window title observed");
        $("observe-secondary").textContent = parts.join(" · ") || "Application in front";
        if (sig.title[0] === "denied") {
          missing.hidden = false;
          $("observe-missing-text").textContent = `Window title: ${sig.title[1].replace(/^Needs /, "needs ")}`;
        } else if (sig.browser[0] === "denied") {
          missing.hidden = false;
          $("observe-missing-text").textContent = `Browser domain: ${sig.browser[1].replace(/^Not allowed/, "not allowed")}`;
        }
      } else if (obs.status === "permission") {
        obsCard.dataset.tone = "warn";
        $("observe-primary").textContent = "Permission required";
        $("observe-secondary").textContent = "The Companion can't see which application is in front. The shift is still timed.";
        missing.hidden = false;
        $("observe-missing-text").textContent = "Grant permission to observe";
      } else if (!obs.at) {
        obsCard.dataset.tone = "muted";
        $("observe-primary").textContent = "Observing…";
        $("observe-secondary").textContent = "The first sample lands in a moment.";
      } else {
        obsCard.dataset.tone = "muted";
        $("observe-primary").textContent = "Observation unavailable";
        $("observe-secondary").textContent = "No application in front could be read. The shift is still timed.";
      }
    }

    const signalsCard = $("signals-card");
    signalsCard.hidden = on || busy;
    if (!on) {
      for (const [id, [status, text]] of [["signal-app", sig.app], ["signal-title", sig.title], ["signal-browser", sig.browser]]) {
        const el = $(id);
        el.dataset.status = status;
        el.textContent = text;
      }
    }

    // Connection
    const conn = state.connection || {};
    const connRow = $("connection");
    connRow.hidden = false;
    connRow.dataset.status = conn.status || "connected";
    const lost = conn.status === "offline" || conn.status === "reconnecting";
    $("conn-label").textContent = lost ? "Connection lost — retrying" : conn.status === "connecting" ? "Connecting…" : "Connected";
    $("conn-queued").textContent = conn.queued > 0 ? `· ${conn.queued} queued` : "";

    // Buttons
    const start = $("btn-start");
    const stop = $("btn-stop");
    start.hidden = on || work.state === "STOPPING";
    stop.hidden = !(on || work.state === "STOPPING");
    setBusy(start, starting);
    setBusy(stop, work.state === "STOPPING" || inflight.stop);
    start.querySelector(".btn-label").textContent = starting ? "Connecting…" : done ? "Start another shift" : "Start Work Mode";
    stop.querySelector(".btn-label").textContent = work.state === "STOPPING" ? "Ending…" : "End shift";
    $("quit-note").hidden = !on;
    $("btn-logout").hidden = on || busy;
    $("sep-logout").hidden = on || busy;

    renderUpdate(state.update);
  }

  function renderUpdate(u) {
    const banner = $("update-banner");
    const msg = $("update-message");
    const install = $("btn-install-update");
    install.hidden = true;
    banner.dataset.tone = "";
    const recentlyChecked = u?.checkedAt && Date.now() - u.checkedAt < 8000;
    if (!u || u.state === "idle" || u.state === "checking" || (u.state === "up-to-date" && !recentlyChecked)) {
      banner.hidden = true;
      return;
    }
    banner.hidden = false;
    switch (u.state) {
      case "up-to-date": msg.textContent = "You're on the latest version."; break;
      case "available": msg.textContent = `Update ${u.version} — downloading…`; break;
      case "deferred": msg.textContent = `Update ${u.version} will download once the shift ends.`; break;
      case "downloading": msg.textContent = `Downloading update… ${u.percent}%`; break;
      case "downloaded": msg.textContent = `Update ${u.version} downloaded — installs after the shift.`; break;
      case "ready-to-install": msg.textContent = `Update ${u.version} is ready.`; install.hidden = false; break;
      case "error":
        if (!u.manual) { banner.hidden = true; return; }
        banner.dataset.tone = "error";
        msg.textContent = "Couldn't check for updates right now.";
        break;
      default: banner.hidden = true;
    }
  }

  function renderReport() {
    const pending = state.work.report;
    const report = pending?.report || {};
    if (pending?.sessionId !== lastReportSessionId) {
      $("r-note").value = "";
      showError($("report-error"), null);
      lastReportSessionId = pending?.sessionId ?? null;
    }
    $("r-duration").textContent = formatShort(report.durationSeconds ?? pending?.summary?.durationSeconds ?? 0);
    $("r-completed").textContent = String(report.tasksCompleted ?? 0);
    $("r-submitted").textContent = String(report.tasksSubmitted ?? 0);
    const nextRow = $("r-next-row");
    if (report.nextStep) { $("r-next").textContent = report.nextStep; nextRow.hidden = false; } else nextRow.hidden = true;

    const list = $("r-activity");
    list.replaceChildren();
    const breakdown = Array.isArray(report.activityBreakdown) ? report.activityBreakdown : [];
    if (breakdown.length === 0) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No desktop activity was observed this shift.";
      list.appendChild(li);
    } else {
      for (const item of breakdown) {
        const li = document.createElement("li");
        const name = document.createElement("span");
        name.textContent = item.label || item.category || "Other";
        const dur = document.createElement("span");
        dur.className = "t-num";
        dur.textContent = formatShort(item.seconds);
        li.append(name, dur);
        list.appendChild(li);
      }
    }
  }

  const BADGE = {
    ok: "Granted",
    denied: "Not granted",
    error: "Unavailable",
    unknown: "Not yet observed",
    unsupported: "Unsupported",
  };
  function renderPermissions() {
    const p = state.permissions || {};
    const mac = p.platform === "macos";
    $("perm-intro").textContent = mac
      ? "macOS asks separately for each signal. Grant what you're comfortable with."
      : p.platform === "windows"
        ? "Windows doesn't ask for permission for these signals. Statuses reflect what the last samples could read."
        : "Activity observation isn't available on this platform. Shifts are still timed.";
    const gate = p.windowTitleGate;
    const titleHint = !mac ? "Text of the window in front"
      : p.windowTitle === "denied" ? (gate === "both" ? "Allow the Companion in Automation and Accessibility" : gate === "automation" ? "Allow the Companion to control System Events" : "Allow the Companion in Accessibility")
      : "Needs Accessibility";
    const browserHint = !mac ? "Address bar, best effort"
      : p.browser ? (p.browserDomain === "denied" ? `Allow the Companion to control ${p.browser}` : `Asked once ${p.browser} is in front`) : "Asked the first time a browser is in front";
    const rows = [
      ["perm-app", mac && p.app !== "denied" ? (p.app === "ok" ? "ok" : "unknown") : p.app, "perm-app-hint", mac ? "No permission needed" : "Window in front"],
      ["perm-title", p.windowTitle, "perm-title-hint", titleHint],
      ["perm-browser", p.browserDomain, "perm-browser-hint", browserHint],
    ];
    for (const [id, status, hintId, hint] of rows) {
      const badge = $(id);
      const s = status || "unknown";
      badge.dataset.status = s;
      badge.textContent = id === "perm-app" && mac && s === "unknown" ? "Available" : BADGE[s] || s;
      $(hintId).textContent = hint;
    }
    $("btn-open-accessibility").hidden = !(mac && p.windowTitle === "denied");
    $("btn-open-accessibility").dataset.target = gate === "automation" || gate === "both" ? "automation" : "accessibility";
    $("btn-open-automation").hidden = !(mac && p.browserDomain === "denied");
  }

  // ---------- timer ----------
  function startTimer(startedAt) {
    const started = new Date(startedAt).getTime();
    const el = $("timer");
    const tick = () => { el.textContent = formatHMS((Date.now() - started) / 1000); };
    if (timerHandle) clearInterval(timerHandle);
    tick();
    el.hidden = false;
    timerHandle = setInterval(tick, 1000);
  }
  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
    $("timer").hidden = true;
  }

  // ---------- actions ----------
  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("login-submit");
    if (btn.disabled) return;
    const errorEl = $("login-error");
    const email = $("login-email").value.trim();
    const password = $("login-password").value;
    showError(errorEl, null);
    if (!email || !password) { showError(errorEl, "Enter your email and password."); return; }
    setBusy(btn, true);
    try {
      const res = await api.login(email, password);
      if (!res.ok) { showError(errorEl, res.error || "Couldn't sign in."); return; }
      $("login-password").value = "";
      reportHidden = false;
    } finally {
      setBusy(btn, false);
    }
  });

  $("btn-expired-signin").addEventListener("click", async () => {
    await api.acknowledgeExpired();
    $("login-email").focus();
  });

  $("btn-start").addEventListener("click", async () => {
    if (inflight.start) return;
    inflight.start = true;
    showError($("work-error"), null);
    render();
    try {
      const res = await api.startWork();
      if (!res.ok) showError($("work-error"), res.error || "Couldn't start Work Mode.");
      else reportHidden = false;
    } finally {
      inflight.start = false;
      render();
    }
  });

  async function endShift() {
    if (inflight.stop) return;
    inflight.stop = true;
    showError($("work-error"), null);
    render();
    try {
      const res = await api.stopWork();
      if (!res.ok) showError($("work-error"), `${res.error || "Couldn't end the shift."} The shift is still active and observation continues.`);
      else reportHidden = false;
    } finally {
      inflight.stop = false;
      render();
    }
  }
  const dlgEnd = $("dlg-end");
  $("btn-stop").addEventListener("click", () => {
    if (inflight.stop || dlgEnd.open) return;
    dlgEnd.returnValue = "";
    dlgEnd.showModal();
    $("dlg-end-confirm").focus();
  });
  dlgEnd.addEventListener("close", () => { if (dlgEnd.returnValue === "confirm") endShift(); });

  $("btn-logout").addEventListener("click", async () => {
    const btn = $("btn-logout");
    btn.disabled = true;
    try {
      const res = await api.logout();
      if (!res.ok) showError($("work-error"), res.error);
      else { reportHidden = false; localView = null; }
    } finally {
      btn.disabled = false;
    }
  });

  $("btn-open-web").addEventListener("click", () => api.openWeb("/work"));
  $("btn-open-report").addEventListener("click", () => { reportHidden = false; render(); });

  $("btn-submit-report").addEventListener("click", async () => {
    const btn = $("btn-submit-report");
    if (btn.disabled) return;
    setBusy(btn, true);
    showError($("report-error"), null);
    try {
      const res = await api.submitReport($("r-note").value);
      if (!res.ok) showError($("report-error"), res.error || "Couldn't submit the report.");
    } finally {
      setBusy(btn, false);
    }
  });
  $("btn-report-later").addEventListener("click", () => { reportHidden = true; render(); });
  const dlgDiscard = $("dlg-discard");
  $("btn-report-discard").addEventListener("click", () => { if (!dlgDiscard.open) { dlgDiscard.returnValue = ""; dlgDiscard.showModal(); } });
  dlgDiscard.addEventListener("close", async () => {
    if (dlgDiscard.returnValue === "confirm") await api.discardReport();
  });

  // Permissions
  function openPermissions() { localView = "permissions"; render(); api.checkPermissions(); }
  $("btn-perms").addEventListener("click", openPermissions);
  $("btn-fix-perms").addEventListener("click", openPermissions);
  $("btn-perms-back").addEventListener("click", () => { localView = null; render(); });
  $("btn-open-accessibility").addEventListener("click", (e) => api.openPermissionSettings(e.currentTarget.dataset.target === "automation" ? "automation" : "accessibility"));
  $("btn-open-automation").addEventListener("click", () => api.openPermissionSettings("automation"));
  $("btn-recheck").addEventListener("click", async () => {
    const btn = $("btn-recheck");
    setBusy(btn, true);
    try { await api.checkPermissions(); } finally { setBusy(btn, false); }
  });

  $("btn-install-update").addEventListener("click", () => api.installUpdate());

  // Escape leaves the permissions screen (dialogs handle their own Escape).
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && localView === "permissions" && !dlgEnd.open && !dlgDiscard.open) { localView = null; render(); }
  });

  // ---------- wiring ----------
  api.onState((next) => {
    const wasLoggedIn = state?.auth?.loggedIn;
    state = next;
    if (wasLoggedIn && !next.auth.loggedIn) { reportHidden = false; localView = null; stopTimer(); }
    render();
  });
  api.onNavigate((view) => {
    if (view === "permissions") { localView = "permissions"; render(); api.checkPermissions(); }
    else if (view === "report") { localView = null; reportHidden = false; render(); }
    else if (view === "confirm-end") { localView = null; render(); if (state?.work?.state === "ON" && !dlgEnd.open) { dlgEnd.returnValue = ""; dlgEnd.showModal(); } }
    else { localView = null; render(); }
  });
  api.getState().then((res) => { if (res?.ok) { state = res.state; render(); } });
})();
