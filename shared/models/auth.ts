import { sql } from "drizzle-orm";
import { index, uniqueIndex, jsonb, pgTable, text, timestamp, varchar, boolean, integer, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: varchar("slug").unique(),
  acceptingApplications: boolean("accepting_applications").notNull().default(false),
  githubToken: varchar("github_token"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email").notNull().unique(),
  passwordHash: varchar("password_hash").notNull(),
  role: varchar("role").notNull().default("intern"), // admin | intern | system (see storage.getOrCreateSystemUser)
  companyId: varchar("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
  // Opt-out, not opt-in — an internal work-tool digest, analogous to the
  // existing notification defaults rather than marketing.
  morningDigestEnabled: boolean("morning_digest_enabled").notNull().default(true),
  // Null = active. Set = blocked from login and every authenticated
  // request, checked immediately (not just at next login) — same pattern
  // as userDevices.revokedAt below. History (tasks, logs, chat) is left
  // intact; deactivating never deletes data.
  deactivatedAt: timestamp("deactivated_at"),
  // Self-service opt-in — the intern controls their own public exposure.
  // Slug is generated once on first enable and kept across future toggles
  // (see storage.setUserPublicProfile) so the shareable link never changes.
  publicProfileEnabled: boolean("public_profile_enabled").notNull().default(false),
  publicProfileSlug: varchar("public_profile_slug").unique(),
  // Institutional credential — admin-awarded only, never self-asserted.
  completionBadgeAwardedAt: timestamp("completion_badge_awarded_at"),
  completionBadgeAwardedByUserId: varchar("completion_badge_awarded_by_user_id").references((): AnyPgColumn => users.id),
  // Set only via storage.transitionUserToAlumni, alongside deactivatedAt
  // (an alumnus can't log in). Tracked separately from deactivatedAt so
  // "formally completed the internship" stays distinguishable from an
  // ordinary deactivation (disciplinary, mistake, leave) — conflating the
  // two would make future reactivation logic unsafe.
  alumniAt: timestamp("alumni_at"),
  // Admin-set, planned end date — distinct from alumniAt (the moment the
  // transition actually happened, manual or automatic). Null means
  // undecided. Once this date is in the past, the daily sweep in
  // alumniAutoTransition.ts moves the intern to alumni automatically using
  // this date as the recorded internshipEndedAt.
  expectedEndDate: timestamp("expected_end_date"),
  // Null = unverified. Non-blocking: an unverified user can still log in
  // and use the app (invite/approval-created accounts are already
  // admin-vouched-for), this just tracks whether the address itself has
  // been confirmed reachable. Set only via a consumed emailVerificationTokens row.
  emailVerifiedAt: timestamp("email_verified_at"),
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  // SHA-256 hex digest of the raw token — the raw value only ever exists
  // in the email link itself, never at rest. Lookups hash the incoming
  // token and compare against this column.
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Public applications to a company's internship program (distinct from
// invitations: an invitation is admin-initiated for a specific known
// person; an application is applicant-initiated via the company's public
// apply page, and requires admin review before an account is created).
export const applications = pgTable("applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  email: varchar("email").notNull(),
  passwordHash: varchar("password_hash").notNull(),
  skills: text("skills"),
  motivation: text("motivation"),
  githubUrl: text("github_url"),
  linkedinUrl: text("linkedin_url"),
  portfolioUrl: text("portfolio_url"),
  status: varchar("status").notNull().default("pending"), // pending | under_review | approved | rejected | needs_information
  reviewerNotes: text("reviewer_notes"),
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  // Dismissed = hidden from the main dashboard's Applications panel to
  // keep it tidy, without deleting the record — full history (including
  // dismissed ones) stays visible on the dedicated /applications page.
  dismissedAt: timestamp("dismissed_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_applications_company_status").on(table.companyId, table.status),
]);

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internId: varchar("intern_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  title: text("title").notNull(),
  idea: text("idea").notNull(),
  minimumTotalHours: integer("minimum_total_hours").notNull(),
  status: varchar("status").notNull().default("assigned"),
  githubRepoUrl: text("github_repo_url"),
  // Set only when an admin rejects a proposed project (status "rejected"),
  // so the intern still has the explanation the next time they open it —
  // not just in the one-time notification that announced it.
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const planVersions = pgTable("plan_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  versionNumber: integer("version_number").notNull(),
  contentJson: jsonb("content_json").$type<Record<string, unknown>>().notNull(),
  status: varchar("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  versionId: varchar("version_id").notNull().references(() => planVersions.id),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const weeklyLogs = pgTable("weekly_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  weekNumber: integer("week_number").notNull(),
  subtaskIndex: integer("subtask_index"),
  dayNumber: integer("day_number"),
  logText: text("log_text").notNull(),
  commitRef: text("commit_ref"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logComments = pgTable("log_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  logId: varchar("log_id").notNull().references(() => weeklyLogs.id),
  managerId: varchar("manager_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull().default("Notification"),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  link: text("link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  // See invitations.tokenHash above — same hash-at-rest convention.
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Purpose-dedicated (not a shared/generic token table with a "purpose"
// column) — same architecture as passwordResetTokens/invitations, so a
// verification token is structurally incapable of being accepted by the
// password-reset or invite-accept endpoints, and vice versa.
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const signupTokens = pgTable("signup_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  companyName: text("company_name").notNull(),
  managerName: text("manager_name").notNull(),
  passwordHash: varchar("password_hash").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const teamMessages = pgTable("team_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  mode: varchar("mode").notNull(),
  role: varchar("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const channels = pgTable("channels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  type: varchar("type").notNull(), // "general" | "project" | "dm" | "custom"
  name: text("name").notNull(),
  projectId: varchar("project_id").references(() => projects.id),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_channels_company_type").on(table.companyId, table.type),
]);

export const channelMembers = pgTable("channel_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_channel_members_unique").on(table.channelId, table.userId),
]);

export const channelMessages = pgTable("channel_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelId: varchar("channel_id").notNull().references(() => channels.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_channel_messages_channel_created").on(table.channelId, table.createdAt),
]);

export const userDevices = pgTable("user_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Random token minted server-side at login and embedded as a JWT claim.
  // Never derived from user-agent/IP/localStorage — those are spoofable
  // client-controlled values and must never be authorization inputs.
  deviceId: varchar("device_id").notNull().unique(),
  name: text("name"),
  platform: text("platform"),
  browser: text("browser"),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  revokedAt: timestamp("revoked_at"),
}, (table) => [
  index("idx_user_devices_user").on(table.userId),
]);

// Generic unit of assigned work — distinct from the AI-planned
// project/weeklyLog flow above. A task can optionally belong to a project,
// but doesn't have to; it's the general-purpose "here's a thing to do" unit
// used by the task dashboards, completion tracking, and activity feed.
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  title: text("title").notNull(),
  description: text("description"),
  assigneeId: varchar("assignee_id").notNull().references(() => users.id),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  projectId: varchar("project_id").references(() => projects.id),
  priority: varchar("priority").notNull().default("medium"), // low | medium | high
  status: varchar("status").notNull().default("todo"), // todo | in_progress | in_review | completed | blocked
  dueDate: timestamp("due_date"),
  // Set once, the first time a task moves todo -> in_progress (not
  // overwritten on later transitions e.g. blocked -> in_progress again) —
  // this is what powers the "Started X" activity-timeline event and shift
  // summaries, neither of which existed before this could be tracked.
  startedAt: timestamp("started_at"),
  submission: text("submission"),
  submittedAt: timestamp("submitted_at"),
  feedback: text("feedback"),
  blockedReason: text("blocked_reason"),
  completedAt: timestamp("completed_at"),
  // Free-form skill labels an admin tags a task with (e.g. "React", "SQL").
  // Aggregated per intern from completed tasks to infer a skill graph —
  // see shared/skills.ts. Not a normalized catalog on purpose: task volume
  // per company is small, so a skills/task_skills join table would add
  // real schema complexity for no v1 benefit.
  skillTags: jsonb("skill_tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // A single upstream dependency, not a full DAG — deliberately simple.
  // Signals/next-best-action reason about "downstream" work by querying
  // WHERE dependsOnTaskId = X, so one task can still block many others.
  dependsOnTaskId: varchar("depends_on_task_id").references((): AnyPgColumn => tasks.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tasks_company_status").on(table.companyId, table.status),
  index("idx_tasks_assignee_status").on(table.assigneeId, table.status),
  index("idx_tasks_depends_on").on(table.dependsOnTaskId),
]);

// A "shift" — deliberately just start/end/duration, not invasive activity
// tracking. What the intern *did* during a session is derived on read by
// correlating task timestamps (startedAt/submittedAt/completedAt) that
// fall inside [startedAt, endedAt], not stored redundantly here.
export const workSessions = pgTable("work_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  internId: varchar("intern_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  // Persisted rather than always recomputed from started/endedAt so a
  // completed session's duration is a fixed historical fact.
  durationSeconds: integer("duration_seconds"),
  status: varchar("status").notNull().default("active"), // active | completed
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_work_sessions_intern_started").on(table.internId, table.startedAt),
  index("idx_work_sessions_company_started").on(table.companyId, table.startedAt),
  // DB-level guarantee against a double "Start Shift" (e.g. two rapid
  // clicks, or two tabs) racing past an application-level check — at most
  // one active session per intern, enforced by Postgres, not just the API.
  uniqueIndex("idx_work_sessions_one_active_per_intern").on(table.internId).where(sql`status = 'active'`),
]);

// Desktop-companion activity: high-level work-context samples recorded
// only while an intern has explicitly enabled Work Mode for an active
// work_sessions row. Never the content of the work — no keystrokes, no
// screen content, no clipboard, no full URLs (browserDomain is the
// hostname only, never a full URL or its query string). "category" is
// derived server-side from a small known-application map, never inferred
// from content; taskId/projectId is a best-effort correlation with
// whatever task the intern had in_progress during that window, not a
// claim of what was done — see taskCorrelation for exactly how sure that
// correlation is. windowTitle/documentName/browserDomain are all
// independently nullable: null means the OS didn't expose it (usually an
// unmet permission), never an empty guess.
export const workActivities = pgTable("work_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => workSessions.id),
  internId: varchar("intern_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  application: text("application").notNull(),
  category: varchar("category").notNull().default("other"),
  windowTitle: text("window_title"),
  documentName: text("document_name"),
  browserDomain: varchar("browser_domain"),
  idleSeconds: integer("idle_seconds"),
  contextSource: varchar("context_source"), // "applescript" | "win32" | null
  startedAt: timestamp("started_at").notNull(),
  endedAt: timestamp("ended_at").notNull(),
  durationSeconds: integer("duration_seconds").notNull(),
  taskId: varchar("task_id").references(() => tasks.id),
  projectId: varchar("project_id").references(() => projects.id),
  // How taskId was decided: "single_in_progress" (exactly one candidate
  // task, the only case we ever tag) or null (zero or multiple candidates
  // — taskId is null too in that case). Kept distinct from taskId being
  // null so a reader never has to guess whether "no task" means "we
  // checked and there wasn't one" vs. "we didn't bother checking."
  taskCorrelation: varchar("task_correlation"),
  source: varchar("source").notNull().default("desktop_companion"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_work_activities_session").on(table.sessionId),
  index("idx_work_activities_intern_started").on(table.internId, table.startedAt),
]);

// One factual, generated-then-reviewed report per completed work session.
// Every field is computed from real data at generation time (activity
// rollups, real task timestamps, the existing next-best-action engine) —
// nothing here is written by an LLM or invented. internNote is the only
// free-text field, and it's optional intern-added context, never
// required and never silently submitted without the intern seeing it.
export const workSummaries = pgTable("work_summaries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => workSessions.id).unique(),
  internId: varchar("intern_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  durationSeconds: integer("duration_seconds").notNull(),
  primaryProjectId: varchar("primary_project_id").references(() => projects.id),
  activityBreakdown: jsonb("activity_breakdown").$type<{ category: string; label: string; seconds: number }[]>().notNull().default(sql`'[]'::jsonb`),
  tasksCompleted: integer("tasks_completed").notNull().default(0),
  tasksSubmitted: integer("tasks_submitted").notNull().default(0),
  nextStep: text("next_step"),
  internNote: text("intern_note"),
  generatedAt: timestamp("generated_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  submittedAt: timestamp("submitted_at"),
}, (table) => [
  index("idx_work_summaries_intern_generated").on(table.internId, table.generatedAt),
]);

export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  actorUserId: varchar("actor_user_id").references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id),
  action: varchar("action").notNull(),
  targetType: varchar("target_type"),
  targetId: varchar("target_id"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_audit_logs_company_created").on(table.companyId, table.createdAt),
]);

// AI-written (or deterministic-fallback) summaries of an intern's completed
// work, generated on admin request. Append-only history rather than a
// mutable field on users — mirrors planVersions: an admin can regenerate
// without destroying a version they may have already copy-pasted into a
// review.
export const performanceNarratives = pgTable("performance_narratives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  generatedByUserId: varchar("generated_by_user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  aiGenerated: boolean("ai_generated").notNull().default(true),
  taskSnapshotCount: integer("task_snapshot_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_perf_narratives_user_created").on(table.userId, table.createdAt),
]);

// The real concurrency/double-send guard for the morning digest: insert
// first (onConflictDoNothing), skip sending if no row was newly inserted.
// Correct even under process restarts or, if this app is ever scaled to
// more than one instance, concurrent sweeps — a DB unique constraint,
// not an assumption about instance count.
export const digestRuns = pgTable("digest_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sentDate: varchar("sent_date").notNull(), // "YYYY-MM-DD"
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_digest_runs_user_date").on(table.userId, table.sentDate),
]);

// A snapshot, not a log — upserted (unique on userId) each time an admin
// transitions or re-transitions someone to alumni, unlike
// performanceNarratives' intentional history. Exists so "who were our
// best interns" queries don't depend on live task data forever (tasks
// could later be reassigned or deleted).
export const alumniRecords = pgTable("alumni_records", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  internshipStartedAt: timestamp("internship_started_at"),
  internshipEndedAt: timestamp("internship_ended_at").notNull().defaultNow(),
  totalTasksCompleted: integer("total_tasks_completed").notNull().default(0),
  totalTasksAssigned: integer("total_tasks_assigned").notNull().default(0),
  skillTagCounts: jsonb("skill_tag_counts").$type<{ tag: string; count: number }[]>().notNull().default(sql`'[]'::jsonb`),
  completionBadgeAwarded: boolean("completion_badge_awarded").notNull().default(false),
  finalNarrative: text("final_narrative"),
  transitionedByUserId: varchar("transitioned_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_alumni_records_company_ended").on(table.companyId, table.internshipEndedAt),
]);

// Lightweight, checklist-style "what does finished mean" for a project —
// deliberately not a full task-management subsystem. Criteria are
// independent of tasks (a criterion can optionally reference one), and a
// project isn't considered fully done just because all tasks are; the
// manager marks criteria complete explicitly.
export const projectCompletionCriteria = pgTable("project_completion_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  projectId: varchar("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  optional: boolean("optional").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  completedByUserId: varchar("completed_by_user_id").references(() => users.id),
  taskId: varchar("task_id").references(() => tasks.id),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_project_criteria_project").on(table.projectId, table.sortOrder),
]);

