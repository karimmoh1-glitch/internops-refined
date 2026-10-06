// Pure helpers in workContext.js: hostname extraction (never a full URL,
// never a non-http scheme), document-name inference (only ever a substring
// of the observed title), and Windows process-name normalisation.
const test = require("node:test");
const assert = require("node:assert/strict");
const { extractDomain, inferDocumentName, normalizeWindowsProcessName, WINDOWS_PROCESS_NAMES } = require("../src/workContext");

test("extractDomain returns only the hostname for http(s) URLs", () => {
  assert.equal(extractDomain("https://github.com/karimmoh1-glitch/internops/pull/83?tab=files#diff"), "github.com");
  assert.equal(extractDomain("http://localhost:5001/work"), "localhost");
  assert.equal(extractDomain("https://user:secret@example.com/path"), "example.com");
  assert.equal(extractDomain("  https://docs.google.com/document/d/abc  "), "docs.google.com");
});

test("extractDomain refuses non-http schemes and junk", () => {
  assert.equal(extractDomain("chrome://settings"), null);
  assert.equal(extractDomain("file:///Users/me/secret.txt"), null);
  assert.equal(extractDomain("about:blank"), null);
  assert.equal(extractDomain("not a url"), null);
  assert.equal(extractDomain(""), null);
  assert.equal(extractDomain(null), null);
  assert.equal(extractDomain(42), null);
});

test("inferDocumentName takes the first ' — ' / ' - ' segment and nothing else", () => {
  assert.equal(inferDocumentName("routes.ts — internops"), "routes.ts");
  assert.equal(inferDocumentName("auth.ts - internops - Visual Studio Code"), "auth.ts");
  assert.equal(inferDocumentName("Q3 plan – Google Docs"), "Q3 plan");
  assert.equal(inferDocumentName("● routes.ts — internops"), "routes.ts", "unsaved marker is state, not name");
  assert.equal(inferDocumentName("* notes.md - Notepad"), "notes.md");
});

test("inferDocumentName reports UNKNOWN rather than guessing", () => {
  assert.equal(inferDocumentName("Finder"), null);
  assert.equal(inferDocumentName("my-file-name.txt"), null, "hyphens without spaces are part of the name");
  assert.equal(inferDocumentName(""), null);
  assert.equal(inferDocumentName(null), null);
  assert.equal(inferDocumentName(" — only a separator"), null);
  assert.equal(inferDocumentName("x".repeat(250) + " — app"), null, "implausibly long names are rejected");
});

test("normalizeWindowsProcessName maps common process images to their display names", () => {
  assert.equal(normalizeWindowsProcessName("chrome"), "Google Chrome");
  assert.equal(normalizeWindowsProcessName("msedge"), "Microsoft Edge");
  assert.equal(normalizeWindowsProcessName("Code"), "Visual Studio Code");
  assert.equal(normalizeWindowsProcessName("Code.exe"), "Visual Studio Code");
  assert.equal(normalizeWindowsProcessName("WINWORD"), "Microsoft Word");
  assert.equal(normalizeWindowsProcessName("EXCEL.EXE"), "Microsoft Excel");
  assert.equal(normalizeWindowsProcessName("ms-teams"), "Microsoft Teams");
  assert.equal(normalizeWindowsProcessName("WindowsTerminal"), "Windows Terminal");
  assert.equal(normalizeWindowsProcessName("explorer"), "File Explorer");
  assert.equal(normalizeWindowsProcessName("slack"), "Slack");
});

test("normalizeWindowsProcessName passes unknown names through and rejects empties", () => {
  assert.equal(normalizeWindowsProcessName("SomeInternalTool"), "SomeInternalTool");
  assert.equal(normalizeWindowsProcessName("  "), null);
  assert.equal(normalizeWindowsProcessName(""), null);
  assert.equal(normalizeWindowsProcessName(null), null);
  assert.equal(normalizeWindowsProcessName(undefined), null);
});

test("the normalisation table keys are lowercase (lookup is case-insensitive)", () => {
  for (const key of Object.keys(WINDOWS_PROCESS_NAMES)) assert.equal(key, key.toLowerCase());
});

// --- macOS application name via LaunchServices + permission gates ---
const { parseLsappinfoName, permissionGate, isPermissionError, _noteSignal, getSignals } = require("../src/workContext");

test("parseLsappinfoName reads the display name out of `lsappinfo info` output and nothing else", () => {
  assert.equal(parseLsappinfoName('"LSDisplayName"="Brave Browser"\n"pid"=71268\n'), "Brave Browser");
  assert.equal(parseLsappinfoName('"LSDisplayName"="Visual Studio Code"'), "Visual Studio Code");
  assert.equal(parseLsappinfoName('"LSDisplayName"=""'), null, "an empty name is UNKNOWN, not an empty string");
  assert.equal(parseLsappinfoName(""), null);
  assert.equal(parseLsappinfoName(null), null);
  assert.equal(parseLsappinfoName('"pid"=1'), null);
});

test("permissionGate names the macOS setting an osascript error points at", () => {
  assert.equal(permissionGate({ stderr: "88:93: execution error: Not authorized to send Apple events to System Events. (-1743)" }), "automation");
  assert.equal(permissionGate({ message: "osascript is not allowed assistive access. (-25211)" }), "accessibility");
  assert.equal(permissionGate({ stderr: "execution error: An error of type -10004 has occurred." }), "automation");
  assert.equal(permissionGate({ stderr: "execution error: Can't get window 1 of process \"Finder\". Invalid index. (-1719)" }), null, "a window-less app is not a permission problem");
  assert.equal(isPermissionError({ stderr: "(-1743)" }), true);
  assert.equal(isPermissionError(new Error("timeout")), false);
});

test("a signal that has worked keeps 'ok' through a non-permission error, but flips on a real denial", () => {
  _noteSignal("windowTitle", "ok", null, { gate: null });
  _noteSignal("windowTitle", "error", "Can't get window 1 of process. (-1719)");
  assert.equal(getSignals().windowTitle.status, "ok");
  assert.match(getSignals().windowTitle.error, /-1719/);
  _noteSignal("windowTitle", "denied", "(-1743)", { gate: "automation" });
  assert.equal(getSignals().windowTitle.status, "denied");
  assert.equal(getSignals().windowTitle.gate, "automation");
  assert.equal(getSignals().windowTitle.error.length <= 200, true);
});
