# InternOps launch readiness

Execution ledger for the production-readiness passes of 2026-10-10 (PR #85, #86), the closure pass of 2026-10-11 (PR #87, #88) and the final launch verification of 2026-10-11 (PR #89). Every line names what was checked, how, and what the evidence was. "Verified" means a test, a request, a capture or a driven session proved it in this pass, not that the code reads as if it should work.

Production: https://internops.vercel.app (Vercel project `internops`, Neon Postgres). Deploys are manual (`npx vercel --prod` from an up-to-date `main`); the Vercel project is not connected to GitHub, so merging alone changes nothing in production. GitHub Actions CI (typecheck + build, Companion tests) gates every pull request.

## Release decision

**NOT READY — BLOCKERS REMAIN.** Two critical launch requirements cannot be closed from this environment and are still unverified in production:

1. Email delivery is not configured in production (no `RESEND_API_KEY`, no verified sender). The product is honest about it and managers can recover accounts by hand, but invitations, verification, approvals and digests reach nobody.
2. The requested production manager account does not demonstrably exist in production, and no production manager session was available to this pass. Every production workflow that needs a session is therefore verified on a production-mode build of the same commit, not on the live site.

Everything else found across both passes is fixed, deployed or documented with its reason. Details per blocker are in "Remaining blockers".

## Final launch verification 2026-10-11 (PR #89)

Each line says whether it was verified **on production** or **locally**. Nothing below was inferred from source alone.

| Requirement | Where | Result |
| --- | --- | --- |
| Production configuration unchanged since the closure pass | production | `vercel env ls`: still only `CRON_SECRET APP_URL JWT_SECRET DATABASE_URL`; `GET /api/config` → `emailConfigured:false`. |
| Deployed code corresponds to `main` | production | Production serves `assets/index-DAKxkNcI.js` and `/theme.js` (sha 11ab2c8a…); a fresh `npm run build` of `main` 889b85b produces the identical content-hashed asset and theme file. |
| Manager account | production (read-only) | Login probe with a deliberately wrong password → generic `401`, no `applicationStatus`. Existence, authentication and role on production remain **unverified**: no production session or database access exists here, and entering the real password into the live site is outside this pass. Nothing was created or changed. Steps in B2. |
| Real email delivery | not possible | No valid provider credentials anywhere available (the only Resend key on this machine is rejected by Resend). No delivery is claimed. Steps in B1. |
| Email provider failure and timeout handling | local (tests) | Provider unreachable → invitation `emailSent:false`, honest message (existing test). New: a provider that accepts the connection and never answers is cut off by the timeout (overridable via `EMAIL_PROVIDER_TIMEOUT_MS`, production 10 s) and reported as `provider_unreachable`, invite link still returned. Logs carry recipient, subject and error name only. |
| Pulse capabilities active in production | production | No model key in the Vercel environment, so the deterministic engine answers everything, labelled `aiGenerated:false` ("Data lookup" in the UI). Model-backed behaviour is **not** live and is not claimed. `POST /api/pulse/ask` unauthenticated → 401. |
| Pulse grounding, permissions, fallback, timeout | local (tests + production-mode build) | 16 Pulse integration tests: real task/session references, ambiguity, empty data, intern scoping, unknown names, provider unreachable → fallback, and new: a hung provider is cut off by the timeout (`PULSE_PROVIDER_TIMEOUT_MS`, production 20 s, one retry) and the deterministic engine still answers with real references in under 2 s. |
| Companion packaged release — artifact integrity | artifact | `InternOps.Companion-1.4.2-arm64.zip` downloaded from the GitHub release; SHA-512 and size match `latest-mac.yml`; bundle version 1.4.2. |
| Companion packaged release — signing and notarization | local (this Mac) | `codesign`: ad-hoc, linker-signed, identifier `Electron`, no Team ID. `spctl --assess`: rejected ("code has no resources but signature indicates they must be present"). No notarization ticket. Gatekeeper will block a normal double-click, as the download page states. **Operator**: sign with a Developer ID certificate and notarize (electron-builder `mac.identity` + `notarize`), or users keep using right-click → Open. |
| Companion packaged release — launch, authentication, Work Mode, reporting | local (this Mac, packaged binary, local production-mode server) | The packaged app launched from the unzipped bundle; signed in as the QA intern; Work Mode started and the server showed the session active; shift ended, report generated (28 s observed), submitted; server session `completed`, report `submittedAt` set. |
| Companion packaged release — collection boundary | local (packaged binary) | After End shift: tracker reported stopped, the session's activity count on the server stayed at 1 for 35 s afterwards, and the app log shows no activity upload after the end. Nothing is observed before Start (sign-in screen states it; server rejects pre-shift samples in tests). |
| Companion packaged release — update check | local (packaged binary, real GitHub Releases) | On launch the packaged app checked GitHub Releases and logged "Update for version 1.4.2 is not available (latest version: 1.4.2)". Download/install of a newer version was not exercised (none exists). |
| Companion — Windows, Intel macOS | not verified | No such hardware here. Windows updates are manual by design. |
| Production workflows with a session | **not verified on production** | No authorized production session exists (see B2). The 64-check workflow audit (both roles, people, tasks, projects, submissions, approvals, Work Mode, reports, notifications, Pulse, recovery, authorization, revocation) passed on the production-mode build of the same code on 2026-10-11; see "Production workflow audit" below. Live-site checks that need no session pass: `/api/health` 200, `/api/auth/me` 401, `POST /api/invitations` 401, `POST /api/pulse/ask` 401, CSP on `/`, public pages render with no console errors at 1440 and 390. |
| Release gates for PR #89 | local + CI | typecheck 0 · `npm test` 67/67 · Companion 59/59 · build 0 · `npm audit --omit=dev` 0 · CI recorded on the PR. |

What this pass changed in code: only the two provider timeouts became environment-overridable for tests (production values unchanged) plus the two hanging-provider tests. No features were added.

## Remaining blockers

### B1 — Production email delivery

| Field | Value |
| --- | --- |
| Severity | P0 for a public launch (users cannot be invited or verified by email); P1 for a single founder-run workspace (manager-issued links cover recovery and invitations). |
| Actual cause | Vercel production env has only `CRON_SECRET APP_URL JWT_SECRET DATABASE_URL`. `RESEND_API_KEY` and `EMAIL_FROM` are unset, and the default sender `noreply@internops.dev` is not a domain verified anywhere. The only Resend key on this machine (in the Daythread checkout) is invalid: `GET https://api.resend.com/domains` with it answers "API key is invalid". |
| Evidence | `vercel env ls` (names only); production `GET /api/config` returns `{"emailConfigured":false}`; Resend API probe above. |
| Fixed? | Not fixable from here (no credentials). The code paths around it were hardened in PR #87: `sendEmail` never throws, returns `{ ok, error }`, times out after 10 s, and logs only recipient, subject and provider error name (never bodies or links). Invitations now await the real provider result, so a configured-but-failing provider reports `emailSent:false` with an `emailError` category instead of "Invitation sent". |
| Verification performed | `recovery.test.ts`: provider configured but unreachable (SDK pointed at a closed port) → `201`, `emailSent:false`, honest message, invite link still returned. Mock path (no key) covered by the earlier tests. Real delivery was **not** tested: no valid credentials exist, and no delivery result is claimed. |
| Operator action | (1) Create a Resend API key for InternOps. (2) Add and verify a sending domain in Resend (DNS: the SPF/DKIM records Resend shows for the domain). (3) In Vercel → Project `internops` → Environment Variables (Production) set `RESEND_API_KEY` and `EMAIL_FROM` (for example `InternOps <noreply@your-verified-domain>`), optionally `ADMIN_NOTIFICATION_EMAILS`. (4) Redeploy (`npx vercel --prod`). (5) Verify: `GET /api/config` returns `emailConfigured:true`; create an invitation from People and confirm `emailSent:true` in the dialog and the message in the recipient inbox; use "Forgot your password?" with a real account and confirm the email arrives; check the Vercel function logs for `[EMAIL SENT]` rather than `[RESEND ERROR]`. |

### B2 — Production manager account

| Field | Value |
| --- | --- |
| Severity | P0 (no verified way to administer the production workspace from this pass). |
| Actual cause | The account `karimamwa@gmail.com` that the previous report found existed only in the **local development database** (`internops_main_dev`, created 2026-08-12, role admin). Local and production databases are separate. Production `DATABASE_URL` is marked sensitive in Vercel and cannot be pulled; no Neon CLI or credentials exist on this machine; entering the requested password into the live site is outside what this pass may do. |
| Evidence | Local: query showed the admin row; local login, `/api/auth/me` role admin, `/api/interns` 200 as that account, 403 as an intern. Production: `POST /api/auth/login` with that email and a deliberately wrong password answers the generic `401 Invalid email or password` with no `applicationStatus`, which means either no such account exists or it exists with a different password; the API deliberately does not distinguish the two, and no non-mutating call can. |
| Fixed? | No. Nothing was created, duplicated or reset in production. |
| Verification performed | The exact provisioning flow was verified end to end locally on 2026-10-10 (signup → manager approval → Promote to manager → login → admin routes). Role is never taken from the request body; the first signup becomes manager only when no manager exists (`anyAdminExists`). |
| Operator action | Open https://internops.vercel.app/login and try the requested email. If it signs in, open **People** (managers only) to confirm the role; done. If it answers "Invalid email or password": if you own another manager account, sign up with the requested email at `/signup`, approve it under **People → Applications**, open the profile and choose **Promote to manager**; if no manager exists yet, the first signup becomes manager automatically. If the account exists but the password is unknown, a manager opens the profile and chooses **Create password reset link** (one hour, shown once). This ledger does not contain the password. |

## Closure pass 2026-10-11 — what was verified and how

### Pulse Chat

| Check | How | Result |
| --- | --- | --- |
| Which engine is active in production | Vercel env has no `OPENAI_API_KEY` / `AI_INTEGRATIONS_OPENAI_API_KEY`; `hasOpenAiKey()` gates the provider path; `/api/pulse/suggestions` reports `aiAvailable:false` | Deterministic engine, every answer `aiGenerated:false`, UI labels answers "Data lookup". No model is claimed. |
| Grounding against known records | Workflow driver on the production-mode build: live session question references the real session id; overdue answer references the real task; intern asking about another person gets only their own data; unknown name → "didn't recognise"; empty data → explicit "nothing" answers | Pass (15 Pulse integration tests + driver). |
| Ambiguous names, name-word collisions | `pulse.test.ts` | Pass. |
| Provider failure, timeout, rate limit | New test: key set, provider unreachable → caught, deterministic fallback with real references, `aiGenerated:false`. OpenAI client now has a 20 s timeout and at most one retry so a hung provider fails inside the 60 s function budget. Our own `aiLimiter` bounds request rate; a provider 429 takes the same caught path. | Pass. Malformed model output cannot invent references: `extractReferences` drops any id not in the authorised context. |
| Minimum safe configuration to enable the model | Set `OPENAI_API_KEY` (and optionally `PULSE_MODEL`, default `gpt-4o-mini`) in Vercel Production only. Never in source or client config (verified: the client reads only `aiAvailable`). | Documented; not enabled (operator decision, billing). |

### Companion (desktop)

What each statement rests on is marked: **unit** = `npm run test:companion` (59 tests, Electron-free modules), **driven** = the real Electron app launched from source (`companion/`, v1.4.2) on this Mac with `INTERNOPS_API_URL=http://localhost:5002` and driven through its own renderer and IPC bridge over the DevTools protocol, **artifact** = HTTP checks on the published release, **not verified** = not exercised.

| Area | Basis | Result |
| --- | --- | --- |
| Sign-in with an intern account; manager accounts refused | driven | Signed in as the local QA intern; device appears on the server as "Companion on macOS". |
| Work Mode start, live timer, server sees the live session | driven | Session active on the server within seconds; manager's company view and Pulse ("who is working right now") show it. |
| Activity observation and privacy boundary | driven + unit | Observed only the frontmost application and browser domain while the shift ran; window title correctly reported "needs Automation and Accessibility" because that permission is not granted on this Mac; nothing is sent before start or after end (unit tests + server tests reject out-of-window samples). |
| End shift, report generation, report submission with a note, manager notification, Workday Replay | driven | Shift ended through the app's stop path, report built from the observed segment, submitted with a note; manager received "Shift Report Submitted"; Replay shows the observed segment, system events, 100% coverage and the note. The confirm dialog's click could not be triggered synthetically (Chromium requires user activation for dialog form submission), so the end was invoked through the same IPC call the button uses. |
| Network recovery | driven | Server stopped: app showed "Can't reach the InternOps server" and "Connection lost — retrying", refused to start a shift. Server restarted: back to "Connected" within 20 s without re-login. |
| Update policy | unit | Windows portable zip → manual-update message; macOS → GitHub Releases; test feed override honoured. |
| Release artifacts | artifact | `companion-v1.4.2` assets present and downloadable (dmg + zip for arm64/x64, `latest-mac.yml`, Windows x64 zip); download page links resolve 200. |
| macOS .dmg installation, Gatekeeper right-click-to-open, notarization | not verified | Build is unsigned; the download page says so. Needs an Apple Developer account to sign and notarize. |
| Windows execution and auto-update | not verified | No Windows machine; no installer or `latest.yml` published, so updates are manual by design (stated in-app and on the download page). |
| Automatic update download/install on macOS | not verified | Dev builds skip update checks ("not packed"); a packaged build against GitHub Releases was not exercised here. |

Operator requirements: Apple Developer ID certificate + notarization for a signed macOS build; an NSIS target and `latest.yml` if Windows self-update is wanted; macOS users must grant Accessibility and Automation to see window titles.

### Production workflow audit

No production session was available (see B2), so the audit ran against the **same commit built for production** (`npm run build`, `NODE_ENV=production`, helmet CSP active, dev-only link logging disabled) on a local database with dedicated QA accounts, plus every check on the live site that needs no session. Driver: 64 checks, all passing after three expectation fixes in the driver itself (notification matched by title, plan sizing fields, activity sample inside the shift window).

| Workflow | Verified |
| --- | --- |
| Manager authentication and permissions | login, `/me` role admin, admin-only routes 200 |
| Intern authentication and permissions | login, `/me` role intern; 403 on interns, applications, signals, invitations, audit log, task creation, promote, reset-link; 401 anonymous |
| People management | roster, invitation with honest `emailSent:false`, invite token validation, reset link issued by manager |
| Tasks | create → intern notified with deep link → cannot submit before start → start → submit → cannot self-approve → manager requests changes (intern notified) → resubmit → approve → detail shows both submissions and feedback |
| Projects and proposals | manager creates, intern sees own, intern proposes, manager rejects, deterministic plan generation |
| Work Mode and reporting | manager cannot start; start once; in-window activity accepted; post-shift activity rejected; end produces report; note saved; submit once; manager notified |
| Notifications | unread count, mark all read, deep links |
| Workday Replay and Signals | timeline shows observed activity; signals list loads |
| Pulse | live session, overdue, intern scope, unknown name |
| Account recovery | manager link → verify → reset → single use → old password rejected; forgot-password generic |
| Logout and session revocation | revoke current device → token rejected immediately → re-login works |
| Live site without a session | `/api/health` 200, `/api/config`, `/api/auth/me` 401, reset-link route 401, cron with wrong secret 401, CSP and companion headers on `/`, public pages at 1440 and 390 with no console errors or failed requests |

Test artifacts were deleted by the driver (task, project, proposal); the local QA intern's password was rotated through the reset-link flow and is not recorded here.

### Final design review

Rendered in headless Chrome, not inferred from source: live public pages (landing, login, signup, forgot-password, download, privacy, terms, contact, apply, 404) at 1440 and 390; every manager and intern screen (home, tasks, projects, people, person, work, replay, signals, pulse, messages, proposals, alumni, settings) on the production-mode build at 1440, and the core set at 390. No console errors, failed requests or horizontal overflow anywhere. Landing communicates the purpose in the first line; typography is one family (Geist) plus mono for data and a regular-weight serif only on the certificate. Fixed in this pass: Pulse said "0 persons" (now "people") and repeated reference chips below answers that already cite inline.

### Release gates (branch `launch/closure`, PR #87)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | exit 0 |
| `npm test` | 65/65 |
| `npm run test:companion` | 59/59 |
| `npm run build` | exit 0 |
| `npm audit --omit=dev` | 0 vulnerabilities |
| Diff review | 7 code files; no secrets (pattern scan for keys and literal passwords: none); no unrelated user changes |
| GitHub Actions CI | recorded on the PR |

Production deployment evidence for this pass is appended under "Deployments".

## Earlier pass 2026-10-10 (PR #85, #86) — summary

Fixed and deployed: manager-issued password reset links (`POST /api/users/:id/reset-link`, admin-only, workspace-scoped, audit-logged, never logged in plain text); public `GET /api/config` with `emailConfigured`; honest forgot-password and invitation copy; static security headers on CDN pages (CSP `script-src 'self'`, nosniff, frame options, referrer, permissions) with the theme script moved to `/theme.js`; alumni reopen state and sign-in message; Pulse name-word guard, idle phrasing, person naming; Companion Windows manual-update honesty; WCAG AA contrast tokens in both themes; `npm audit fix` to zero production advisories; README accuracy (Express 4, manual deploys). Stale PR #38 (August) was closed as superseded: main already routes errors through the shared handler.

Open, documented, not blockers: unsigned macOS Companion (P2), deterministic Pulse in production (P2, operator choice), per-instance rate limiting (P2), device records accumulate per login (P2), `/i/:slug` unknown slug returns the SPA shell with 200 (P2).

## Security review notes

- Passwords: bcryptjs cost 10; the requested credential was never written to source, logs, captures or this file.
- Reset and invite tokens: random, stored hashed, single use, time-boxed (1 h / 48 h); the raw manager-issued link is returned once to the requesting admin only.
- Authorization: every admin route uses `requireAuth` + `requireRole("admin")` and checks `companyId` on the target; role never comes from the client.
- Provider failures: email and AI calls are bounded in time, caught, and reported truthfully; logs never carry message bodies, links or keys.
- Secrets: `.env` git-ignored; production secrets only in Vercel; `DATABASE_URL` sensitive there.
- Not done: penetration test, SBOM, secret-scanning CI step.

## Deployments

**2026-10-11 (UTC), PR #89 → d9c3561**: `npx vercel --prod`, deployment `internops-22cyr3rk2`, aliased to https://internops.vercel.app, status Ready. Post-deploy: `/api/health` 200; `/api/config` `{"emailConfigured":false}`; `/api/auth/me`, `POST /api/invitations`, `POST /api/pulse/ask` 401 unauthenticated; `/login`, `/download`, `/theme.js` 200; CSP on `/`; a fresh local build of `main` produces the identical content-hashed client asset that production serves; live landing and login render with no console errors or failed requests.


**2026-10-11 (UTC), PR #85 → 3d94e07**: `npx vercel --prod`, deployment `internops-pwxwfjaxk`, aliased to https://internops.vercel.app. Post-deploy: `/api/health` 200; `/api/config` `{"emailConfigured":false}`; `/api/auth/me` 401; reset-link route 401 unauthenticated; `/login`, `/download`, `/forgot-password` 200; `/theme.js` served as JavaScript and referenced by the page; CSP, nosniff, `X-Frame-Options`, `Referrer-Policy`, Permissions-Policy, HSTS on `/`; headless Chrome on the live landing, forgot-password, login and download pages at 1440 and 390 with no console errors or blocked requests; static pages 100–160 ms to first byte, API 170–200 ms warm.

**2026-10-11 (UTC), PR #87 → 2fed63f**: `npx vercel --prod`, deployment `internops-2hglpvptn`, aliased to https://internops.vercel.app, status Ready. Post-deploy: `/api/health` 200; `/api/config` `{"emailConfigured":false}`; `/api/auth/me`, `POST /api/invitations` and `POST /api/pulse/ask` all 401 unauthenticated; `/login`, `/download`, `/theme.js` 200; CSP present on `/`; headless Chrome on the live landing, login and forgot-password pages at 1440 with no console errors, failed requests or overflow. The deployed code is `main` at 2fed63f, the merge of PR #87 whose gates are listed above.
