# Signing and notarizing a Companion release

Today, `npm run dist` builds and produces an **unsigned** DMG — Gatekeeper
rejects it (`spctl -a -t open ...` → `rejected: source=no usable
signature`), and every user sees "unidentified developer" on first launch.
This is a genuine external blocker, not a configuration gap: the build is
already wired for signing and notarization (`hardenedRuntime: true`,
`entitlements: build/entitlements.mac.plist` in `package.json`) — it just
has no certificate to sign with in this environment.

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
spctl -a -t open --context context:primary-signature -v "dist/InternOps Companion-1.2.1-arm64.dmg"
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
target block already exists in `package.json`.
