# InternOps

InternOps is an AI-powered intern management platform. Managers invite interns, assign projects, and review AI-assisted execution plans; interns plan their work with an AI assistant and log progress week by week.

## Tech Stack

- **Frontend**: React 19 + TypeScript, Wouter, TanStack React Query, Tailwind CSS v4, shadcn/ui, Vite
- **Backend**: Express 5 on Node.js, JWT auth, PostgreSQL
- **AI**: OpenAI SDK for plan generation, chat, and revision guidance

## Getting Started

### Prerequisites

- Node.js
- A PostgreSQL database

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Set the required environment variables (see below).
3. Push the database schema:
   ```bash
   npm run db:push
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```

### Environment Variables

| Variable | Description |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret used to sign JWT auth tokens |
| `OPENAI_API_KEY` | OpenAI API key for AI plan generation and chat |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `APP_URL` | Base URL used in generated email links |

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run the Express server with Vite middleware for local development |
| `npm run build` | Build the production bundle |
| `npm start` | Run the production build |
| `npm run db:push` | Push the Drizzle schema to the database |
| `npm run db:studio` | Open Drizzle Studio |

## Project Structure

- `client/` — React frontend
- `server/` — Express backend, routes, and services
- `shared/` — Types and schema shared between client and server

For a more detailed architecture overview, see [replit.md](replit.md).
