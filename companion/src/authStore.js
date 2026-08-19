// Persists only the session token (never the password) using Electron's
// safeStorage, which is backed by the OS keychain (macOS Keychain). The
// encrypted blob on disk is useless without the same OS user account.
const { safeStorage, app } = require("electron");
const fs = require("fs");
const path = require("path");

function sessionFile() {
  return path.join(app.getPath("userData"), "session.enc");
}

function saveSession(session) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("Secure storage is not available on this system.");
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(session));
  fs.writeFileSync(sessionFile(), encrypted);
}

function loadSession() {
  try {
    const encrypted = fs.readFileSync(sessionFile());
    if (!safeStorage.isEncryptionAvailable()) return null;
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    fs.unlinkSync(sessionFile());
  } catch {
    // Nothing to clear.
  }
}

module.exports = { saveSession, loadSession, clearSession };
