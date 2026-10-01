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

Production runs on **Vercel** (project `internops`, https://internops.vercel.app) with a **Neon** Postgres database. The Render service that used to host the app is retired.

How it fits together:

- `vercel.json` builds the client to `dist/public` (served from the CDN) and bundles the whole Express app into one serverless function at `api/index.js` (`server/vercel.ts`). `/api/*` and `/i/:slug` are rewritten to the function; everything else falls back to `index.html`.
- The build command is `npm run build && npm run db:migrate`, so pending migrations in `migrations/` are applied to the database on every deploy.
- Scheduled work (morning digest, alumni auto-transition, abandoned-shift sweep) runs through `/api/cron/*`, called by Vercel Cron with `Authorization: Bearer $CRON_SECRET`. On Vercel's Hobby plan crons are daily, so the shift sweep also runs lazily from the requests that read live session state.
- Pulse Chat streams over Server-Sent Events; the function's `maxDuration` is 60s.
- Rate limiting is per function instance (in memory). It still bounds abuse, but counts are not shared across instances.

Environment variables (set in the Vercel project, Production): `DATABASE_URL`, `JWT_SECRET`, `CRON_SECRET`, `APP_URL`, and optionally `OPENAI_API_KEY`, `PULSE_MODEL`, `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFICATION_EMAILS`, `MORNING_DIGEST_HOUR_UTC`.

### Deploying

```bash
npx vercel --prod
```

The first account that signs up on an empty database becomes the manager; every later signup is a pending request a manager approves.

### Running it anywhere else

The app is still a single long-lived Express server (`npm run build && npm start`): `npm start` applies migrations and boots `dist/index.cjs`, which serves the API and the built client and runs the schedulers in-process. Any host that runs a Node process works.

### Custom domain

Add the domain in the Vercel project settings, point DNS at Vercel, then set `APP_URL` to the final domain — it feeds every email link and the canonical/OpenGraph tags.

### Email domain (SPF / DKIM / DMARC)

For production email to land in inboxes instead of spam, verify the sending domain with Resend, add the DKIM/SPF records it gives you plus a DMARC record at `_dmarc.<domain>`, and set `EMAIL_FROM` to an address on that domain. None of this is in the repository — it requires a domain and provider account only you can provision.

## What's intentionally not included

- **No error monitoring (Sentry, etc.) wired in** — see the Deployment table above for why, and how to add it.
- **No CAPTCHA/Turnstile on the public application form** — the endpoint is rate-limited server-side, which covers the most common abuse pattern, but a determined attacker with rotating IPs isn't stopped by that alone. Add Cloudflare Turnstile if the public form sees real abuse.
