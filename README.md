# InternOps

InternOps is the operating system for intern and early-career teams: tasks with a review lifecycle, projects with reviewed plans, Work Mode sessions, a desktop Companion that observes activity only during a session, Workday Replay, evidence-based Manager Signals, and Pulse Chat that answers questions from the workspace's real data. It runs as a single fixed workspace per deployment ("EDAI"). Public signup and the public application page both create a pending request — a manager reviews and approves or rejects each one before an account exists. Managers assign projects and tasks, interns plan their work with an AI assistant and log progress, and managers review and give feedback — with a full activity/audit trail behind it. Managers can also promote an intern to manager, demote a manager back to intern, and deactivate or permanently delete an intern account, all from the dashboard.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Wouter, TanStack React Query, Tailwind CSS v4, shadcn/ui, Vite
- **Backend**: Express 5 on Node.js, JWT auth (stateless, with server-enforced per-device revocation), PostgreSQL via Drizzle ORM
- **AI**: OpenAI SDK for plan generation, chat, and revision guidance
- **Email**: Resend, behind a provider-agnostic service (`server/services/emailService.ts`) — swappable without touching call sites
- No dependency on any specific hosting platform. See [Deployment](#deployment) below.

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (local or managed)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL` and `JWT_SECRET` at minimum:
   ```bash
   cp .env.example .env
   ```
3. Create the schema on a fresh local database, then apply migrations:
   ```bash
   npm run db:push      # local/throwaway databases only
   npm run db:migrate   # hand-written SQL in migrations/, tracked in schema_migrations
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

Without `RESEND_API_KEY` or `OPENAI_API_KEY` set, email sends log to the console instead of actually sending, and AI features fall back to a non-AI structured plan generator — the app runs fully otherwise. Nothing needs to be mocked or stubbed to develop locally.

### Environment Variables

See [`.env.example`](.env.example) for the full list with descriptions. Summary:

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes in production | Signs auth tokens. The app refuses to start in production without it, rather than falling back to an insecure default |
| `APP_URL` | Recommended | Public base URL, used in email links and OG meta tags |
| `RESEND_API_KEY` | No | Enables real email sending (Resend) |
| `EMAIL_FROM` | No | Sender identity for outgoing email |
| `ADMIN_NOTIFICATION_EMAILS` | No | Comma-separated platform-level addresses notified on every new application, in addition to each company's own admins |
| `OPENAI_API_KEY` | No | Enables real AI plan generation/chat |
| `PORT` | No | Server port (default 5000; many local dev setups need to override this — see note below) |

**AI note**: Pulse Chat works without an AI key (deterministic answers from recorded data, labelled as such). With `OPENAI_API_KEY` set it streams model-written answers grounded in the same data; `PULSE_MODEL` overrides the model.

**Local port note**: macOS's built-in AirPlay Receiver often holds port 5000. If `npm run dev` fails with `EADDRINUSE`, set `PORT` to something else (e.g. `3001`) in `.env`.

### Demo data

`npm run db:seed` populates a realistic demo organization — a manager account and three interns at different project stages (one active with logged work and feedback, one with a plan submitted awaiting review, one just assigned), plus a couple of sample applications. It refuses to run against `NODE_ENV=production` and no-ops if it's already been run. See [`DEMO.md`](DEMO.md) for a full walkthrough script and the demo account credentials.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Express server with Vite middleware for local development |
| `npm run build` | Build the production bundle (`dist/public` for the client, `dist/index.cjs` for the server) |
| `npm start` | Run the production build |
| `npm run db:migrate` | Apply pending SQL migrations from `migrations/` (also runs automatically on `npm start`) |
| `npm test` | Integration tests (vitest + supertest) against a database named `internops_test` — never dev or prod |
| `npm run test:companion` | Companion unit tests |
| `npm run db:push` | Push the Drizzle schema to a **local throwaway** database. Never run against production — use migrations |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run db:seed` | Populate realistic demo data (development only) |

## Project Structure

- `client/` — React frontend (design system in `client/src/index.css`, shared kit in `client/src/components/kit`, see `docs/DESIGN.md`)
- `server/` — Express backend (`routes.ts` plus feature modules in `server/routes/`), services, and `server/__tests__`
- `shared/` — Types and Drizzle schema shared between client and server
- `migrations/` — Hand-written, idempotent SQL applied by `script/migrate.ts`
- `companion/` — The Electron desktop Companion

`replit.md` is a historical engineering changelog from this project's original development environment. It predates the current architecture in places and is kept only as a reference, not as current documentation — this README is authoritative.

## Deployment

The app is a single Express server that serves both the API and the built frontend (`server/static.ts` in production, Vite middleware in development) — it doesn't require separate frontend/backend hosting, though it works fine split across two services too.

A straightforward, low-maintenance architecture for a small-to-mid-size deployment:

| Concern | Suggested service | Why |
| --- | --- | --- |
| App hosting | Railway, Render, or Fly.io | All three run a long-lived Node process (this app needs one — it's not a serverless-function shape), handle HTTPS termination automatically, and support health checks + rollbacks out of the box |
| Database | Neon or Supabase (managed Postgres) | Managed backups, point-in-time restore, and a connection string that drops straight into `DATABASE_URL` |
| Email | Resend | Already the integrated provider — just add `RESEND_API_KEY` |
| Error monitoring | Sentry | Add `@sentry/node` (server) and `@sentry/react` (client) if you want this; not included by default to avoid a dependency nobody asked for yet |

Vercel is a reasonable alternative for the frontend specifically, but since this app is a single Express server (not separated into a static frontend + serverless API), deploying it on a platform built for long-running Node processes (Railway/Render/Fly) is simpler than adapting it to Vercel's serverless model.

### Deploying

1. Provision a Postgres database, get its connection string.
2. Set environment variables on your platform: at minimum `DATABASE_URL`, `JWT_SECRET`, `APP_URL`, `NODE_ENV=production`. Add `RESEND_API_KEY`/`EMAIL_FROM`/`ADMIN_NOTIFICATION_EMAILS` and `OPENAI_API_KEY` for email and AI.
3. Build (`npm run build`) and start (`npm start`). `npm start` applies any pending migrations from `migrations/` before the server boots, so schema changes ship with the code. Never run `drizzle-kit push` against production.
5. Point your domain at the platform (see below).
6. Go to `/signup` and create the first account. `npm run db:seed` refuses to run in production, so this is how you get your first manager: the very first signup on an instance with zero managers is automatically granted the manager role and logged straight in. Every signup after that goes through the normal pending-approval queue, reviewed from the manager dashboard.

### Custom domain

No production domain has been configured — `APP_URL` should be set to whatever you actually control. Once you have one:

1. **DNS**: add the A/CNAME record your hosting platform's dashboard gives you for the domain (each platform's instructions differ slightly; Railway/Render/Fly all provide one directly).
2. **HTTPS**: Railway/Render/Fly all provision and renew TLS certificates automatically once DNS is pointed at them — no separate step.
3. **WWW redirect**: decide whether the canonical URL is `https://APP_DOMAIN` or `https://www.APP_DOMAIN`, and set up a redirect from the other. Most platforms support this in their domain settings directly.
4. **Update `APP_URL`** to the final domain — this feeds every email link and the OG image meta tags.

### Email domain (SPF / DKIM / DMARC)

For production email to land in inboxes instead of spam, the sending domain needs to be verified with your email provider:

1. In Resend (or whichever provider you use), add and verify your sending domain.
2. Add the DNS records Resend gives you — typically a DKIM TXT record and an SPF-contributing entry (Resend documents the exact records at verification time; they vary by provider and aren't safe to guess here).
3. Add a DMARC TXT record at `_dmarc.APP_DOMAIN`, e.g. `v=DMARC1; p=none; rua=mailto:you@APP_DOMAIN` to start (monitoring-only), tightening to `p=quarantine` or `p=reject` once you've confirmed legitimate mail passes.
4. Set `EMAIL_FROM` to an address on the verified domain, e.g. `InternOps <noreply@APP_DOMAIN>`.

None of this is configured in this repository — it requires an actual domain and provider account, which only you can provision.

## What's intentionally not included

- **No error monitoring (Sentry, etc.) wired in** — see the Deployment table above for why, and how to add it.
- **No CAPTCHA/Turnstile on the public application form** — the endpoint is rate-limited server-side, which covers the most common abuse pattern, but a determined attacker with rotating IPs isn't stopped by that alone. Add Cloudflare Turnstile if the public form sees real abuse.
