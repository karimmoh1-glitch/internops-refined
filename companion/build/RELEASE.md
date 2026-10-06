# Releasing the Companion

## Artifacts

`npm run dist` (macOS) and `npm run dist:win` (Windows) write to `dist/`.
With `"version": "1.4.2"` in `package.json` the files are:

| File | Purpose |
|---|---|
| `InternOps.Companion-1.4.2-arm64.dmg` | Apple Silicon installer |
| `InternOps.Companion-1.4.2-x64.dmg` | Intel installer |
| `InternOps.Companion-1.4.2-arm64.zip` | Apple Silicon — **required by the updater** |
| `InternOps.Companion-1.4.2-x64.zip` | Intel — **required by the updater** |
| `latest-mac.yml` | macOS update manifest (electron-updater reads this) |
| `InternOps.Companion-1.4.2-win-x64.zip` | Windows portable zip |
| `latest.yml` | Windows update manifest |
| `*.blockmap` | Differential-download metadata; upload alongside |

Upload every one of them to a GitHub Release on
`karimmoh1-glitch/internops-refined` tagged exactly `1.4.2` (no `v`
prefix — `vPrefixedTagName: false` in `package.json`). The updater
(`publish.provider: github`) looks for `latest-mac.yml` / `latest.yml` on
the newest non-draft, non-prerelease release; the zip is what it actually
downloads on macOS, so a release with only a DMG will show "Update
available" and then fail to download.

The tray icons live at `src/renderer/tray*Template.png` and are generated
by `node build/make-tray-icons.js` — re-run it if the mark changes.

## Unsigned builds (current state)

Today `npm run dist` produces an **unsigned** DMG — Gatekeeper rejects it
(`spctl -a -t open ...` → `rejected: source=no usable signature`), and
every user sees "unidentified developer" on first launch. They can get
past it with right-click → Open, or by removing the quarantine flag:

```bash
xattr -dr com.apple.quarantine "/Applications/InternOps Companion.app"
```

This is a genuine external blocker, not a configuration gap: the build is
already wired for signing and notarization (`hardenedRuntime: true`,
`entitlements: build/entitlements.mac.plist`, `NSAppleEventsUsageDescription`
in `mac.extendInfo`) — it just has no certificate to sign with in this
environment. electron-updater on macOS also **refuses to apply updates to
an unsigned app** (Squirrel.Mac requires a valid signature), so until
signing is in place "Check for updates" can only report availability.

## What's required (external, cannot be created from this repo)

1. An active **Apple Developer Program** membership (~$99/year), enrolled
   as an organization or individual under whoever will be the app's
   long-term signing identity.
2. A **Developer ID Application** certificate generated for that account,
   installed in the signing machine's login keychain. `security
   find-identity -v -p codesigning` must list it.
3. An **app-specific password** for notarization (generate at
   appleid.apple.com → Sign-In and Security → App-Specific Passwords),
   *not* the Apple ID's real password.
4. The account's **Team ID** (visible on developer.apple.com under
   Membership).

## Once those exist

No code changes needed. Set these environment variables on the signing
machine and run the existing build script:

```bash
export APPLE_ID="you@yourcompany.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist
```

electron-builder auto-detects those three variables and signs +
notarizes + staples in one pass — this is standard, well-documented
electron-builder behavior, not something built for this project.

## Verifying it actually worked

Don't trust the build log alone — confirm Gatekeeper agrees:

```bash
spctl -a -t open --context context:primary-signature -v "dist/InternOps.Companion-1.4.2-arm64.dmg"
# must print: accepted
# source=Notarized Developer ID
```

## Windows

Same shape of blocker, different certificate: an OV or EV code-signing
certificate from a CA (DigiCert, Sectigo, etc. — EV avoids most
SmartScreen friction but costs meaningfully more and requires a hardware
token). Once obtained:

```bash
export CSC_LINK="/path/to/cert.pfx"
export CSC_KEY_PASSWORD="..."
npm run dist:win
```

No Windows-specific code changes are needed for this either — the `win`
target block already exists in `package.json`. The Windows foreground
probe (`src/winProbe.js`, a single persistent PowerShell helper) has not
been exercised on real Windows hardware as part of the 1.4.2 rebuild;
test a shift end-to-end there before announcing a Windows release.
