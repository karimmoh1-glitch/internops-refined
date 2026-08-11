# InternOps

## Overview

InternOps is an AI-powered intern management SaaS platform. Managers sign up with company name, manager name, email, and password. Managers invite interns via secure token links (48-hour expiry). Interns accept invites, set passwords, and receive project assignments. The project workflow: manager assigns project (title, idea, minimum total hours) → intern uses AI planning workspace (split layout with AI assistant panel + plan builder) to create time-allocated execution plans → plan versioning system with draft/submitted/approved states → manager reviews with comments and version history, approves or requests revision → upon approval, project enters execution mode with locked plan and logging under each week task. Interns can log multiple times per day or week under each week (unlimited entries, each auto-timestamped). System features JWT authentication, multi-company architecture, invite validation, in-app notifications, and clean minimal light-theme UI.

## Recent Changes (Feb 2026)

- Email service uses Resend API via RESEND_API_KEY env var, sending from noreply@internops.dev
- Password reset tokens and signup verification tokens stored in PostgreSQL (password_reset_tokens, signup_tokens tables) instead of in-memory Maps for persistence across restarts/deploys
- Email links use REPLIT_DOMAINS for correct URLs in both dev and production
- Removed unused dependencies: @replit/ai-modelfarm, @replit/object-storage, nodemailer
- Express pinned to v4.21.2 for compatibility with vite.ts catch-all route syntax
- Notification deep-linking: all notifications include link field for direct navigation to relevant page/section
- Manager dashboard URL params: ?view=review, ?view=interns, ?projectId=xxx auto-navigate to correct section
- Intern dashboard URL params: ?projectId=xxx auto-selects project workspace
- Stat button filtering: Interns/Projects/Active/Pending Review cards are clickable filters on manager dashboard
- Improved plan review UX: "Review Now" header, prominent intern names, larger Approve button
- Daily logging: weekly_logs table has day_number column, execution tab shows Day 1-N under each week
- Unified AI Companion: merged chat + actions into single conversational AI panel that detects action intents ([ACTION:MODIFY_PLAN], [ACTION:GENERATE_PLAN], [ACTION:DELETE_PLAN]) and executes automatically
- AI duration planning: AI guides intern through choosing hours/day, days/week, number of weeks before generating plan
- AI supports parameterized plan generation: [ACTION:GENERATE_PLAN:hoursPerDay,daysPerWeek,numberOfWeeks]
- Subtask-level logging: weekly_logs table has subtask_index and day_number columns for granular work tracking
- Intern dashboard redesign: single-page workspace with project list → project workspace navigation
  - Left panel: unified AI companion (chat + quick actions like Generate Plan, Start Over) - ALL plan creation/editing happens here
  - Right panel: display-only view showing current plan and execution logs (no editing controls)
  - Daily execution logging: each week shows Day 1-N, each day shows deliverables with log inputs
- Manager dashboard enhancements:
  - Subtask-level completion tracking with progress bars per deliverable
  - Overall completion percentage per intern across all projects
  - "Delete All Projects" button per intern (DELETE /api/projects/intern/:internId)
  - Per-week subtask expansion showing individual deliverable progress with checkmarks
  - Clickable stat cards for filtering (Interns/Projects/Active/Pending Review)
  - Deep-link support from notifications to specific projects/interns
- New API routes: POST /api/ai/action (AI plan actions), DELETE /api/projects/intern/:internId (bulk delete), DELETE /api/plan-versions/project/:projectId (plan reset)
- AI system prompt updated: conversational action detection replaces "Apply AI Changes" button
- AI context fix: work logs now correctly use weekNumber, createdAt, logText fields with subtask info
- Manager project edit/delete: managers can edit title, idea, min hours or delete projects with cascading cleanup
- AI full project context: AI chat receives manager comments, revision history, work logs, project status
- AI revision guidance: when manager requests revision, AI auto-generates actionable improvement steps as notification
- Complete rebuild from task-based/12-week fixed system to flexible plan versioning + unlimited logging system
- Two roles: admin and intern (UI displays "Manager" everywhere, database role stays "admin")
- New database tables: plan_versions, comments, weekly_logs (with subtask_index), log_comments (created via SQL)
- Updated projects table with title, idea, minimum_total_hours columns
- Plan versioning: each submission creates new version (draft → submitted → approved)
- Project statuses: assigned → planning → submitted → approved → active
- Clean minimal light/white professional UI theme

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (`client/`)
- **Framework**: React 19 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack React Query
- **Styling**: Tailwind CSS v4 with shadcn/ui components
- **Build Tool**: Vite with path aliases (`@/` → `client/src/`, `@shared/` → `shared/`)
- **Auth Hook**: `client/src/hooks/use-role.ts` provides `useAuth()` with user, token, login, signup, acceptInvite, signOut

### Pages
- **Landing** (`client/src/pages/landing.tsx`): Marketing page shown at "/" for unauthenticated users
- **Login** (`client/src/pages/home.tsx`): Email/password login at "/login"
- **Signup** (`client/src/pages/signup.tsx`): Manager signup at "/signup"
- **Accept Invite** (`client/src/pages/accept-invite.tsx`): Intern invitation acceptance at "/invite/:token"
- **Manager Dashboard** (`client/src/pages/admin-dashboard.tsx`): Invite interns, assign projects (title/idea/min hours), review plans (approve/request revision/comment), view version history, execution tracking with proof viewing
- **Intern Dashboard** (`client/src/pages/intern-dashboard.tsx`): Split AI chat + plan builder, time allocation, plan editor with collapsible weeks, execution mode with weekly logs + proof uploads
- **AppNav** (`client/src/components/app-nav.tsx`): Top nav with notification bell, user info, sign out

