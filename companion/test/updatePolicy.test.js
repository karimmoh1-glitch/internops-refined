const test = require("node:test");
const assert = require("node:assert/strict");
const { updatePolicy, DOWNLOAD_URL } = require("../src/updatePolicy");

test("macOS builds update automatically from GitHub Releases", () => {
  const p = updatePolicy({ platform: "darwin", feedUrlOverride: "" });
  assert.equal(p.automatic, true);
});

test("the Windows portable zip is honest about manual updates", () => {
  const p = updatePolicy({ platform: "win32", feedUrlOverride: "" });
  assert.equal(p.automatic, false);
  assert.match(p.message, /manual/i);
  assert.equal(p.downloadUrl, DOWNLOAD_URL);
});

test("a test feed override enables the updater on any platform", () => {
  assert.equal(updatePolicy({ platform: "win32", feedUrlOverride: "http://127.0.0.1:9/feed" }).automatic, true);
});
