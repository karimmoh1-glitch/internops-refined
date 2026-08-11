# InternOps Demo Script

A ~7-minute walkthrough of the real, working product. Everything below is a real database action — nothing is mocked.

## Setup (once)

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET at minimum
npm run db:push           # create the schema
npm run db:seed           # create demo org, manager, interns, applications
npm run dev
```

`npm run db:seed` prints the demo accounts when it finishes. It refuses to run against `NODE_ENV=production` and no-ops if it's already been run once.

### Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Manager | `demo-manager@internops.local` | `DemoPass123!` |
| Intern (active project, logged work, has feedback) | `alex@internops.local` | `DemoPass123!` |
| Intern (plan submitted, awaiting review) | `maya@internops.local` | `DemoPass123!` |
| Intern (just assigned, nothing started) | `jordan@internops.local` | `DemoPass123!` |

Development-only — never enable these in a production deployment.

---

## The walkthrough

### 1. Landing page (`/`)

Open the app logged out. Point out the hero, the three feature cards, and the "How It Works" steps — this is the real marketing page a prospective company would see, not a mockup.

### 2. The public application (`/apply/internops-demo`)

This is the demo org's live public application page — the exact URL a manager gets from their dashboard to share with candidates. Show the form (name, email, password, skills, motivation, links) without submitting — or submit a real test application to show step 3 for real.

> **If you submit one live**: it becomes a real row in the `applications` table, visible immediately in the manager dashboard's Applications panel with a "Pending" badge.

### 3. Manager: applications review

Log in as `demo-manager@internops.local`. The dashboard opens directly to the Applications panel with the pending count front and center — not buried under decorative analytics.

- Point out **Priya Sharma** — a real pending application with skills, motivation, and a GitHub link — and **Sam Rivera**, already rejected with an internal reviewer note.
- Open Priya's application, walk through Approve / Reject / the reviewer-notes field.
- If you approve it, a real `intern` user account is created immediately, with the password Priya set when she applied — she could log in right now.

### 4. Manager: the dashboard proper

Scroll to Intern Overview. Three interns, three different real states:
- **Jordan Lee** — just assigned, no plan yet
- **Maya Patel** — plan submitted, sitting in the "Review Now" queue at the top of the dashboard
- **Alex Johnson** — active project, 50% complete, real logged work

Expand Maya's plan in "Review Now": three real AI-generated weekly milestones, each with deliverables and success criteria. Approve it (or request a revision with a comment) — this is a real status transition, not a demo animation.

### 5. Intern: doing the work

Sign out, log in as `alex@internops.local`. This is deliberately a much simpler screen than the manager's — "what do I need to do" front and center. Open the InternOps Website Redesign project: an approved plan, broken into weeks and days, each subtask loggable individually. Point out the existing log entries and the manager's inline feedback on them.

Optionally: expand a not-yet-logged subtask, type real work into "What did you do for this task?", hit Log. Watch the completion percentage and the weekly chart update immediately.

### 6. Manager: closing the loop

Back as the manager, the intern's new log entry is visible immediately (poll interval, no refresh trickery needed for the demo — just navigate back to the intern's project). Add a comment on it. That comment shows up for the intern the next time they load the page, with a notification waiting for them.

### 7. Chat and Settings (optional, time permitting)

- `/chat` — real Slack-style channels: `#general` (auto-created, every teammate is a member) and a per-project channel for each assigned project.
- `/settings` → Devices — show that logging in from a new browser creates a new device row, and that revoking a device signs it out immediately, even mid-session, even with an otherwise still-valid token. This is enforced server-side on every request, not a client-side toggle.

---

## What this demo does *not* claim

- No real email is being sent (no `RESEND_API_KEY` configured in this environment) — email content and delivery logic are real and tested, but nothing lands in an inbox until a production email provider is wired up.
- No real production deployment, domain, or hosting exists yet — this is running on `localhost`.
- AI plan generation falls back to a structured non-AI generator unless `OPENAI_API_KEY` is set.

See `README.md` for what's needed to take this from "runs on my machine" to a real deployed product.
