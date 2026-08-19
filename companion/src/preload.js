const { contextBridge, ipcRenderer } = require("electron");

// The only surface the renderer (plain HTML/JS, no Node access) gets. No
// token, no raw network access — every call is proxied through the main
// process, which is the only place the session token ever lives.
contextBridge.exposeInMainWorld("internops", {
  login: (email, password) => ipcRenderer.invoke("login", { email, password }),
  logout: () => ipcRenderer.invoke("logout"),
  getStatus: () => ipcRenderer.invoke("get-status"),
  startWorkMode: () => ipcRenderer.invoke("start-work-mode"),
  stopWorkMode: () => ipcRenderer.invoke("stop-work-mode"),
  getSummary: (sessionId) => ipcRenderer.invoke("get-summary", sessionId),
  updateSummaryNote: (sessionId, note) => ipcRenderer.invoke("update-summary-note", { sessionId, note }),
  submitSummary: (sessionId) => ipcRenderer.invoke("submit-summary", sessionId),
  onSessionRestored: (cb) => ipcRenderer.on("session-restored", (_e, data) => cb(data)),
  onActivityPermissionNeeded: (cb) => ipcRenderer.on("activity-permission-needed", () => cb()),
});
