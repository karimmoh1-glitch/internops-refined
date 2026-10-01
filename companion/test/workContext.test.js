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
