const views = {
  login: document.getElementById("view-login"),
  home: document.getElementById("view-home"),
  report: document.getElementById("view-report"),
};
function showView(name) {
  Object.values(views).forEach((v) => v.classList.add("hidden"));
  views[name].classList.remove("hidden");
}

let timerInterval = null;
let currentSessionId = null;

function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}
function formatDurationShort(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.round((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function startTimer(startedAt) {
  stopTimer();
  const started = new Date(startedAt).getTime();
  const el = document.getElementById("timer");
  el.classList.remove("hidden");
  timerInterval = setInterval(() => {
    el.textContent = formatDuration((Date.now() - started) / 1000);
  }, 1000);
}
function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  document.getElementById("timer").classList.add("hidden");
}

async function refreshStatus() {
  // The report view is a deliberate stop for the intern to review and
  // submit — the background poll below must never yank them back to the
  // home screen mid-review just because a status check happened to land
  // at that moment.
  if (!views.report.classList.contains("hidden")) return null;
  const status = await window.internops.getStatus();
  if (status.appVersion) document.getElementById("app-version").textContent = `v${status.appVersion}`;
  if (!status.loggedIn) {
    showView("login");
    return status;
  }
  showView("home");
  const dot = document.getElementById("status-dot");
  const label = document.getElementById("status-label");
  const trackingState = document.getElementById("tracking-state");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");
  const taskEl = document.getElementById("current-task");
  const contextEl = document.getElementById("current-context");

  const working = !!(status.workModeActive && status.activeSession);
  if (working) {
    dot.classList.add("on");
    dot.classList.remove("off");
    label.textContent = "Work Mode";
    trackingState.textContent = "Activity tracking is ON.";
    trackingState.classList.remove("off");
    trackingState.classList.add("on");
    btnStart.classList.add("hidden");
    btnStop.classList.remove("hidden");
    startTimer(status.activeSession.startedAt);
  } else {
    dot.classList.remove("on");
    dot.classList.add("off");
    label.textContent = "Not Working";
    trackingState.textContent = "Activity tracking is OFF.";
    trackingState.classList.remove("on");
    trackingState.classList.add("off");
    btnStart.classList.remove("hidden");
    btnStop.classList.add("hidden");
    stopTimer();
  }

  if (status.currentTask) {
    taskEl.classList.remove("hidden");
    taskEl.innerHTML = `<span class="label">Current Task</span>${status.currentTask.title}`;
  } else {
    taskEl.classList.add("hidden");
  }

  renderCurrentContext(contextEl, working ? status.currentContext : null);
  return status;
}

// The one place the intern can see, live, exactly what Work Mode currently
// sees — no field here is ever invented; anything the OS didn't hand back
// is simply left out rather than shown as a guess.
function renderCurrentContext(contextEl, ctx) {
  if (!ctx || !ctx.application) {
    contextEl.classList.add("hidden");
    return;
  }
  contextEl.classList.remove("hidden");
  document.getElementById("context-app").textContent = ctx.application;
  const detailParts = [];
  if (ctx.browserDomain) detailParts.push(ctx.browserDomain);
  else if (ctx.documentName) detailParts.push(ctx.documentName);
  if (typeof ctx.idleSeconds === "number" && ctx.idleSeconds >= 60) {
    detailParts.push(`idle ${Math.round(ctx.idleSeconds / 60)}m`);
  }
  document.getElementById("context-detail").textContent = detailParts.join(" · ");
}

document.getElementById("login-submit").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.classList.add("hidden");
  if (!email || !password) return;
  try {
    await window.internops.login(email, password);
    document.getElementById("login-password").value = "";
    await refreshStatus();
  } catch (err) {
    errorEl.textContent = err.message || "Couldn't sign in.";
    errorEl.classList.remove("hidden");
  }
});

document.getElementById("btn-start").addEventListener("click", async () => {
  try {
    document.getElementById("permission-warning").classList.add("hidden");
    await window.internops.startWorkMode();
    await refreshStatus();
  } catch (err) {
    alert(err.message || "Couldn't start Work Mode.");
  }
});

