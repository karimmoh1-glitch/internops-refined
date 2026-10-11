// Decides whether this build can update itself. Pure and Electron-free so
// it can be unit tested.
//
// macOS ships as dmg+zip with a latest-mac.yml manifest, so electron-updater
// can check, download and install. Windows ships only as a portable .zip
// (no NSIS installer, no latest.yml), which electron-updater cannot update
// in place: checking would just surface "Cannot find latest.yml" to the
// user. Say so honestly and point at the download page instead.
const DOWNLOAD_URL = "https://internops.vercel.app/download";

function updatePolicy({ platform = process.platform, feedUrlOverride = process.env.INTERNOPS_UPDATE_FEED_URL } = {}) {
  if (feedUrlOverride) return { automatic: true, reason: "test-feed" };
  if (platform === "win32") {
    return {
      automatic: false,
      reason: "windows-portable-zip",
      message: "Updates on Windows are manual: download the latest build from the InternOps download page.",
      downloadUrl: DOWNLOAD_URL,
    };
  }
  if (platform === "linux") {
    return { automatic: false, reason: "no-linux-build", message: "No update channel is published for this platform.", downloadUrl: DOWNLOAD_URL };
  }
  return { automatic: true, reason: "github-releases" };
}

module.exports = { updatePolicy, DOWNLOAD_URL };
