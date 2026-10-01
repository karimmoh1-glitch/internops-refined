// Current InternOps Companion release. Imported by the download page and
// by Settings so the version and links never drift apart.
export const COMPANION_VERSION = "1.4.1";

const BASE = `https://github.com/karimmoh1-glitch/internops-refined/releases/download/companion-v${COMPANION_VERSION}`;

export const COMPANION_MAC_ARM64_URL = `${BASE}/InternOps.Companion-${COMPANION_VERSION}-arm64.dmg`;
export const COMPANION_MAC_X64_URL = `${BASE}/InternOps.Companion-${COMPANION_VERSION}-x64.dmg`;
export const COMPANION_WIN_X64_URL = `${BASE}/InternOps.Companion-${COMPANION_VERSION}-win-x64.zip`;

export const COMPANION_DOWNLOADS = [
  { id: "mac-arm64", platform: "macOS", detail: "Apple silicon (M1 and later)", file: "dmg", url: COMPANION_MAC_ARM64_URL },
  { id: "mac-x64", platform: "macOS", detail: "Intel", file: "dmg", url: COMPANION_MAC_X64_URL },
  { id: "win-x64", platform: "Windows", detail: "Windows 10 / 11, 64-bit", file: "zip", url: COMPANION_WIN_X64_URL },
] as const;
