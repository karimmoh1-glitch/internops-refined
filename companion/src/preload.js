const { contextBridge, ipcRenderer } = require("electron");

// The only surface the sandboxed renderer gets. No token, no raw network,
// no Node — every call is proxied to the main process, which owns all
// state. Payloads are plain data in both directions.
const invoke = (channel, payload) => ipcRenderer.invoke(channel, payload);

contextBridge.exposeInMainWorld("internops", {
  getState: () => invoke("get-state"),
  login: (email, password) => invoke("login", { email, password }),
  logout: () => invoke("logout"),
  acknowledgeExpired: () => invoke("acknowledge-expired"),
  startWork: () => invoke("start-work"),
  stopWork: () => invoke("stop-work"),
  submitReport: (note) => invoke("submit-report", { note }),
  discardReport: () => invoke("discard-report"),
  checkPermissions: () => invoke("check-permissions"),
  openPermissionSettings: (which) => invoke("open-permission-settings", { which }),
  openWeb: (path) => invoke("open-web", { path }),
  checkForUpdates: () => invoke("check-updates"),
  installUpdate: () => invoke("install-update"),
  onState: (cb) => {
    const listener = (_e, state) => cb(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
  onNavigate: (cb) => {
    const listener = (_e, view) => cb(view);
    ipcRenderer.on("navigate", listener);
    return () => ipcRenderer.removeListener("navigate", listener);
  },
});