### Auth Flow
- Landing page at "/" for unauthenticated users
- Manager signup: POST /api/auth/signup → creates company + manager → JWT token
- Login: POST /api/auth/login → validates email/password → JWT token
- Intern onboarding: Manager creates invite → secure link → intern visits /invite/:token → sets name + password → JWT token
- JWT stored in localStorage as "internops_auth" object with { token, user }
- Bearer token sent in Authorization header

### Backend (`server/`)
- **Framework**: Express 5 on Node.js
- **Database**: PostgreSQL (tables created via SQL, not Drizzle push)
- **Auth**: JWT with Bearer token in Authorization header
- **Auth Middleware**: `requireAuth` (verifies JWT), `requireRole(...roles)` (checks user role)
- **AI Service**: OpenAI gpt-5-nano via Replit AI Integrations
- **File Uploads**: multer with local disk storage in /uploads directory

### API Routes
- `POST /api/auth/signup` - Manager signup (creates company + manager account)
- `POST /api/auth/login` - Login with email/password → JWT token
- `GET /api/auth/me` - Get current user from JWT
- `POST /api/invitations` - Invite intern (Manager only)
- `GET /api/invitations` - List invitations (Manager only)
- `GET /api/invitations/validate/:token` - Validate invite token (public)
- `POST /api/invitations/accept/:token` - Accept invite, create intern account (public)
- `GET /api/interns` - List company interns (Manager only)
- `POST /api/projects` - Assign project with title, idea, minimumTotalHours (Manager only)
- `GET /api/projects` - List projects (role-filtered)
- `GET /api/projects/:id` - Project detail with versions, weeklyLogs, internName
- `POST /api/projects/:id/generate-plan` - Generate AI plan with time params (Intern only)
- `PUT /api/plan-versions/:id` - Update draft plan content (Intern only)
- `POST /api/plan-versions/:id/submit` - Submit plan for review (Intern only)
- `POST /api/plan-versions/:id/approve` - Approve plan (Manager only)
- `POST /api/plan-versions/:id/request-revision` - Request changes with comment (Manager only)
- `GET /api/plan-versions/:id/comments` - Get version comments
- `POST /api/plan-versions/:id/comments` - Add comment (Manager only)
- `PUT /api/projects/:id` - Edit project title/idea/minHours (Manager only)
- `DELETE /api/projects/:id` - Delete project with cascading cleanup (Manager only)
- `POST /api/ai/chat` - AI assistant chat with full project context
- `POST /api/ai/modify-plan` - AI-powered plan modification (Intern only)
- `POST /api/ai/summarize` - Summarize text
- `POST /api/weekly-logs` - Create log entry under a week (Intern only)
- `PUT /api/weekly-logs/:id` - Edit log entry (Intern only)
- `GET /api/weekly-logs/project/:projectId` - Get all log entries for project
- `POST /api/log-comments` - Add comment on log entry (Manager only)
- `GET /api/log-comments/project/:projectId` - Get all log comments for project
- `GET /api/notifications` - List notifications
- `GET /api/notifications/unread-count` - Get unread count
- `PUT /api/notifications/read-all` - Mark all read
- `PUT /api/notifications/:id/read` - Mark single read
- `GET /api/dashboard` - Dashboard stats with interns, projects, versions, logs (Manager only)
- `GET /api/health` - Health check

### Database Tables
- `companies` - id, name, createdAt
- `users` - id, name, email (unique), passwordHash, role (admin/intern), companyId
- `invitations` - id, email, companyId, token (unique), expiresAt, used, createdAt
- `projects` - id, internId, companyId, title, idea, minimumTotalHours, status (assigned/planning/submitted/approved/active), createdAt
- `plan_versions` - id, projectId, versionNumber, contentJson (JSONB with weeks/hours), status (draft/submitted/approved), createdAt
- `comments` - id, versionId, managerId, content, createdAt
- `weekly_logs` - id, projectId, weekNumber, logText, createdAt (multiple entries per week allowed)
- `log_comments` - id, logId, managerId, content, createdAt
- `notifications` - id, userId, title, message, read, link, createdAt
- `password_reset_tokens` - id, email, token (unique), expiresAt, used, createdAt
- `signup_tokens` - id, email, companyName, managerName, passwordHash, token (unique), expiresAt, used, createdAt
- `sessions` - (legacy, kept for compatibility)

### AI Integration
- `server/services/aiService.ts` uses OpenAI SDK with `gpt-4o-mini`
- `generatePlan(projectIdea, totalHours, numberOfWeeks)` - returns weekly milestones with time allocation
- `aiChat(projectContext, messages)` - ChatGPT-like assistant with full project context (plan, comments, logs, status)
- `modifyPlan(currentPlan, instruction, projectIdea)` - AI-powered plan editing based on intern instructions
- `generateRevisionGuidance(managerComment, currentPlan, projectIdea)` - generates actionable revision steps
- `summarizeLog(text)` - summarize log text
- Falls back to structured fallback responses if AI call fails

### Build & Deployment
- **Development**: `npm run dev` runs Express with Vite middleware for HMR
- **Production Build**: `npm run build`
- **Production Start**: `npm start` runs `node dist/index.cjs`

### Security
- JWT tokens with 24h expiry
- JWT_SECRET from environment variable (falls back to dev secret)
- bcrypt password hashing (10 rounds)
- Invite tokens: crypto.randomBytes(32) with 48-hour expiry
- Role-based access control middleware
- Auth-protected file uploads (/uploads requires JWT)
