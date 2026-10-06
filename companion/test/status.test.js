// The Electron-free status helpers main.js uses for the window and tray:
// connection naming and the one-line tray status.
const test = require("node:test");
const assert = require("node:assert/strict");
const { formatHMS, connectionStatus, trayStatusLine } = require("../src/status");

test("formatHMS pads to HH:MM:SS and never goes negative", () => {
  assert.equal(formatHMS(0), "00:00:00");
  assert.equal(formatHMS(61), "00:01:01");
  assert.equal(formatHMS(3600 * 10 + 59), "10:00:59");
  assert.equal(formatHMS(-5), "00:00:00");
  assert.equal(formatHMS(NaN), "00:00:00");
});

test("connectionStatus: nothing has succeeded yet → connecting; then connected / reconnecting / offline", () => {
  assert.equal(connectionStatus({ failures: 0, lastOkAt: null }), "connecting");
  assert.equal(connectionStatus({ failures: 0, lastOkAt: 1 }), "connected");
  assert.equal(connectionStatus({ failures: 1, lastOkAt: 1 }), "reconnecting");
  assert.equal(connectionStatus({ failures: 2, lastOkAt: 1 }), "reconnecting");
  assert.equal(connectionStatus({ failures: 3, lastOkAt: 1 }), "offline");
  assert.equal(connectionStatus({ failures: 3, lastOkAt: null }), "offline", "failures win over 'never succeeded'");
});

test("trayStatusLine uses the same state names as the window", () => {
  assert.equal(trayStatusLine({ loggedIn: false }), "Sign in to InternOps");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "OFF" }), "Ready");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "OFF", completed: true }), "Work session complete");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "STARTING" }), "Connecting…");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "STOPPING" }), "Ending…");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "ON", elapsedSeconds: 125 }), "Working — 00:02:05");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "ON", paused: true }), "Paused");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "ON", elapsedSeconds: 5, connection: "offline", queued: 3 }), "Working — 00:00:05 · Connection lost — retrying (3 queued)");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "ON", elapsedSeconds: 5, connection: "reconnecting" }), "Working — 00:00:05 · Connection lost — retrying");
  assert.equal(trayStatusLine({ loggedIn: true, workState: "ENDED_PENDING_REPORT" }), "Ready");
});