document.getElementById("btn-stop").addEventListener("click", async () => {
  try {
    const result = await window.internops.stopWorkMode();
    stopTimer();
    currentSessionId = result.session.id;
    renderReport(result.report);
    showView("report");
  } catch (err) {
    alert(err.message || "Couldn't end shift.");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  await window.internops.logout();
  stopTimer();
  showView("login");
});

function renderReport(report) {
  document.getElementById("r-duration").textContent = formatDurationShort(report.durationSeconds);
  document.getElementById("r-completed").textContent = report.tasksCompleted;
  document.getElementById("r-submitted").textContent = report.tasksSubmitted;

  const nextRow = document.getElementById("r-next-row");
  if (report.nextStep) {
    document.getElementById("r-next").textContent = report.nextStep;
    nextRow.classList.remove("hidden");
  } else {
    nextRow.classList.add("hidden");
  }

  const projectRow = document.getElementById("r-project-row");
  projectRow.classList.add("hidden"); // filled in only if we have a project title; kept simple for v1

  const activityList = document.getElementById("r-activity");
  activityList.innerHTML = "";
  if (!report.activityBreakdown || report.activityBreakdown.length === 0) {
    activityList.innerHTML = `<li><span>No desktop activity recorded this shift</span></li>`;
  } else {
    for (const item of report.activityBreakdown) {
      const li = document.createElement("li");
      li.innerHTML = `<span>${item.label}</span><span>~${formatDurationShort(item.seconds)}</span>`;
      activityList.appendChild(li);
    }
  }

  document.getElementById("r-note").value = "";
  document.getElementById("report-status").classList.add("hidden");
}

document.getElementById("btn-submit-report").addEventListener("click", async () => {
  const note = document.getElementById("r-note").value.trim();
  const btn = document.getElementById("btn-submit-report");
  const statusEl = document.getElementById("report-status");
  btn.disabled = true;
  try {
    if (note) await window.internops.updateSummaryNote(currentSessionId, note);
    await window.internops.submitSummary(currentSessionId);
    statusEl.textContent = "Report submitted.";
    statusEl.classList.remove("hidden");
    setTimeout(async () => {
      views.report.classList.add("hidden"); // lets refreshStatus leave this view now that submission is done
      await refreshStatus();
    }, 1200);
  } catch (err) {
    alert(err.message || "Couldn't submit report.");
    btn.disabled = false;
  }
});

window.internops.onSessionRestored(() => refreshStatus());
window.internops.onActivityPermissionNeeded(() => {
  document.getElementById("permission-warning").classList.remove("hidden");
});

// Reconciles local Work Mode state against the server (e.g. an admin
// force-ending a shift, or another device ending it) — polled tighter
// while a shift is active than while idle, since that's the state where a
// stale local belief means the tracker keeps sampling longer than it
// should. This is still a poll, not a push, so reconciliation is bounded
// by this interval, not instant — a known, deliberate limitation of not
// running a persistent connection for a desktop companion this size.
let statusPollTimer = null;
async function pollStatusLoop() {
  let activeShift = false;
  try {
    const status = await refreshStatus();
    activeShift = !!(status && status.workModeActive && status.activeSession);
  } catch {
    // refreshStatus already surfaces errors where relevant; keep polling regardless.
  }
  statusPollTimer = setTimeout(pollStatusLoop, activeShift ? 10_000 : 30_000);
}
refreshStatus();
pollStatusLoop();

// Update status arrives as a live push (window.internops.onUpdateStatus)
// rather than only through the status poll, so "downloading… 40%" moves
// in near-real-time instead of jumping every 10-30s.
function renderUpdateStatus(status) {
  const banner = document.getElementById("update-banner");
  const message = document.getElementById("update-message");
  const installBtn = document.getElementById("btn-install-update");
  if (!status || status.state === "idle" || status.state === "checking" || status.state === "up-to-date") {
    banner.classList.add("hidden");
    return;
  }
  banner.classList.remove("hidden");
  installBtn.classList.add("hidden");
  switch (status.state) {
    case "available":
      message.textContent = `Update available (v${status.version}) — downloading…`;
      break;
    case "deferred":
      message.textContent = `Update v${status.version} ready to download once this shift ends.`;
      break;
    case "downloading":
      message.textContent = `Downloading update… ${status.percent}%`;
      break;
    case "downloaded":
      message.textContent = `Update v${status.version} downloaded.`;
      break;
    case "ready-to-install":
      message.textContent = `Update v${status.version} ready to install.`;
      installBtn.classList.remove("hidden");
      break;
    case "error":
      message.textContent = `Update check failed: ${status.message}`;
      break;
    default:
      banner.classList.add("hidden");
  }
}
document.getElementById("btn-install-update").addEventListener("click", async () => {
  try {
    await window.internops.installUpdate();
  } catch (err) {
    alert(err.message || "Couldn't install the update.");
  }
});
window.internops.onUpdateStatus(renderUpdateStatus);
