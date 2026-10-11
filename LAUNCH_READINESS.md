# InternOps launch readiness

Execution ledger for the production-readiness pass of 2026-10-10/11. Every line names what was checked, how, and what the evidence was. Items are ranked P0 (blocks a public launch) to P3 (polish). "Verified" means a test, a request, or a capture proved it in this pass, not that the code reads as if it should work.

Baseline at the start of the pass: `main` at 3a1ce08, production https://internops.vercel.app serving `/` 200, `/api/health` 200.

## How things were verified

| Method | What it covers |
| --- | --- |
| `npm run typecheck` | whole repo, exit code gated |
| `npm test` (vitest, serial, `internops_test` DB) | 63 integration tests across auth, security, tasks, work mode, Pulse, recovery |
| `npm run test:companion` (node test runner) | 59 Companion unit tests, including the new update policy |
| `npm run build` | production client + server bundle, exit code gated |
| Headless Chrome over the DevTools protocol (`.claude/qa/cap.mjs`, not committed) | real renders at 1440 and 390 wide, console errors, failed requests, horizontal overflow |
| curl against the local dev server and against production | status codes, headers, negative auth probes |

## P0 — blocks a public launch

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| P0-1 | **Production sends no email.** The Vercel project has no `RESEND_API_KEY`, so invitations, verification, approvals, digests and password resets are mocked to the log. Users who forget a password had no way back in. | **Mitigated in product, still open operationally.** The app now tells the truth and gives managers a working recovery path (see P1-1). Real email still needs the operator to add `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. | `vercel env ls` shows only `CRON_SECRET APP_URL JWT_SECRET DATABASE_URL`. New `GET /api/config` returns `{ "emailConfigured": false }` on production after deploy. |
| P0-2 | **Requested production manager account is not verified.** The account `Karimamwa@gmail.com` could not be provisioned on production from this machine: `DATABASE_URL` is marked sensitive in Vercel (not pullable), and entering credentials into a non-local site is outside what this pass may do. | **Open.** Verified end to end on the local database only (role `admin`, login 200, admin route 200, intern 403). | Steps for the operator are in "Production account" below. |

## P1 — must be true before inviting real teams

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| P1-1 | No manager-side password recovery existed; forgot-password promised an email that production never sends. | **Fixed.** `POST /api/users/:id/reset-link` (admin only, same workspace, not self, not deactivated, audit-logged) issues a one-hour link shown once to the manager. Person profile menu gained "Create password reset link". Forgot-password page explains the manager path when `emailConfigured` is false. | `recovery.test.ts`: full reset through a manager link, old password rejected, token single-use, 403 for interns, 404 across workspaces, 400 for self, 401 anonymous. Capture `shots/mgr/resetlink-1440.png`, `shots/pub/forgot-1440.png`. |
| P1-2 | Invitations said "sent" when nothing was sent. | **Fixed.** Response carries `emailSent`; message and dialog say "share the link yourself" when false. | `recovery.test.ts` "invitations say honestly that no email went out". |
| P1-3 | Two critical and four moderate advisories in production dependencies (`proxy-addr`, `shell-quote`, others). | **Fixed.** `npm audit fix` applied; production dependencies at 0 known vulnerabilities. Seven dev-only advisories remain that need `--force` (major upgrades) and were deliberately not applied. | `npm audit --omit=dev` clean; typecheck, tests and build green afterwards. |
| P1-4 | Static pages from the CDN carried only HSTS; helmet's headers only reached API responses. | **Fixed.** `vercel.json` adds CSP (`script-src 'self'`), nosniff, frame options, referrer and permissions policy on every non-API route. The first-paint theme script moved from inline to `/theme.js` so the CSP can stay strict. | Build output references `/theme.js`; to be confirmed on production with `curl -I` after deploy (see "Deployment"). |
| P1-5 | Alumni reopen returned a stale row showing the account still deactivated; alumni were told their account was "deactivated" at login. | **Fixed.** One update returns the final row; alumni get an accurate refusal that says the internship ended and a manager can reopen it. | `recovery.test.ts` end → list → refusal → reopen → login. |
| P1-6 | Pulse routed "What other tasks are overdue?" to a profile of the intern surnamed Other; "who has no open tasks" was unrecognised; daily answers did not name the person. | **Fixed.** Everyday-word guard on fuzzy name matching, broader idle phrasing, person named in the daily answer. | `pulse.test.ts` new cases; 14 Pulse tests green. |
| P1-7 | Windows Companion claimed to check for updates but the Windows build is a portable zip with no update manifest, so checks failed with a 404 surfaced as an error. | **Fixed honestly.** `updatePolicy()` reports "manual" on Windows (shown only on a user-initiated check); download page states update behaviour per platform. Windows auto-update itself is not built (would need an NSIS target and `latest.yml`). | `companion/test/updatePolicy.test.js`; capture `shots/pub/download-1440.png`. |

## P2 — should be done soon after

| # | Finding | Status |
| --- | --- | --- |
| P2-1 | Companion macOS build is unsigned and un-notarised; users must right-click → Open. The download page says so plainly. Signing needs an Apple Developer account. | Open, documented. |
| P2-2 | Pulse runs the deterministic engine in production (no `OPENAI_API_KEY`). Answers are labelled `aiGenerated: false`. Model-written answers need the key and a budget decision. | Open, documented. |
| P2-3 | README said Express 5 (it is 4) and only documented `npx vercel --prod` although deploys go through the Vercel git integration. | Fixed. |
| P2-4 | Rate limiting is per function instance (in memory); counts are not shared across instances. Bounded abuse protection, not a hard limit. | Open, documented in README. |
| P2-5 | Device records accumulate per login (the local QA manager had 82). Harmless, but the Devices list should prune or cap stale entries. | Open. |
| P2-6 | `/i/:slug` for an unknown slug returns the SPA shell with 200 instead of 404. Cosmetic for users, imprecise for crawlers. | Open. |

## P3 — polish

| # | Finding | Status |
| --- | --- | --- |
| P2-7 | Accessibility: structural sweep (alt text, control names, form labels, one h1 per page, heading order) was clean on all public and manager pages; a text-contrast sweep found 11px tertiary text (`--ink-4`) at 3.4–3.9:1 in dark mode and the light-mode status colours (`--ok`, `--danger`, `--warn`, `--work`) at 3.4–4.3:1 on their soft backgrounds. | Fixed: tokens adjusted so every measured text node is at or above 4.5:1 (3:1 for large text) in both themes on home, tasks, people, pulse, signals, settings, landing, login, signup, download. Not covered: keyboard-only walkthrough of every dialog, screen-reader session. |
| P3-1 | Landing page passes the 3/5/10-second read at 1440 and 390 (headline → capability nouns and product mock → subhead). No script or cursive type anywhere; the certificate uses a regular-weight serif for the recipient name, which is appropriate for a certificate. No redesign was needed. | Reviewed. |
| P3-2 | Dev-only reset and invite links are printed to the local console (never in production, guarded by `NODE_ENV`). | Reviewed, correct. |

## Functional audit (what was exercised)

| Area | How | Result |
| --- | --- | --- |
| Auth: login, me, wrong password, malformed/forged JWT, deactivated user, revoked device, password change signs out other devices | tests + production probes | pass; production returns generic 401s |
| Signup bootstrap | code review + local | first signup becomes admin only when no admin exists; role never comes from the request body |
| Role boundaries: interns cannot reach people, signals, applications, promote, reset links | tests + browser (intern redirected from `/people`, `/signals`) | pass |
| Tasks lifecycle: todo → in progress → in review → changes → completed, block/unblock, dependencies, cross-company isolation, notifications with deep links | tests | pass (11) |
| Work Mode: single active session (DB-enforced), activity rejected before start and after end, clipping, timeline, report submission once | tests | pass (12) |
| Projects, proposals, plan review isolation, AI mentor scoping | tests | pass |
| Alumni: end internship, list, certificate, reopen | test + API + capture `shots/mgr/certificate-1440.png` | pass after P1-5 |
| Notifications, audit log, worktime overview, company sessions, channels | manager API smoke on local | 200 with data |
| Public pages: landing, login, signup, forgot, download, privacy | captures at 1440/390 | no console errors, no failed requests, no overflow |
| Pulse: live state, overdue/blocked refs, ambiguity, no-evidence, unrecognised, intern scoping, suggestions, name-word guard, empty data, deterministic labelling | tests | pass (14) |
| Companion: activity tracker, config, outbox, permissions, status, work context, work mode, update policy | unit tests | pass (59) |
| Cron endpoints with a wrong secret | production probe | 401 |

## Security review notes

- Passwords: bcryptjs cost 10; the requested credential was never written to source, logs, screenshots or this file.
- Reset and invite tokens: random, stored hashed, single use, time-boxed (1 h / 48 h). The raw manager-issued reset link is returned once to the requesting admin only and is never logged.
- Authorization: every new route uses `requireAuth` + `requireRole("admin")` and checks `companyId` on the target.
- Headers: API responses already carried CSP, nosniff, frame options, referrer policy via helmet; static pages now match through `vercel.json`.
- Secrets: `.env` is git-ignored; production secrets stay in Vercel; `DATABASE_URL` is marked sensitive there.
- Not done: no penetration test, no dependency SBOM, no secret-scanning CI step.

## Production account

The requested manager account must be created through the app's own flow by the operator:

1. Open https://internops.vercel.app/signup and sign up with the email. If no manager exists yet in the workspace, this first signup becomes the manager automatically.
2. Otherwise an existing manager approves the request under **People → Applications**, then opens the new profile and chooses **Promote to manager**.
3. Verify: log in, open **People** (managers only), and confirm the account cannot be reached by an intern token (`/api/interns` returns 403 for interns).

Verified locally on 2026-10-10 with exactly these steps.

## Deployment

Deploys are manual (`npx vercel --prod` from an up-to-date `main`); the Vercel project is not connected to the GitHub repository, so merging alone changes nothing in production. GitHub Actions CI runs typecheck, build and Companion tests on every pull request. Gate before merging: `npm run typecheck && npm test && npm run test:companion && npm run build`, each on its real exit code. Post-deploy smoke: `/api/health` 200, `/api/config` returns JSON, `curl -I /` shows the CSP header, `/login` and `/download` 200, `/api/auth/me` 401 unauthenticated.

**Deployed 2026-10-11 (UTC)**: PR #85 merged as 3d94e07, deployed with `npx vercel --prod` as deployment `internops-pwxwfjaxk`, aliased to https://internops.vercel.app. Post-deploy evidence:

| Check | Result |
| --- | --- |
| `/api/health` | 200 |
| `/api/config` | 200, `{"emailConfigured":false}` |
| `/api/auth/me` unauthenticated | 401 |
| `POST /api/users/x/reset-link` unauthenticated | 401 |
| `/login`, `/download`, `/forgot-password` | 200 |
| `/theme.js` | 200, `application/javascript`; index references it, no inline script |
| Headers on `/` | CSP with `script-src 'self'`, nosniff, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: no-referrer`, Permissions-Policy, HSTS |
| Headless Chrome on production: landing, forgot-password, login, download at 1440 and 390 | no console errors, no blocked requests, no horizontal overflow |
| Response times (3 samples) | static pages 100–160 ms to first byte; API 170–200 ms warm, one 1.7 s cold start |

## Release decision

**NOT READY — BLOCKERS REMAIN** for a public launch to teams outside the founder's own workspace:

- P0-1: email delivery is unconfigured in production. The product is honest about it and managers can recover accounts by hand, but invitations, verification and digests do not reach anyone until `RESEND_API_KEY` is set.
- P0-2: the requested production manager account is not yet created or verified on production.

Everything else found in this pass is fixed, documented, or ranked P2/P3 with a stated reason.
