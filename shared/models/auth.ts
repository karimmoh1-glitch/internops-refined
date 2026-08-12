import { sql } from "drizzle-orm";
import { index, uniqueIndex, jsonb, pgTable, text, timestamp, varchar, boolean, integer } from "drizzle-orm/pg-core";
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
  role: varchar("role").notNull().default("intern"),
  companyId: varchar("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
  // Null = active. Set = blocked from login and every authenticated
  // request, checked immediately (not just at next login) — same pattern
  // as userDevices.revokedAt below. History (tasks, logs, chat) is left
  // intact; deactivating never deletes data.
  deactivatedAt: timestamp("deactivated_at"),
});

export const invitations = pgTable("invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  token: varchar("token").notNull().unique(),
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
  token: varchar("token").notNull().unique(),
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
  submission: text("submission"),
  submittedAt: timestamp("submitted_at"),
  feedback: text("feedback"),
  blockedReason: text("blocked_reason"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_tasks_company_status").on(table.companyId, table.status),
  index("idx_tasks_assignee_status").on(table.assigneeId, table.status),
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
export const insertSignupTokenSchema = createInsertSchema(signupTokens).omit({ id: true, createdAt: true });
export const insertTeamMessageSchema = createInsertSchema(teamMessages).omit({ id: true, createdAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });
export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true });
export const insertChannelMemberSchema = createInsertSchema(channelMembers).omit({ id: true, joinedAt: true });
export const insertChannelMessageSchema = createInsertSchema(channelMessages).omit({ id: true, createdAt: true });
export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({ id: true, firstSeenAt: true, lastSeenAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true });

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

export const TASK_STATUSES = ["todo", "in_progress", "in_review", "completed", "blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