// Signals (Manager Signals / workflow-stall detector) are computed live
// from real task data every request, never stored — a stored "signal" row
// would drift from reality the moment its underlying task changes. What
// DOES need persistence is the manager's dismiss/snooze choice, keyed by a
// deterministic signalKey (e.g. "overdue:<taskId>") so it's stable across
// recomputation and re-applies automatically if the same condition recurs
// after a snooze expires, without ever needing a cleanup job — an expired
// snoozedUntil just stops matching in the WHERE clause.
export const signalDismissals = pgTable("signal_dismissals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  signalKey: varchar("signal_key").notNull(),
  dismissedByUserId: varchar("dismissed_by_user_id").notNull().references(() => users.id),
  snoozedUntil: timestamp("snoozed_until"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_signal_dismissals_company_key").on(table.companyId, table.signalKey),
]);

export const insertApplicationSchema = createInsertSchema(applications).omit({ id: true, createdAt: true, reviewedAt: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true });
export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export const insertPlanVersionSchema = createInsertSchema(planVersions).omit({ id: true, createdAt: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export const insertWeeklyLogSchema = createInsertSchema(weeklyLogs).omit({ id: true, createdAt: true });
export const insertLogCommentSchema = createInsertSchema(logComments).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({ id: true, createdAt: true });
export const insertSignupTokenSchema = createInsertSchema(signupTokens).omit({ id: true, createdAt: true });
export const insertTeamMessageSchema = createInsertSchema(teamMessages).omit({ id: true, createdAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true });
export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({ id: true, joinedAt: true });
export const insertChannelMessageSchema = createInsertSchema(channelMessages).omit({ id: true, createdAt: true });
export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({ id: true, firstSeenAt: true, lastSeenAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks, { skillTags: z.array(z.string()) }).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWorkSessionSchema = createInsertSchema(workSessions).omit({ id: true, createdAt: true });
export const insertWorkActivitySchema = createInsertSchema(workActivities).omit({ id: true, createdAt: true });
export const insertWorkSummarySchema = createInsertSchema(workSummaries, { activityBreakdown: z.array(z.object({ category: z.string(), label: z.string(), seconds: z.number() })) }).omit({ id: true, generatedAt: true });
export const insertPerformanceNarrativeSchema = createInsertSchema(performanceNarratives).omit({ id: true, createdAt: true });
export const insertDigestRunSchema = createInsertSchema(digestRuns).omit({ id: true, createdAt: true });
export const insertAlumniRecordSchema = createInsertSchema(alumniRecords).omit({ id: true, createdAt: true });
export const insertProjectCompletionCriterionSchema = createInsertSchema(projectCompletionCriteria).omit({ id: true, createdAt: true, completedAt: true, completedByUserId: true });
export const insertSignalDismissalSchema = createInsertSchema(signalDismissals).omit({ id: true, createdAt: true });

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Application = typeof applications.$inferSelect;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Project = typeof projects.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type PlanVersion = typeof planVersions.$inferSelect;
export type InsertPlanVersion = z.infer<typeof insertPlanVersionSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type WeeklyLog = typeof weeklyLogs.$inferSelect;
export type InsertWeeklyLog = z.infer<typeof insertWeeklyLogSchema>;
export type LogComment = typeof logComments.$inferSelect;
export type InsertLogComment = z.infer<typeof insertLogCommentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = z.infer<typeof insertEmailVerificationTokenSchema>;
export type SignupToken = typeof signupTokens.$inferSelect;
export type InsertSignupToken = z.infer<typeof insertSignupTokenSchema>;
export type TeamMessage = typeof teamMessages.$inferSelect;
export type InsertTeamMessage = z.infer<typeof insertTeamMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type ChannelMember = typeof channelMembers.$inferSelect;
export type InsertChannelMember = z.infer<typeof insertChannelMemberSchema>;
export type ChannelMessage = typeof channelMessages.$inferSelect;
export type InsertChannelMessage = z.infer<typeof insertChannelMessageSchema>;
export type UserDevice = typeof userDevices.$inferSelect;
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type WorkSession = typeof workSessions.$inferSelect;
export type InsertWorkSession = z.infer<typeof insertWorkSessionSchema>;
export type WorkActivity = typeof workActivities.$inferSelect;
export type InsertWorkActivity = z.infer<typeof insertWorkActivitySchema>;
export type WorkSummary = typeof workSummaries.$inferSelect;
export type InsertWorkSummary = z.infer<typeof insertWorkSummarySchema>;
export type PerformanceNarrative = typeof performanceNarratives.$inferSelect;
export type InsertPerformanceNarrative = z.infer<typeof insertPerformanceNarrativeSchema>;
export type DigestRun = typeof digestRuns.$inferSelect;
export type InsertDigestRun = z.infer<typeof insertDigestRunSchema>;
export type AlumniRecord = typeof alumniRecords.$inferSelect;
export type InsertAlumniRecord = z.infer<typeof insertAlumniRecordSchema>;
export type ProjectCompletionCriterion = typeof projectCompletionCriteria.$inferSelect;
export type InsertProjectCompletionCriterion = z.infer<typeof insertProjectCompletionCriterionSchema>;
export type SignalDismissal = typeof signalDismissals.$inferSelect;
export type InsertSignalDismissal = z.infer<typeof insertSignalDismissalSchema>;

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "completed", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
