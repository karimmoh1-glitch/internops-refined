// Pure, Electron-free helpers the main process uses to describe itself —
// kept here so they can be unit-tested without a running app.

function formatHMS(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

// "connecting"   – no request has succeeded yet (fresh launch / sign-in)
// "connected"    – the last request succeeded
// "reconnecting" – one or two recent failures (a blip)
// "offline"      – three or more in a row
function connectionStatus({ failures = 0, lastOkAt = null } = {}) {
  if (failures === 0) return lastOkAt ? "connected" : "connecting";
  if (failures < 3) return "reconnecting";
  return "offline";
}

// The one-line status shown at the top of the tray menu. Uses the same
// names as the window so the two never disagree.
function trayStatusLine({ loggedIn, workState, paused, elapsedSeconds = 0, connection = "connected", queued = 0, completed = false }) {
  if (!loggedIn) return "Sign in to InternOps";
  if (workState === "STARTING") return "Connecting…";
  if (workState === "STOPPING") return "Ending…";
  if (workState === "ON") {
    const base = paused ? "Paused" : `Working — ${formatHMS(elapsedSeconds)}`;
    if (connection === "reconnecting" || connection === "offline") {
      return `${base} · Connection lost — retrying${queued > 0 ? ` (${queued} queued)` : ""}`;
    }
    return base;
  }
  if (completed) return "Work session complete";
  return "Ready";
}

module.exports = { formatHMS, connectionStatus, trayStatusLine };
