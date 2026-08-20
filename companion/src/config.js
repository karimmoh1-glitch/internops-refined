// Single place to point the companion at an API base URL. Defaults to
// production; override with INTERNOPS_API_URL for local development
// (e.g. `INTERNOPS_API_URL=http://localhost:5001 npm start`).
const DEFAULT_API_URL = "https://internops-refined-1.onrender.com";

module.exports = {
  API_URL: process.env.INTERNOPS_API_URL || DEFAULT_API_URL,
  // How often to sample the frontmost application while Work Mode is on.
  SAMPLE_INTERVAL_MS: 15_000,
  // How often to flush accumulated activity to the server.
  SYNC_INTERVAL_MS: 5 * 60_000,
  // How often to check GitHub Releases for a newer Companion build. Checks
  // (and any resulting download/install) never happen while Work Mode is
  // active — see updater.js.
  UPDATE_CHECK_INTERVAL_MS: 4 * 60 * 60_000,
};
