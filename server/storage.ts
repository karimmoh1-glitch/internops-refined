import { eq, desc, and, count, inArray, gt, isNull, isNotNull, sql, or, gte, lte, ilike, ne } from "drizzle-orm";
import { db } from "./db";
import { lt } from "drizzle-orm";
import crypto from "crypto";
import { aggregateSkillTags } from "@shared/skills";
import { hashToken } from "./services/tokenService";
import {
  users, companies, invitations, projects, planVersions, comments, weeklyLogs, logComments, notifications, chatMessages,
  channels, channelMembers, channelMessages, userDevices, auditLogs, applications, tasks, performanceNarratives, digestRuns, alumniRecords,
  projectCompletionCriteria, signalDismissals, workSessions, workActivities, workSummaries, taskSubmissions,
  passwordResetTokens as resetTokensTable, emailVerificationTokens as verifyTokensTable,
  taskComments, assistantMessages,
  type User, type InsertUser,
  type Company, type InsertCompany,
  type Invitation, type InsertInvitation,
  type Application, type InsertApplication,
  type Project, type InsertProject,
  type PlanVersion, type InsertPlanVersion,
  type Comment, type InsertComment,
  type WeeklyLog, type InsertWeeklyLog,
  type LogComment, type InsertLogComment,
  type Notification, type InsertNotification,
  type ChatMessage, type InsertChatMessage,
  type Channel, type InsertChannel,
  type ChannelMember, type InsertChannelMember,
  type ChannelMessage, type InsertChannelMessage,
  type PasswordResetToken, type InsertPasswordResetToken,
  type EmailVerificationToken, type InsertEmailVerificationToken,
  type UserDevice, type InsertUserDevice,
  type AuditLog, type InsertAuditLog,
  type TaskComment, type InsertTaskComment,
  type AssistantMessage, type InsertAssistantMessage,
  type Task, type InsertTask,
  type PerformanceNarrative, type InsertPerformanceNarrative,
  type DigestRun,
  type AlumniRecord,
  type ProjectCompletionCriterion,
  type SignalDismissal,
  type WorkSession,
  type WorkActivity, type InsertWorkActivity,
  type WorkSummary, type InsertWorkSummary,
  type TaskSubmission, type InsertTaskSubmission,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPublicSlug(slug: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  getOrCreateSystemUser(companyId: string): Promise<User>;
  recordDigestRun(userId: string, sentDate: string): Promise<boolean>;
  setUserMorningDigestEnabled(id: string, enabled: boolean): Promise<User | undefined>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  getInternsByCompany(companyId: string): Promise<User[]>;
  getAdminsByCompany(companyId: string): Promise<User[]>;
  anyAdminExists(): Promise<boolean>;
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  setUserDeactivated(id: string, deactivated: boolean): Promise<User | undefined>;
  setUserPublicProfile(id: string, enabled: boolean): Promise<User | undefined>;
  setUserCompletionBadge(id: string, awarded: boolean, awardedByUserId: string | null): Promise<User | undefined>;
  transitionUserToAlumni(id: string, transitionedByUserId: string, endDate?: Date): Promise<{ user: User; alumniRecord: AlumniRecord }>;
  setUserExpectedEndDate(id: string, expectedEndDate: Date | null): Promise<User | undefined>;
  getInternsWithPastExpectedEndDate(): Promise<User[]>;
  getAlumniByCompany(companyId: string): Promise<(User & { alumniRecord: AlumniRecord })[]>;
  reactivateAlumnus(id: string): Promise<User | undefined>;
  promoteToAdmin(id: string): Promise<User | undefined>;
  demoteToIntern(id: string): Promise<User | undefined>;
  deleteUserPermanently(id: string): Promise<void>;

  createCompany(data: InsertCompany): Promise<Company>;
  getAllCompanies(): Promise<Company[]>;
  getCompanyById(id: string): Promise<Company | undefined>;
  getCompanyBySlug(slug: string): Promise<Company | undefined>;
  updateCompanyAcceptingApplications(id: string, accepting: boolean): Promise<Company | undefined>;
  setCompanySlug(id: string, slug: string): Promise<Company | undefined>;

  createInvitation(data: InsertInvitation): Promise<Invitation>;
  getInvitationByToken(token: string): Promise<Invitation | undefined>;
  consumeInvitation(token: string): Promise<Invitation | undefined>;
  getInvitationsByCompany(companyId: string): Promise<Invitation[]>;

  createProject(data: InsertProject): Promise<Project>;
  getProjectById(id: string): Promise<Project | undefined>;
  getProjectsByIntern(internId: string): Promise<Project[]>;
  getProjectsByCompany(companyId: string): Promise<Project[]>;
  updateProjectStatus(id: string, status: string, extra?: { rejectionReason?: string }): Promise<Project | undefined>;
  updateProject(id: string, data: { title?: string; idea?: string; minimumTotalHours?: number; githubRepoUrl?: string | null }): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;

  createPlanVersion(data: InsertPlanVersion): Promise<PlanVersion>;
  getPlanVersionsByProject(projectId: string): Promise<PlanVersion[]>;
  getPlanVersionsByProjectIds(projectIds: string[]): Promise<PlanVersion[]>;
  getPlanVersionById(id: string): Promise<PlanVersion | undefined>;
  getLatestPlanVersion(projectId: string): Promise<PlanVersion | undefined>;
  getLatestPlanVersionsByProjectIds(projectIds: string[]): Promise<Map<string, PlanVersion>>;
  updatePlanVersionStatus(id: string, status: string): Promise<PlanVersion | undefined>;
  updatePlanVersionContent(id: string, contentJson: any): Promise<PlanVersion | undefined>;

  createComment(data: InsertComment): Promise<Comment>;
  getCommentsByVersion(versionId: string): Promise<Comment[]>;
  getAllCommentsByProject(projectId: string): Promise<Comment[]>;

  createWeeklyLog(data: InsertWeeklyLog): Promise<WeeklyLog>;
  getWeeklyLogsByProject(projectId: string): Promise<WeeklyLog[]>;
  getWeeklyLogsByProjectIds(projectIds: string[]): Promise<WeeklyLog[]>;
  updateWeeklyLog(id: string, logText: string): Promise<WeeklyLog | undefined>;
  getWeeklyLogById(id: string): Promise<WeeklyLog | undefined>;

  createLogComment(data: InsertLogComment): Promise<LogComment>;
  getLogCommentsByProject(projectId: string): Promise<LogComment[]>;

  deleteProjectsByIntern(internId: string, companyId: string): Promise<number>;
  deletePlanVersionsByProject(projectId: string): Promise<void>;

  // GitHub
  updateProjectGithubUrl(id: string, githubRepoUrl: string | null): Promise<Project | undefined>;
  updateCompanyGithubToken(companyId: string, githubToken: string | null): Promise<Company | undefined>;
  getCompanyGithubToken(companyId: string): Promise<string | null>;

  // Analytics
  getProjectStatusCounts(companyId: string): Promise<{ status: string; count: number }[]>;
  getWeeklyLogsByCompany(companyId: string): Promise<any[]>;
  getLogActivityByCompany(companyId: string): Promise<{ week: string; logs: number }[]>;

  createNotification(data: InsertNotification): Promise<Notification>;
  getNotificationsByUser(userId: string, limit?: number): Promise<Notification[]>;
  markNotificationRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<boolean>;
  deleteAllNotificationsForUser(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Team Chat

  // AI Chat History
  getChatMessages(projectId: string, mode: string): Promise<ChatMessage[]>;
  saveChatMessage(data: InsertChatMessage): Promise<ChatMessage>;
  clearChatMessages(projectId: string, mode: string): Promise<void>;

  // Channels
  createChannel(data: InsertChannel): Promise<Channel>;
  getChannelById(id: string): Promise<Channel | undefined>;
  getChannelsByCompany(companyId: string, userId: string): Promise<(Channel & { unreadCount: number })[]>;
  ensureGeneralChannel(companyId: string): Promise<Channel>;
  createProjectChannel(project: { id: string; companyId: string; title: string; internId: string }): Promise<Channel>;
  getOrCreateDMChannel(companyId: string, userId1: string, userId2: string, user1Name: string, user2Name: string): Promise<Channel>;
  deleteChannel(id: string): Promise<void>;

  // Channel Members
  addChannelMember(channelId: string, userId: string): Promise<ChannelMember>;
  removeChannelMember(channelId: string, userId: string): Promise<void>;
  getChannelMembers(channelId: string): Promise<(ChannelMember & { userName: string; userRole: string })[]>;
  isChannelMember(channelId: string, userId: string): Promise<boolean>;
  updateLastReadAt(channelId: string, userId: string): Promise<void>;

  // Channel Messages
  getChannelMessages(channelId: string, limit?: number): Promise<(ChannelMessage & { userName: string })[]>;
  createChannelMessage(data: InsertChannelMessage): Promise<ChannelMessage>;
  getTotalUnreadCount(companyId: string, userId: string): Promise<number>;

  createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  consumePasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;


  createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  consumeEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined>;
  markUserEmailVerified(userId: string): Promise<void>;

  // Devices
  createUserDevice(data: InsertUserDevice): Promise<UserDevice>;
  getUserDeviceByDeviceId(deviceId: string): Promise<UserDevice | undefined>;
  getUserDevicesByUser(userId: string): Promise<UserDevice[]>;
  touchUserDevice(deviceId: string): Promise<void>;
  renameUserDevice(id: string, userId: string, name: string): Promise<UserDevice | undefined>;
  revokeUserDevice(id: string, userId: string): Promise<UserDevice | undefined>;
  revokeOtherUserDevices(userId: string, keepDeviceId: string | null): Promise<number>;
  getTasksByIds(ids: string[]): Promise<Task[]>;
  createTaskComment(data: InsertTaskComment): Promise<TaskComment>;
  getTaskComments(taskId: string): Promise<(TaskComment & { authorName: string | null; authorRole: string | null })[]>;
  getTaskSubmissionsByTask(taskId: string): Promise<TaskSubmission[]>;
  getWorkActivitiesByTask(taskId: string): Promise<WorkActivity[]>;
  getRecentTaskSubmissionsByCompany(companyId: string, limit?: number): Promise<TaskSubmission[]>;
  createAssistantMessage(data: InsertAssistantMessage): Promise<AssistantMessage>;
  getAssistantMessages(userId: string, limit?: number): Promise<AssistantMessage[]>;
  clearAssistantMessages(userId: string): Promise<void>;
  searchTasks(companyId: string, q: string, assigneeId: string | null, limit?: number): Promise<Task[]>;
  searchProjects(companyId: string, q: string, internId: string | null, limit?: number): Promise<Project[]>;
  searchUsers(companyId: string, q: string, limit?: number): Promise<User[]>;
  searchChannelMessages(userId: string, q: string, limit?: number): Promise<(ChannelMessage & { channelName: string; channelType: string; userName: string })[]>;
  searchApplications(companyId: string, q: string, limit?: number): Promise<Application[]>;
  searchAlumni(companyId: string, q: string, limit?: number): Promise<User[]>;
  setCompanyOnboardingDismissed(companyId: string, dismissed: boolean): Promise<void>;
  endWorkSessionById(sessionId: string, endReason: string, endedByUserId: string | null, endedAt?: Date): Promise<WorkSession | undefined>;
  getActiveWorkSessionsOlderThan(cutoff: Date): Promise<WorkSession[]>;
  createWorkActivitiesForActiveSession(sessionId: string, rows: InsertWorkActivity[]): Promise<WorkActivity[] | null>;
  getLatestWorkActivityForSession(sessionId: string): Promise<WorkActivity | undefined>;
  getWorkActivitiesBySessions(sessionIds: string[]): Promise<WorkActivity[]>;
  getLatestWorkActivitiesForSessions(sessionIds: string[]): Promise<Map<string, WorkActivity>>;

  // Audit log
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByCompany(companyId: string, limit?: number): Promise<AuditLog[]>;

  // Performance narratives
  createPerformanceNarrative(data: InsertPerformanceNarrative): Promise<PerformanceNarrative>;
  getLatestPerformanceNarrative(userId: string): Promise<PerformanceNarrative | undefined>;

  // Applications
  createApplication(data: InsertApplication): Promise<Application>;
  getApplicationById(id: string): Promise<Application | undefined>;
  getApplicationsByCompany(companyId: string): Promise<Application[]>;
  dismissApplication(id: string): Promise<Application | undefined>;
  getPendingApplicationByEmail(companyId: string, email: string): Promise<Application | undefined>;
  getApplicationByEmail(companyId: string, email: string): Promise<Application | undefined>;
  updateApplicationStatus(id: string, status: string, reviewedByUserId: string, reviewerNotes?: string): Promise<Application | undefined>;

  // Tasks
  createTask(data: InsertTask): Promise<Task>;
  getTaskById(id: string): Promise<Task | undefined>;
  getTasksByCompany(companyId: string): Promise<Task[]>;
  getTasksByAssignee(assigneeId: string): Promise<Task[]>;
  getTasksByProjectIds(projectIds: string[]): Promise<Task[]>;
  updateTaskDetails(id: string, data: { title?: string; description?: string | null; assigneeId?: string; projectId?: string | null; priority?: string; dueDate?: Date | null; skillTags?: string[]; dependsOnTaskId?: string | null }): Promise<Task | undefined>;
  updateTaskStatus(id: string, status: string, extra?: { submission?: string; submittedAt?: Date | null; feedback?: string | null; blockedReason?: string | null; completedAt?: Date | null; startedAt?: Date | null; assigneeId?: string }, expectedStatuses?: string[]): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getTasksDependingOn(taskId: string): Promise<Task[]>;

  // Project completion criteria ("Definition of Done")
  createCompletionCriterion(data: { projectId: string; text: string; optional?: boolean; taskId?: string | null; sortOrder?: number }): Promise<ProjectCompletionCriterion>;
  getCompletionCriteriaByProject(projectId: string): Promise<ProjectCompletionCriterion[]>;
  getCompletionCriterionById(id: string): Promise<ProjectCompletionCriterion | undefined>;
  updateCompletionCriterion(id: string, data: { text?: string; optional?: boolean; sortOrder?: number }): Promise<ProjectCompletionCriterion | undefined>;
  setCompletionCriterionDone(id: string, completed: boolean, completedByUserId: string | null): Promise<ProjectCompletionCriterion | undefined>;
  deleteCompletionCriterion(id: string): Promise<void>;

  // Signal dismiss/snooze
  getSignalDismissalsByCompany(companyId: string): Promise<SignalDismissal[]>;
  upsertSignalDismissal(companyId: string, signalKey: string, userId: string, snoozedUntil: Date | null): Promise<SignalDismissal>;

  // Work sessions ("shifts")
  getActiveWorkSession(internId: string): Promise<WorkSession | undefined>;
  startWorkSession(internId: string, companyId: string): Promise<WorkSession>;
  endWorkSession(internId: string, endReason?: string, endedByUserId?: string | null, endedAt?: Date): Promise<WorkSession | undefined>;
  getWorkSessionsByIntern(internId: string, limit?: number): Promise<WorkSession[]>;
  getWorkSessionsByInternSince(internId: string, since: Date): Promise<WorkSession[]>;
  getActiveWorkSessionsByCompany(companyId: string): Promise<WorkSession[]>;
  getWorkSessionsByCompanySince(companyId: string, since: Date): Promise<WorkSession[]>;
  getWorkSessionAggregateByIntern(internId: string): Promise<{ totalSeconds: number; sessionCount: number }>;
  getWorkSessionById(id: string): Promise<WorkSession | undefined>;
  createWorkActivities(data: InsertWorkActivity[]): Promise<WorkActivity[]>;
  getWorkActivitiesBySession(sessionId: string): Promise<WorkActivity[]>;
  createTaskSubmission(data: InsertTaskSubmission): Promise<TaskSubmission>;
  getTaskSubmissionsByInternInWindow(internId: string, start: Date, end: Date): Promise<TaskSubmission[]>;
  getWorkActivityBreakdownBySession(sessionId: string): Promise<{ application: string; category: string; totalSeconds: number }[]>;
  createWorkSummary(data: InsertWorkSummary): Promise<WorkSummary>;
  getWorkSummaryBySession(sessionId: string): Promise<WorkSummary | undefined>;
  updateWorkSummary(id: string, data: { internNote?: string; reviewedAt?: Date; submittedAt?: Date }): Promise<WorkSummary | undefined>;
  getWorkSummariesByIntern(internId: string, limit?: number): Promise<WorkSummary[]>;
  getRecentSubmittedWorkSummariesByCompany(companyId: string, since: Date): Promise<WorkSummary[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPublicSlug(slug: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.publicProfileSlug, slug));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [created] = await db.insert(users).values(data).returning();
    return created;
  }

  // Lazily creates one real, unusable "system" user per company as the
  // sender for automated messages (morning digest). Deliberately reuses
  // the existing channelMessages.userId FK/DM infra rather than adding a
  // nullable/bot-sender column — see server/services/morningDigest.ts.
  // The random passwordHash is not a valid bcrypt hash, so bcrypt.compare
  // against it always returns false; this account can never log in.
  async getOrCreateSystemUser(companyId: string): Promise<User> {
    const email = `system+${companyId}@internal.internops.local`;
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return existing;
    const [created] = await db.insert(users).values({
      name: "Pulse Digest",
      email,
      passwordHash: `unusable:${crypto.randomBytes(32).toString("hex")}`,
      role: "system",
      companyId,
    } as InsertUser).returning();
    return created;
  }

  async recordDigestRun(userId: string, sentDate: string): Promise<boolean> {
    const inserted = await db.insert(digestRuns)
      .values({ userId, sentDate })
      .onConflictDoNothing()
      .returning();
    return inserted.length > 0;
  }

  async setUserMorningDigestEnabled(id: string, enabled: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ morningDigestEnabled: enabled }).where(eq(users.id, id)).returning();
    return updated;
  }

  async getUsersByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.companyId, companyId)).orderBy(desc(users.createdAt));
  }

  async getInternsByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.companyId, companyId), eq(users.role, "intern"))
    ).orderBy(desc(users.createdAt));
  }

  async getAdminsByCompany(companyId: string): Promise<User[]> {
    return db.select().from(users).where(
      and(eq(users.companyId, companyId), eq(users.role, "admin"))
    ).orderBy(desc(users.createdAt));
  }

  // Global, not company-scoped — used by the signup bootstrap escape hatch,
  // which must never fire a second time system-wide even if a stray/legacy
  // company row causes getOrCreateEdaiCompany() to resolve to a company
  // that itself has no admins yet.
  async anyAdminExists(): Promise<boolean> {
    const [row] = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    return !!row;
  }

  async updateUserPassword(id: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, id));
  }

  async setUserDeactivated(id: string, deactivated: boolean): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({ deactivatedAt: deactivated ? new Date() : null })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Slug is generated once, on first enable, and kept across future
  // toggles (disabling never clears it) so a previously shared link never
  // changes. Always suffixed with a random token — unlike company slugs,
  // this is a personal page, and a slug derived from name alone would be
  // guessable/enumerable.
  async setUserPublicProfile(id: string, enabled: boolean): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (!user) return undefined;

    let slug = user.publicProfileSlug;
    if (enabled && !slug) {
      const base = user.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "intern";
      let candidate = `${base}-${crypto.randomBytes(3).toString("hex")}`;
      let attempt = 0;
      while (await this.getUserByPublicSlug(candidate)) {
        attempt++;
        candidate = `${base}-${crypto.randomBytes(3).toString("hex")}`;
        if (attempt > 5) break;
      }
      slug = candidate;
    }

    const [updated] = await db.update(users)
      .set({ publicProfileEnabled: enabled, publicProfileSlug: slug })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async setUserCompletionBadge(id: string, awarded: boolean, awardedByUserId: string | null): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set({
        completionBadgeAwardedAt: awarded ? new Date() : null,
        completionBadgeAwardedByUserId: awarded ? awardedByUserId : null,
      })
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  // Snapshot-then-deactivate. The snapshot is upserted (unique on userId)
  // rather than appended, unlike performanceNarratives' intentional
  // history — re-running the transition refreshes the record. Best-effort
  // on internshipStartedAt (falls back to users.createdAt) and
  // finalNarrative (nullable — tolerates the narrative feature never
  // having run for this intern).
  // endDate defaults to now (a manual, immediate "Transition to Alumni"
  // click). The automatic sweep passes the intern's recorded
  // expectedEndDate instead, since the sweep itself may run up to a day
  // after that date actually passed — using "now" there would record a
  // slightly wrong internshipEndedAt.
  async transitionUserToAlumni(id: string, transitionedByUserId: string, endDate?: Date): Promise<{ user: User; alumniRecord: AlumniRecord }> {
    const [existingUser] = await db.select().from(users).where(eq(users.id, id));
    if (!existingUser) throw new Error("User not found");

    const internTasks = await this.getTasksByAssignee(id);
    const completed = internTasks.filter((t) => t.status === "completed");
    const narrative = await this.getLatestPerformanceNarrative(id);

    const snapshot = {
      userId: id,
      companyId: existingUser.companyId as string,
      internshipStartedAt: existingUser.createdAt,
      internshipEndedAt: endDate ?? new Date(),
      totalTasksCompleted: completed.length,
      totalTasksAssigned: internTasks.length,
      skillTagCounts: aggregateSkillTags(completed),
      completionBadgeAwarded: !!existingUser.completionBadgeAwardedAt,
      finalNarrative: narrative?.content ?? null,
      transitionedByUserId,
    };

    const [alumniRecord] = await db.insert(alumniRecords)
      .values(snapshot)
      .onConflictDoUpdate({ target: alumniRecords.userId, set: snapshot })
      .returning();

    const [user] = await db.update(users)
      .set({ alumniAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    await this.setUserDeactivated(id, true);

    return { user, alumniRecord };
  }

  async setUserExpectedEndDate(id: string, expectedEndDate: Date | null): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ expectedEndDate }).where(eq(users.id, id)).returning();
    return updated;
  }

  // Candidates for the daily auto-transition sweep: active (not yet
  // alumni, not deactivated) interns whose planned end date has passed.
  async getInternsWithPastExpectedEndDate(): Promise<User[]> {
    return db.select().from(users).where(
      and(
        eq(users.role, "intern"),
        isNull(users.alumniAt),
        isNull(users.deactivatedAt),
        lt(users.expectedEndDate, new Date()),
      )
    );
  }

  async getAlumniByCompany(companyId: string): Promise<(User & { alumniRecord: AlumniRecord })[]> {
    const rows = await db.select({ user: users, alumniRecord: alumniRecords }).from(users)
      .innerJoin(alumniRecords, eq(users.id, alumniRecords.userId))
      .where(eq(users.companyId, companyId))
      .orderBy(desc(alumniRecords.internshipEndedAt));
    return rows.map((r) => ({ ...r.user, alumniRecord: r.alumniRecord }));
  }

  // alumniRecords row is left as historical record, not deleted.
  async reactivateAlumnus(id: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ alumniAt: null }).where(eq(users.id, id)).returning();
    await this.setUserDeactivated(id, false);
    return updated;
  }

  async promoteToAdmin(id: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role: "admin" }).where(eq(users.id, id)).returning();
    return updated;
  }

  async demoteToIntern(id: string): Promise<User | undefined> {
    const [updated] = await db.update(users).set({ role: "intern" }).where(eq(users.id, id)).returning();
    return updated;
  }

  async createCompany(data: InsertCompany): Promise<Company> {
    const [created] = await db.insert(companies).values(data).returning();
    return created;
  }

  async getAllCompanies(): Promise<Company[]> {
    return db.select().from(companies).orderBy(companies.createdAt);
  }

  async getCompanyById(id: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    return company;
  }

  async getCompanyBySlug(slug: string): Promise<Company | undefined> {
    const [company] = await db.select().from(companies).where(eq(companies.slug, slug));
    return company;
  }

  async updateCompanyAcceptingApplications(id: string, accepting: boolean): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set({ acceptingApplications: accepting }).where(eq(companies.id, id)).returning();
    return updated;
  }

  async setCompanySlug(id: string, slug: string): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set({ slug }).where(eq(companies.id, id)).returning();
    return updated;
  }

  async createInvitation(data: InsertInvitation): Promise<Invitation> {
    const [created] = await db.insert(invitations).values(data).returning();
    return created;
  }

  // Read-only — for the "is this link still good?" check before the intern
  // has even filled out the accept-invite form. Never marks used; only
  // consumeInvitation does that.
  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.tokenHash, hashToken(token)));
    return inv;
  }

  // Atomically claims the invitation: the UPDATE's WHERE clause re-checks
  // used/expiry at the exact moment of the write, so two concurrent accept
  // requests for the same token can never both succeed — only the first
  // gets a row back, closing the check-then-act race the old
  // getInvitationByToken-then-markInvitationUsed pattern had.
  async consumeInvitation(token: string): Promise<Invitation | undefined> {
    const [claimed] = await db.update(invitations)
      .set({ used: true })
      .where(and(eq(invitations.tokenHash, hashToken(token)), eq(invitations.used, false), gt(invitations.expiresAt, new Date())))
      .returning();
    return claimed;
  }

  async getInvitationsByCompany(companyId: string): Promise<Invitation[]> {
    return db.select().from(invitations).where(eq(invitations.companyId, companyId)).orderBy(desc(invitations.createdAt));
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [created] = await db.insert(projects).values(data).returning();
    return created;
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getProjectsByIntern(internId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.internId, internId)).orderBy(desc(projects.createdAt));
  }

  async getProjectsByCompany(companyId: string): Promise<Project[]> {
    return db.select().from(projects).where(eq(projects.companyId, companyId)).orderBy(desc(projects.createdAt));
  }

  async updateProjectStatus(id: string, status: string, extra?: { rejectionReason?: string }): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ status, ...extra }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async updateProject(id: string, data: { title?: string; idea?: string; minimumTotalHours?: number; githubRepoUrl?: string | null }): Promise<Project | undefined> {
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.idea !== undefined) updateData.idea = data.idea;
    if (data.minimumTotalHours !== undefined) updateData.minimumTotalHours = data.minimumTotalHours;
    if (data.githubRepoUrl !== undefined) updateData.githubRepoUrl = data.githubRepoUrl;
    if (Object.keys(updateData).length === 0) return this.getProjectById(id);
    const [updated] = await db.update(projects).set(updateData).where(eq(projects.id, id)).returning();
    return updated;
  }

  // Removes a project and everything that only makes sense inside it, in
  // one transaction so a failure part-way can never leave a half-deleted
  // project behind. Observed work evidence (work_activities, work
  // summaries) is kept with its project reference nulled — it's a record
  // of real time, independent of the project it was correlated with.
  async deleteProject(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const versions = await tx.select({ id: planVersions.id }).from(planVersions).where(eq(planVersions.projectId, id));
      if (versions.length > 0) {
        await tx.delete(comments).where(inArray(comments.versionId, versions.map((v) => v.id)));
      }
      await tx.delete(planVersions).where(eq(planVersions.projectId, id));
      const logs = await tx.select({ id: weeklyLogs.id }).from(weeklyLogs).where(eq(weeklyLogs.projectId, id));
      if (logs.length > 0) {
        await tx.delete(logComments).where(inArray(logComments.logId, logs.map((l) => l.id)));
      }
      await tx.delete(weeklyLogs).where(eq(weeklyLogs.projectId, id));
      await tx.delete(chatMessages).where(eq(chatMessages.projectId, id));
      await tx.delete(channels).where(eq(channels.projectId, id));

      const projectTasks = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, id));
      if (projectTasks.length > 0) {
        const taskIds = projectTasks.map((t) => t.id);
        await tx.update(projectCompletionCriteria).set({ taskId: null }).where(inArray(projectCompletionCriteria.taskId, taskIds));
        await tx.update(tasks).set({ dependsOnTaskId: null }).where(inArray(tasks.dependsOnTaskId, taskIds));
        await tx.update(workActivities).set({ taskId: null, taskCorrelation: null }).where(inArray(workActivities.taskId, taskIds));
        await tx.delete(taskSubmissions).where(inArray(taskSubmissions.taskId, taskIds));
        await tx.delete(taskComments).where(inArray(taskComments.taskId, taskIds));
        await tx.delete(tasks).where(inArray(tasks.id, taskIds));
      }
      await tx.update(workActivities).set({ projectId: null }).where(eq(workActivities.projectId, id));
      await tx.update(workSummaries).set({ primaryProjectId: null }).where(eq(workSummaries.primaryProjectId, id));
      await tx.delete(projects).where(eq(projects.id, id));
    });
  }

  // Full, irreversible removal of a user and everything that references
  // them. Order matters: children before the user row itself. Tables where
  // this user can only appear nullably (audit log actor, channel creator)
  // get nulled out instead of deleted, to preserve the surrounding
  // history/data rather than erase it.
  async deleteUserPermanently(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      const [target] = await tx.select({ email: users.email }).from(users).where(eq(users.id, id));
      await tx.delete(verifyTokensTable).where(eq(verifyTokensTable.userId, id));
      if (target?.email) {
        await tx.delete(resetTokensTable).where(eq(resetTokensTable.email, target.email));
        await tx.delete(invitations).where(eq(invitations.email, target.email));
      }

      // Projects this person owned, with everything inside them.
      const ownedProjects = await tx.select({ id: projects.id }).from(projects).where(eq(projects.internId, id));
      for (const p of ownedProjects) {
        const versions = await tx.select({ id: planVersions.id }).from(planVersions).where(eq(planVersions.projectId, p.id));
        if (versions.length > 0) await tx.delete(comments).where(inArray(comments.versionId, versions.map((v) => v.id)));
        await tx.delete(planVersions).where(eq(planVersions.projectId, p.id));
        const logs = await tx.select({ id: weeklyLogs.id }).from(weeklyLogs).where(eq(weeklyLogs.projectId, p.id));
        if (logs.length > 0) await tx.delete(logComments).where(inArray(logComments.logId, logs.map((l) => l.id)));
        await tx.delete(weeklyLogs).where(eq(weeklyLogs.projectId, p.id));
        await tx.delete(chatMessages).where(eq(chatMessages.projectId, p.id));
        await tx.delete(channels).where(eq(channels.projectId, p.id));
        const projectTasks = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.projectId, p.id));
        if (projectTasks.length > 0) {
          const taskIds = projectTasks.map((t) => t.id);
          await tx.update(projectCompletionCriteria).set({ taskId: null }).where(inArray(projectCompletionCriteria.taskId, taskIds));
          await tx.update(tasks).set({ dependsOnTaskId: null }).where(inArray(tasks.dependsOnTaskId, taskIds));
          await tx.update(workActivities).set({ taskId: null, taskCorrelation: null }).where(inArray(workActivities.taskId, taskIds));
          await tx.delete(taskSubmissions).where(inArray(taskSubmissions.taskId, taskIds));
          await tx.delete(taskComments).where(inArray(taskComments.taskId, taskIds));
          await tx.delete(tasks).where(inArray(tasks.id, taskIds));
        }
        await tx.update(workActivities).set({ projectId: null }).where(eq(workActivities.projectId, p.id));
        await tx.update(workSummaries).set({ primaryProjectId: null }).where(eq(workSummaries.primaryProjectId, p.id));
        await tx.delete(projects).where(eq(projects.id, p.id));
      }

      // Tasks assigned to this person (possibly in other people's projects).
      const assigned = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.assigneeId, id));
      if (assigned.length > 0) {
        const taskIds = assigned.map((t) => t.id);
        await tx.update(projectCompletionCriteria).set({ taskId: null }).where(inArray(projectCompletionCriteria.taskId, taskIds));
        await tx.update(tasks).set({ dependsOnTaskId: null }).where(inArray(tasks.dependsOnTaskId, taskIds));
        await tx.update(workActivities).set({ taskId: null, taskCorrelation: null }).where(inArray(workActivities.taskId, taskIds));
        await tx.delete(taskSubmissions).where(inArray(taskSubmissions.taskId, taskIds));
        await tx.delete(taskComments).where(inArray(taskComments.taskId, taskIds));
        await tx.delete(tasks).where(inArray(tasks.id, taskIds));
      }
      // Things this person authored on other people's records are kept,
      // with the author reference removed.
      await tx.update(tasks).set({ createdByUserId: null }).where(eq(tasks.createdByUserId, id));
      await tx.update(comments).set({ managerId: null }).where(eq(comments.managerId, id));
      await tx.update(logComments).set({ managerId: null }).where(eq(logComments.managerId, id));
      await tx.update(taskComments).set({ authorUserId: null }).where(eq(taskComments.authorUserId, id));
      await tx.update(performanceNarratives).set({ generatedByUserId: null }).where(eq(performanceNarratives.generatedByUserId, id));
      await tx.update(signalDismissals).set({ dismissedByUserId: null }).where(eq(signalDismissals.dismissedByUserId, id));
      await tx.update(projectCompletionCriteria).set({ completedByUserId: null }).where(eq(projectCompletionCriteria.completedByUserId, id));
      await tx.update(users).set({ completionBadgeAwardedByUserId: null }).where(eq(users.completionBadgeAwardedByUserId, id));
      await tx.update(alumniRecords).set({ transitionedByUserId: null }).where(eq(alumniRecords.transitionedByUserId, id));
      await tx.update(workSessions).set({ endedByUserId: null }).where(eq(workSessions.endedByUserId, id));
      await tx.update(applications).set({ reviewedByUserId: null }).where(eq(applications.reviewedByUserId, id));

      await tx.delete(performanceNarratives).where(eq(performanceNarratives.userId, id));
      await tx.delete(digestRuns).where(eq(digestRuns.userId, id));
      await tx.delete(assistantMessages).where(eq(assistantMessages.userId, id));
      await tx.delete(workActivities).where(eq(workActivities.internId, id));
      await tx.delete(taskSubmissions).where(eq(taskSubmissions.internId, id));
      await tx.delete(workSummaries).where(eq(workSummaries.internId, id));
      await tx.delete(workSessions).where(eq(workSessions.internId, id));
      await tx.delete(notifications).where(eq(notifications.userId, id));
      await tx.delete(chatMessages).where(eq(chatMessages.userId, id));
      await tx.delete(channelMessages).where(eq(channelMessages.userId, id));
      // Direct-message channels with this person are removed outright; a
      // DM with nobody on the other end is meaningless.
      const dmIds = await tx.select({ id: channels.id }).from(channels)
        .innerJoin(channelMembers, eq(channelMembers.channelId, channels.id))
        .where(and(eq(channels.type, "dm"), eq(channelMembers.userId, id)));
      if (dmIds.length > 0) await tx.delete(channels).where(inArray(channels.id, dmIds.map((c) => c.id)));
      await tx.delete(channelMembers).where(eq(channelMembers.userId, id));
      await tx.update(channels).set({ createdById: null }).where(eq(channels.createdById, id));
      await tx.delete(alumniRecords).where(eq(alumniRecords.userId, id));
      await tx.delete(userDevices).where(eq(userDevices.userId, id));
      await tx.update(auditLogs).set({ actorUserId: null }).where(eq(auditLogs.actorUserId, id));
      await tx.delete(users).where(eq(users.id, id));
    });
  }

  async createPlanVersion(data: InsertPlanVersion): Promise<PlanVersion> {
    const [created] = await db.insert(planVersions).values(data).returning();
    return created;
  }

  async getPlanVersionsByProject(projectId: string): Promise<PlanVersion[]> {
    return db.select().from(planVersions).where(eq(planVersions.projectId, projectId)).orderBy(desc(planVersions.versionNumber));
  }

  async getPlanVersionsByProjectIds(projectIds: string[]): Promise<PlanVersion[]> {
    if (projectIds.length === 0) return [];
    return db.select().from(planVersions).where(inArray(planVersions.projectId, projectIds)).orderBy(desc(planVersions.versionNumber));
  }

  async getPlanVersionById(id: string): Promise<PlanVersion | undefined> {
    const [pv] = await db.select().from(planVersions).where(eq(planVersions.id, id));
    return pv;
  }

  async getLatestPlanVersion(projectId: string): Promise<PlanVersion | undefined> {
    const [pv] = await db.select().from(planVersions)
      .where(eq(planVersions.projectId, projectId))
      .orderBy(desc(planVersions.versionNumber))
      .limit(1);
    return pv;
  }

  // Single bulk query + in-memory reduction, instead of calling
  // getLatestPlanVersion once per project — used by the analytics
  // endpoints, which previously issued one query per project per metric.
  async getLatestPlanVersionsByProjectIds(projectIds: string[]): Promise<Map<string, PlanVersion>> {
    const latest = new Map<string, PlanVersion>();
    if (projectIds.length === 0) return latest;
    const versions = await db.select().from(planVersions).where(inArray(planVersions.projectId, projectIds));
    for (const v of versions) {
      const current = latest.get(v.projectId);
      if (!current || v.versionNumber > current.versionNumber) {
        latest.set(v.projectId, v);
      }
    }
    return latest;
  }

  async updatePlanVersionStatus(id: string, status: string): Promise<PlanVersion | undefined> {
    const [updated] = await db.update(planVersions).set({ status }).where(eq(planVersions.id, id)).returning();
    return updated;
  }

  async updatePlanVersionContent(id: string, contentJson: any): Promise<PlanVersion | undefined> {
    const [updated] = await db.update(planVersions).set({ contentJson }).where(eq(planVersions.id, id)).returning();
    return updated;
  }

  async createComment(data: InsertComment): Promise<Comment> {
    const [created] = await db.insert(comments).values(data).returning();
    return created;
  }

  async getCommentsByVersion(versionId: string): Promise<Comment[]> {
    return db.select().from(comments).where(eq(comments.versionId, versionId)).orderBy(desc(comments.createdAt));
  }

  async getAllCommentsByProject(projectId: string): Promise<Comment[]> {
    const versions = await this.getPlanVersionsByProject(projectId);
    if (versions.length === 0) return [];
    const versionIds = versions.map(v => v.id);
    return db.select().from(comments).where(inArray(comments.versionId, versionIds)).orderBy(desc(comments.createdAt));
  }

  async createWeeklyLog(data: InsertWeeklyLog): Promise<WeeklyLog> {
    const [created] = await db.insert(weeklyLogs).values(data).returning();
    return created;
  }

  async getWeeklyLogsByProject(projectId: string): Promise<WeeklyLog[]> {
    return db.select().from(weeklyLogs).where(eq(weeklyLogs.projectId, projectId)).orderBy(weeklyLogs.weekNumber, weeklyLogs.createdAt);
  }

  async getWeeklyLogsByProjectIds(projectIds: string[]): Promise<WeeklyLog[]> {
    if (projectIds.length === 0) return [];
    return db.select().from(weeklyLogs).where(inArray(weeklyLogs.projectId, projectIds)).orderBy(weeklyLogs.weekNumber, weeklyLogs.createdAt);
  }

  async updateWeeklyLog(id: string, logText: string): Promise<WeeklyLog | undefined> {
    const [updated] = await db.update(weeklyLogs).set({ logText }).where(eq(weeklyLogs.id, id)).returning();
    return updated;
  }

  async getWeeklyLogById(id: string): Promise<WeeklyLog | undefined> {
    const [log] = await db.select().from(weeklyLogs).where(eq(weeklyLogs.id, id));
    return log;
  }

  async createLogComment(data: InsertLogComment): Promise<LogComment> {
    const [created] = await db.insert(logComments).values(data).returning();
    return created;
  }

  async getLogCommentsByProject(projectId: string): Promise<LogComment[]> {
    const logs = await db.select({ id: weeklyLogs.id }).from(weeklyLogs).where(eq(weeklyLogs.projectId, projectId));
    if (logs.length === 0) return [];
    const logIds = logs.map(l => l.id);
    return db.select().from(logComments).where(inArray(logComments.logId, logIds)).orderBy(desc(logComments.createdAt));
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(data).returning();
    return created;
  }

  async getNotificationsByUser(userId: string, limit = 100): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
  }

  // Scoped by userId as well as id — without this, any authenticated user
  // could mark (and have echoed back to them) another user's notification
  // just by knowing or guessing its id.
  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications).set({ read: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }

  // Scoped by userId as well as id, same reasoning as markNotificationRead.
  async deleteNotification(id: string, userId: string): Promise<boolean> {
    const deleted = await db.delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return deleted.length > 0;
  }

  async deleteAllNotificationsForUser(userId: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() }).from(notifications).where(
      and(eq(notifications.userId, userId), eq(notifications.read, false))
    );
    return result?.count ?? 0;
  }

  async deleteProjectsByIntern(internId: string, companyId: string): Promise<number> {
    const internProjects = await db.select().from(projects).where(
      and(eq(projects.internId, internId), eq(projects.companyId, companyId))
    );
    for (const project of internProjects) {
      await this.deleteProject(project.id);
    }
    return internProjects.length;
  }

  async deletePlanVersionsByProject(projectId: string): Promise<void> {
    const versions = await this.getPlanVersionsByProject(projectId);
    for (const v of versions) {
      await db.delete(comments).where(eq(comments.versionId, v.id));
    }
    await db.delete(planVersions).where(eq(planVersions.projectId, projectId));
  }

  async updateProjectGithubUrl(id: string, githubRepoUrl: string | null): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ githubRepoUrl }).where(eq(projects.id, id)).returning();
    return updated;
  }

  async updateCompanyGithubToken(companyId: string, githubToken: string | null): Promise<Company | undefined> {
    const [updated] = await db.update(companies).set({ githubToken }).where(eq(companies.id, companyId)).returning();
    return updated;
  }

  async getCompanyGithubToken(companyId: string): Promise<string | null> {
    const company = await this.getCompanyById(companyId);
    return company?.githubToken || null;
  }

  async getProjectStatusCounts(companyId: string): Promise<{ status: string; count: number }[]> {
    const result = await db
      .select({ status: projects.status, count: count() })
      .from(projects)
      .where(eq(projects.companyId, companyId))
      .groupBy(projects.status);
    return result;
  }

  async getWeeklyLogsByCompany(companyId: string): Promise<any[]> {
    const companyProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.companyId, companyId));
    if (companyProjects.length === 0) return [];
    const projectIds = companyProjects.map((p) => p.id);
    return db.select().from(weeklyLogs).where(inArray(weeklyLogs.projectId, projectIds)).orderBy(weeklyLogs.createdAt);
  }

  async getLogActivityByCompany(companyId: string): Promise<{ week: string; logs: number }[]> {
    const allLogs = await this.getWeeklyLogsByCompany(companyId);
    const weekMap = new Map<string, number>();
    allLogs.forEach((log: any) => {
      const date = new Date(log.createdAt);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split("T")[0];
      weekMap.set(key, (weekMap.get(key) || 0) + 1);
    });
    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([week, logs]) => ({ week, logs }));
  }

  async getChatMessages(projectId: string, mode: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages)
      .where(and(eq(chatMessages.projectId, projectId), eq(chatMessages.mode, mode)))
      .orderBy(chatMessages.createdAt);
  }

  async saveChatMessage(data: InsertChatMessage): Promise<ChatMessage> {
    const [created] = await db.insert(chatMessages).values(data).returning();
    return created;
  }

  async clearChatMessages(projectId: string, mode: string): Promise<void> {
    await db.delete(chatMessages).where(
      and(eq(chatMessages.projectId, projectId), eq(chatMessages.mode, mode))
    );
  }

  // --- Channel Methods ---

  async createChannel(data: InsertChannel): Promise<Channel> {
    const [created] = await db.insert(channels).values(data).returning();
    return created;
  }

  async getChannelById(id: string): Promise<Channel | undefined> {
    const [found] = await db.select().from(channels).where(eq(channels.id, id));
    return found;
  }

  async getChannelsByCompany(companyId: string, userId: string): Promise<(Channel & { unreadCount: number })[]> {
    // Single query: join channels → members, with a correlated subquery for unread count
    const rows = await db
      .select({
        id: channels.id,
        companyId: channels.companyId,
        type: channels.type,
        name: channels.name,
        projectId: channels.projectId,
        createdById: channels.createdById,
        createdAt: channels.createdAt,
        lastReadAt: channelMembers.lastReadAt,
      })
      .from(channels)
      .innerJoin(channelMembers, and(
        eq(channelMembers.channelId, channels.id),
        eq(channelMembers.userId, userId),
      ))
      .where(eq(channels.companyId, companyId))
      .orderBy(channels.createdAt);

    if (rows.length === 0) return [];

    // Batch: get unread counts for all channels in one query
    const channelIds = rows.map(r => r.id);
    const lastReadMap = new Map(rows.map(r => [r.id, r.lastReadAt]));

    // Get message counts per channel (all messages, then we'll subtract read ones)
    const allCounts = await db
      .select({
        channelId: channelMessages.channelId,
        msgCount: count(),
      })
      .from(channelMessages)
      .where(sql`${channelMessages.channelId} IN (${sql.join(channelIds.map(id => sql`${id}`), sql`, `)})`)
      .groupBy(channelMessages.channelId);

    // For channels with a lastReadAt, get the count of messages BEFORE lastReadAt
    const channelsWithReadAt = rows.filter(r => r.lastReadAt !== null);
    const readCounts = new Map<string, number>();

    if (channelsWithReadAt.length > 0) {
      // Get read message counts in a single query using UNION ALL approach
      for (const ch of channelsWithReadAt) {
        const [result] = await db
          .select({ msgCount: count() })
          .from(channelMessages)
          .where(and(
            eq(channelMessages.channelId, ch.id),
            sql`${channelMessages.createdAt} <= ${ch.lastReadAt}`,
          ));
        readCounts.set(ch.id, Number(result.msgCount));
      }
    }

    const totalCountMap = new Map(allCounts.map(c => [c.channelId, Number(c.msgCount)]));

    return rows.map(row => ({
      id: row.id,
      companyId: row.companyId,
      type: row.type,
      name: row.name,
      projectId: row.projectId,
      createdById: row.createdById,
      createdAt: row.createdAt,
      unreadCount: lastReadMap.get(row.id)
        ? (totalCountMap.get(row.id) || 0) - (readCounts.get(row.id) || 0)
        : (totalCountMap.get(row.id) || 0),
    }));
  }

  async ensureGeneralChannel(companyId: string): Promise<Channel> {
    const [existing] = await db.select().from(channels)
      .where(and(eq(channels.companyId, companyId), eq(channels.type, "general")));
    if (existing) return existing;
    const [created] = await db.insert(channels).values({
      companyId,
      type: "general",
      name: "general",
    }).returning();
    return created;
  }

  async createProjectChannel(project: { id: string; companyId: string; title: string; internId: string }): Promise<Channel> {
    const [created] = await db.insert(channels).values({
      companyId: project.companyId,
      type: "project",
      name: project.title,
      projectId: project.id,
    }).returning();
    // Add the intern
    await this.addChannelMember(created.id, project.internId);
    // Add all admins in the company
    const admins = await db.select().from(users)
      .where(and(eq(users.companyId, project.companyId), eq(users.role, "admin")));
    for (const admin of admins) {
      await this.addChannelMember(created.id, admin.id);
    }
    return created;
  }

  async getOrCreateDMChannel(companyId: string, userId1: string, userId2: string, user1Name: string, user2Name: string): Promise<Channel> {
    // Find existing DM between these two users using a single query
    // Look for DM channels where BOTH users are members
    const cm1 = db.$with("cm1").as(
      db.select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .where(eq(channelMembers.userId, userId1))
    );
    const cm2 = db.$with("cm2").as(
      db.select({ channelId: channelMembers.channelId })
        .from(channelMembers)
        .where(eq(channelMembers.userId, userId2))
    );

    const existing = await db
      .with(cm1, cm2)
      .select({ id: channels.id, companyId: channels.companyId, type: channels.type, name: channels.name, projectId: channels.projectId, createdById: channels.createdById, createdAt: channels.createdAt })
      .from(channels)
      .innerJoin(cm1, eq(sql`${cm1}.channel_id`, channels.id))
      .innerJoin(cm2, eq(sql`${cm2}.channel_id`, channels.id))
      .where(and(eq(channels.companyId, companyId), eq(channels.type, "dm")))
      .limit(1);

    if (existing.length > 0) return existing[0];

    // Create new DM channel
    const [created] = await db.insert(channels).values({
      companyId,
      type: "dm",
      name: `${user1Name}, ${user2Name}`,
      createdById: userId1,
    }).returning();
    await this.addChannelMember(created.id, userId1);
    await this.addChannelMember(created.id, userId2);
    return created;
  }

  async deleteChannel(id: string): Promise<void> {
    await db.delete(channels).where(eq(channels.id, id));
  }

  // --- Channel Member Methods ---

  async addChannelMember(channelId: string, userId: string): Promise<ChannelMember> {
    // Upsert — ignore if already exists
    const [existing] = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
    if (existing) return existing;
    const [created] = await db.insert(channelMembers).values({ channelId, userId }).returning();
    return created;
  }

  async removeChannelMember(channelId: string, userId: string): Promise<void> {
    await db.delete(channelMembers).where(
      and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId))
    );
  }

  async getChannelMembers(channelId: string): Promise<(ChannelMember & { userName: string; userRole: string })[]> {
    return db
      .select({
        id: channelMembers.id,
        channelId: channelMembers.channelId,
        userId: channelMembers.userId,
        lastReadAt: channelMembers.lastReadAt,
        joinedAt: channelMembers.joinedAt,
        userName: users.name,
        userRole: users.role,
      })
      .from(channelMembers)
      .innerJoin(users, eq(channelMembers.userId, users.id))
      .where(eq(channelMembers.channelId, channelId));
  }

  async isChannelMember(channelId: string, userId: string): Promise<boolean> {
    const [found] = await db.select().from(channelMembers)
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
    return !!found;
  }

  async updateLastReadAt(channelId: string, userId: string): Promise<void> {
    await db.update(channelMembers)
      .set({ lastReadAt: new Date() })
      .where(and(eq(channelMembers.channelId, channelId), eq(channelMembers.userId, userId)));
  }

  // --- Channel Message Methods ---

  async getChannelMessages(channelId: string, limit: number = 100): Promise<(ChannelMessage & { userName: string })[]> {
    const rows = await db
      .select({
        id: channelMessages.id,
        channelId: channelMessages.channelId,
        userId: channelMessages.userId,
        content: channelMessages.content,
        createdAt: channelMessages.createdAt,
        userName: users.name,
      })
      .from(channelMessages)
      .innerJoin(users, eq(channelMessages.userId, users.id))
      .where(eq(channelMessages.channelId, channelId))
      .orderBy(desc(channelMessages.createdAt))
      .limit(limit);
    return rows.reverse(); // Chronological order
  }

  async createChannelMessage(data: InsertChannelMessage): Promise<ChannelMessage> {
    const [created] = await db.insert(channelMessages).values(data).returning();
    return created;
  }

  async getTotalUnreadCount(companyId: string, userId: string): Promise<number> {
    // Single query: count all unread messages across all channels user is a member of
    const result = await db
      .select({ total: count() })
      .from(channelMessages)
      .innerJoin(channelMembers, and(
        eq(channelMembers.channelId, channelMessages.channelId),
        eq(channelMembers.userId, userId),
      ))
      .innerJoin(channels, and(
        eq(channels.id, channelMessages.channelId),
        eq(channels.companyId, companyId),
      ))
      .where(
        or(
          isNull(channelMembers.lastReadAt),
          gt(channelMessages.createdAt, channelMembers.lastReadAt),
        )
      );
    return Number(result[0]?.total || 0);
  }

  async createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [created] = await db.insert(resetTokensTable).values(data).returning();
    return created;
  }

  // Read-only validity check, used by the client before it even shows the
  // "set a new password" form. Never marks used.
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [found] = await db.select().from(resetTokensTable).where(eq(resetTokensTable.tokenHash, hashToken(token)));
    return found;
  }

  // Atomic claim — see consumeInvitation for why this can't be a separate
  // check-then-mark-used pair.
  async consumePasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [claimed] = await db.update(resetTokensTable)
      .set({ used: true })
      .where(and(eq(resetTokensTable.tokenHash, hashToken(token)), eq(resetTokensTable.used, false), gt(resetTokensTable.expiresAt, new Date())))
      .returning();
    return claimed;
  }

  async createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    const [created] = await db.insert(verifyTokensTable).values(data).returning();
    return created;
  }

  async getEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [found] = await db.select().from(verifyTokensTable).where(eq(verifyTokensTable.tokenHash, hashToken(token)));
    return found;
  }

  async consumeEmailVerificationToken(token: string): Promise<EmailVerificationToken | undefined> {
    const [claimed] = await db.update(verifyTokensTable)
      .set({ used: true })
      .where(and(eq(verifyTokensTable.tokenHash, hashToken(token)), eq(verifyTokensTable.used, false), gt(verifyTokensTable.expiresAt, new Date())))
      .returning();
    return claimed;
  }

  async markUserEmailVerified(userId: string): Promise<void> {
    await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, userId));
  }

  async createUserDevice(data: InsertUserDevice): Promise<UserDevice> {
    const [created] = await db.insert(userDevices).values(data).returning();
    return created;
  }

  async getUserDeviceByDeviceId(deviceId: string): Promise<UserDevice | undefined> {
    const [found] = await db.select().from(userDevices).where(eq(userDevices.deviceId, deviceId));
    return found;
  }

  async getUserDevicesByUser(userId: string): Promise<UserDevice[]> {
    return db.select().from(userDevices).where(eq(userDevices.userId, userId)).orderBy(desc(userDevices.lastSeenAt));
  }

  async touchUserDevice(deviceId: string): Promise<void> {
    await db.update(userDevices).set({ lastSeenAt: new Date() }).where(eq(userDevices.deviceId, deviceId));
  }

  async renameUserDevice(id: string, userId: string, name: string): Promise<UserDevice | undefined> {
    const [updated] = await db.update(userDevices).set({ name })
      .where(and(eq(userDevices.id, id), eq(userDevices.userId, userId))).returning();
    return updated;
  }

  async revokeUserDevice(id: string, userId: string): Promise<UserDevice | undefined> {
    const [updated] = await db.update(userDevices).set({ revokedAt: new Date() })
      .where(and(eq(userDevices.id, id), eq(userDevices.userId, userId))).returning();
    return updated;
  }

  // Revokes every still-active device for a user except `keepDeviceId`
  // (pass null to revoke all). Used after a password change/reset so a
  // leaked token can't outlive the credential it was issued against.
  async revokeOtherUserDevices(userId: string, keepDeviceId: string | null): Promise<number> {
    const conditions = [eq(userDevices.userId, userId), isNull(userDevices.revokedAt)];
    if (keepDeviceId) conditions.push(sql`${userDevices.deviceId} <> ${keepDeviceId}`);
    const updated = await db.update(userDevices).set({ revokedAt: new Date() }).where(and(...conditions)).returning();
    return updated.length;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(data).returning();
    return created;
  }

  async getAuditLogsByCompany(companyId: string, limit = 100): Promise<AuditLog[]> {
    return db.select().from(auditLogs).where(eq(auditLogs.companyId, companyId))
      .orderBy(desc(auditLogs.createdAt)).limit(limit);
  }

  async createPerformanceNarrative(data: InsertPerformanceNarrative): Promise<PerformanceNarrative> {
    const [created] = await db.insert(performanceNarratives).values(data).returning();
    return created;
  }

  async getLatestPerformanceNarrative(userId: string): Promise<PerformanceNarrative | undefined> {
    const [found] = await db.select().from(performanceNarratives)
      .where(eq(performanceNarratives.userId, userId))
      .orderBy(desc(performanceNarratives.createdAt)).limit(1);
    return found;
  }

  async createApplication(data: InsertApplication): Promise<Application> {
    const [created] = await db.insert(applications).values(data).returning();
    return created;
  }

  async getApplicationById(id: string): Promise<Application | undefined> {
    const [found] = await db.select().from(applications).where(eq(applications.id, id));
    return found;
  }

  async getApplicationsByCompany(companyId: string): Promise<Application[]> {
    return db.select().from(applications).where(eq(applications.companyId, companyId))
      .orderBy(desc(applications.createdAt));
  }

  async getPendingApplicationByEmail(companyId: string, email: string): Promise<Application | undefined> {
    const [found] = await db.select().from(applications).where(
      and(eq(applications.companyId, companyId), eq(applications.email, email), eq(applications.status, "pending"))
    );
    return found;
  }

  // Most recent application for this email regardless of status — used at
  // login to tell a not-yet-approved applicant why they can't log in
  // instead of a generic "invalid credentials".
  async getApplicationByEmail(companyId: string, email: string): Promise<Application | undefined> {
    const [found] = await db.select().from(applications).where(
      and(eq(applications.companyId, companyId), eq(applications.email, email))
    ).orderBy(desc(applications.createdAt)).limit(1);
    return found;
  }

  async updateApplicationStatus(id: string, status: string, reviewedByUserId: string, reviewerNotes?: string): Promise<Application | undefined> {
    const [updated] = await db.update(applications).set({
      status,
      reviewedByUserId,
      reviewedAt: new Date(),
      ...(reviewerNotes !== undefined ? { reviewerNotes } : {}),
    }).where(eq(applications.id, id)).returning();
    return updated;
  }

  async dismissApplication(id: string): Promise<Application | undefined> {
    const [updated] = await db.update(applications).set({ dismissedAt: new Date() }).where(eq(applications.id, id)).returning();
    return updated;
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values(data).returning();
    return created;
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    const [found] = await db.select().from(tasks).where(eq(tasks.id, id));
    return found;
  }

  async getTasksByCompany(companyId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.companyId, companyId)).orderBy(desc(tasks.createdAt));
  }

  async getTasksByAssignee(assigneeId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.assigneeId, assigneeId)).orderBy(desc(tasks.createdAt));
  }

  async getTasksByProjectIds(projectIds: string[]): Promise<Task[]> {
    if (projectIds.length === 0) return [];
    return db.select().from(tasks).where(inArray(tasks.projectId, projectIds)).orderBy(desc(tasks.createdAt));
  }

  async updateTaskDetails(id: string, data: { title?: string; description?: string | null; assigneeId?: string; projectId?: string | null; priority?: string; dueDate?: Date | null; skillTags?: string[]; dependsOnTaskId?: string | null }): Promise<Task | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.skillTags !== undefined) updateData.skillTags = data.skillTags;
    if (data.dependsOnTaskId !== undefined) updateData.dependsOnTaskId = data.dependsOnTaskId;
    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async getTasksDependingOn(taskId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.dependsOnTaskId, taskId));
  }

  // `expectedStatuses` makes the transition compare-and-set: the row only
  // changes if it's still in one of those states, so two racing "submit"
  // clicks (or an approve racing a request-changes) can't both succeed.
  // Returns undefined when the guard fails — callers answer 409.
  async updateTaskStatus(id: string, status: string, extra?: { submission?: string; submittedAt?: Date | null; feedback?: string | null; blockedReason?: string | null; completedAt?: Date | null; startedAt?: Date | null; assigneeId?: string }, expectedStatuses?: string[]): Promise<Task | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (extra?.submission !== undefined) updateData.submission = extra.submission;
    if (extra?.submittedAt !== undefined) updateData.submittedAt = extra.submittedAt;
    if (extra?.feedback !== undefined) updateData.feedback = extra.feedback;
    if (extra?.blockedReason !== undefined) updateData.blockedReason = extra.blockedReason;
    if (extra?.completedAt !== undefined) updateData.completedAt = extra.completedAt;
    if (extra?.startedAt !== undefined) updateData.startedAt = extra.startedAt;
    if (extra?.assigneeId !== undefined) updateData.assigneeId = extra.assigneeId;
    const where = expectedStatuses && expectedStatuses.length > 0
      ? and(eq(tasks.id, id), inArray(tasks.status, expectedStatuses))
      : eq(tasks.id, id);
    const [updated] = await db.update(tasks).set(updateData).where(where).returning();
    return updated;
  }

  async getTasksByIds(ids: string[]): Promise<Task[]> {
    if (ids.length === 0) return [];
    return db.select().from(tasks).where(inArray(tasks.id, ids));
  }

  // ---- Task comments ----
  async createTaskComment(data: InsertTaskComment): Promise<TaskComment> {
    const [created] = await db.insert(taskComments).values(data).returning();
    return created;
  }

  async getTaskComments(taskId: string): Promise<(TaskComment & { authorName: string | null; authorRole: string | null })[]> {
    const rows = await db.select({
      id: taskComments.id, taskId: taskComments.taskId, companyId: taskComments.companyId,
      authorUserId: taskComments.authorUserId, content: taskComments.content, createdAt: taskComments.createdAt,
      authorName: users.name, authorRole: users.role,
    }).from(taskComments).leftJoin(users, eq(taskComments.authorUserId, users.id))
      .where(eq(taskComments.taskId, taskId)).orderBy(taskComments.createdAt);
    return rows;
  }

  async getTaskSubmissionsByTask(taskId: string): Promise<TaskSubmission[]> {
    return db.select().from(taskSubmissions).where(eq(taskSubmissions.taskId, taskId)).orderBy(desc(taskSubmissions.submittedAt));
  }

  async getWorkActivitiesByTask(taskId: string): Promise<WorkActivity[]> {
    return db.select().from(workActivities).where(eq(workActivities.taskId, taskId)).orderBy(workActivities.startedAt);
  }

  async getRecentTaskSubmissionsByCompany(companyId: string, limit = 20): Promise<TaskSubmission[]> {
    return db.select().from(taskSubmissions).where(eq(taskSubmissions.companyId, companyId)).orderBy(desc(taskSubmissions.submittedAt)).limit(limit);
  }

  // ---- Pulse Chat history ----
  async createAssistantMessage(data: InsertAssistantMessage): Promise<AssistantMessage> {
    const [created] = await db.insert(assistantMessages).values(data as any).returning();
    return created;
  }

  async getAssistantMessages(userId: string, limit = 60): Promise<AssistantMessage[]> {
    const rows = await db.select().from(assistantMessages).where(eq(assistantMessages.userId, userId)).orderBy(desc(assistantMessages.createdAt)).limit(limit);
    return rows.reverse();
  }

  async clearAssistantMessages(userId: string): Promise<void> {
    await db.delete(assistantMessages).where(eq(assistantMessages.userId, userId));
  }

  // ---- Global search ----
  // Case-insensitive substring match across the entity types a user is
  // allowed to see. Scoping is done HERE, not by the caller filtering
  // afterwards, so an intern's query never touches another intern's rows.
  async searchTasks(companyId: string, q: string, assigneeId: string | null, limit = 8): Promise<Task[]> {
    const pattern = `%${q}%`;
    const conds = [eq(tasks.companyId, companyId), or(ilike(tasks.title, pattern), ilike(tasks.description, pattern))!];
    if (assigneeId) conds.push(eq(tasks.assigneeId, assigneeId));
    return db.select().from(tasks).where(and(...conds)).orderBy(desc(tasks.updatedAt)).limit(limit);
  }

  async searchProjects(companyId: string, q: string, internId: string | null, limit = 6): Promise<Project[]> {
    const pattern = `%${q}%`;
    const conds = [eq(projects.companyId, companyId), or(ilike(projects.title, pattern), ilike(projects.idea, pattern))!];
    if (internId) conds.push(eq(projects.internId, internId));
    return db.select().from(projects).where(and(...conds)).orderBy(desc(projects.createdAt)).limit(limit);
  }

  async searchUsers(companyId: string, q: string, limit = 6): Promise<User[]> {
    const pattern = `%${q}%`;
    return db.select().from(users)
      .where(and(eq(users.companyId, companyId), ne(users.role, "system"), or(ilike(users.name, pattern), ilike(users.email, pattern))!))
      .orderBy(users.name).limit(limit);
  }

  async searchChannelMessages(userId: string, q: string, limit = 6): Promise<(ChannelMessage & { channelName: string; channelType: string; userName: string })[]> {
    const pattern = `%${q}%`;
    const rows = await db.select({
      id: channelMessages.id, channelId: channelMessages.channelId, userId: channelMessages.userId,
      content: channelMessages.content, createdAt: channelMessages.createdAt,
      channelName: channels.name, channelType: channels.type, userName: users.name,
    }).from(channelMessages)
      .innerJoin(channels, eq(channelMessages.channelId, channels.id))
      .innerJoin(channelMembers, and(eq(channelMembers.channelId, channels.id), eq(channelMembers.userId, userId)))
      .innerJoin(users, eq(channelMessages.userId, users.id))
      .where(ilike(channelMessages.content, pattern))
      .orderBy(desc(channelMessages.createdAt)).limit(limit);
    return rows;
  }

  async searchApplications(companyId: string, q: string, limit = 5): Promise<Application[]> {
    const pattern = `%${q}%`;
    return db.select().from(applications)
      .where(and(eq(applications.companyId, companyId), or(ilike(applications.name, pattern), ilike(applications.email, pattern))!))
      .orderBy(desc(applications.createdAt)).limit(limit);
  }

  async searchAlumni(companyId: string, q: string, limit = 5): Promise<User[]> {
    const pattern = `%${q}%`;
    return db.select().from(users)
      .where(and(eq(users.companyId, companyId), isNotNull(users.alumniAt), or(ilike(users.name, pattern), ilike(users.email, pattern))!))
      .orderBy(users.name).limit(limit);
  }

  async setCompanyOnboardingDismissed(companyId: string, dismissed: boolean): Promise<void> {
    await db.update(companies).set({ onboardingDismissedAt: dismissed ? new Date() : null }).where(eq(companies.id, companyId));
  }

  async deleteTask(id: string): Promise<void> {
    // work_activities.taskId and task_submissions.taskId both reference
    // tasks(id) with no cascade — deleting the task first would fail the FK
    // constraint. work_activities.taskId is nullable and gets set null:
    // it's genuine OS-observed activity independent of task correlation,
    // which should survive the task itself being removed (Workday Replay
    // already falls back to "Unknown task" for a null reference).
    // task_submissions.taskId is NOT NULL — a submission record is
    // inherently about a specific task, so those rows are deleted along
    // with the task they were submitted to, same as deleting a task
    // already discards its own submission/feedback fields.
    await db.transaction(async (tx) => {
      await tx.update(workActivities).set({ taskId: null, taskCorrelation: null }).where(eq(workActivities.taskId, id));
      await tx.update(tasks).set({ dependsOnTaskId: null }).where(eq(tasks.dependsOnTaskId, id));
      await tx.update(projectCompletionCriteria).set({ taskId: null }).where(eq(projectCompletionCriteria.taskId, id));
      await tx.delete(taskSubmissions).where(eq(taskSubmissions.taskId, id));
      await tx.delete(taskComments).where(eq(taskComments.taskId, id));
      await tx.delete(tasks).where(eq(tasks.id, id));
    });
  }

  async createCompletionCriterion(data: { projectId: string; text: string; optional?: boolean; taskId?: string | null; sortOrder?: number }): Promise<ProjectCompletionCriterion> {
    const [created] = await db.insert(projectCompletionCriteria).values({
      projectId: data.projectId,
      text: data.text,
      optional: data.optional ?? false,
      taskId: data.taskId ?? null,
      sortOrder: data.sortOrder ?? 0,
    }).returning();
    return created;
  }

  async getCompletionCriteriaByProject(projectId: string): Promise<ProjectCompletionCriterion[]> {
    return db.select().from(projectCompletionCriteria).where(eq(projectCompletionCriteria.projectId, projectId)).orderBy(projectCompletionCriteria.sortOrder, projectCompletionCriteria.createdAt);
  }

  async updateCompletionCriterion(id: string, data: { text?: string; optional?: boolean; sortOrder?: number }): Promise<ProjectCompletionCriterion | undefined> {
    const updateData: any = {};
    if (data.text !== undefined) updateData.text = data.text;
    if (data.optional !== undefined) updateData.optional = data.optional;
    if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;
    if (Object.keys(updateData).length === 0) return this.getCompletionCriterionById(id);
    const [updated] = await db.update(projectCompletionCriteria).set(updateData).where(eq(projectCompletionCriteria.id, id)).returning();
    return updated;
  }

  async getCompletionCriterionById(id: string): Promise<ProjectCompletionCriterion | undefined> {
    const [found] = await db.select().from(projectCompletionCriteria).where(eq(projectCompletionCriteria.id, id));
    return found;
  }

  async setCompletionCriterionDone(id: string, completed: boolean, completedByUserId: string | null): Promise<ProjectCompletionCriterion | undefined> {
    const [updated] = await db.update(projectCompletionCriteria)
      .set({ completed, completedAt: completed ? new Date() : null, completedByUserId: completed ? completedByUserId : null })
      .where(eq(projectCompletionCriteria.id, id))
      .returning();
    return updated;
  }

  async deleteCompletionCriterion(id: string): Promise<void> {
    await db.delete(projectCompletionCriteria).where(eq(projectCompletionCriteria.id, id));
  }

  async getSignalDismissalsByCompany(companyId: string): Promise<SignalDismissal[]> {
    return db.select().from(signalDismissals).where(eq(signalDismissals.companyId, companyId));
  }

  async upsertSignalDismissal(companyId: string, signalKey: string, userId: string, snoozedUntil: Date | null): Promise<SignalDismissal> {
    const [row] = await db.insert(signalDismissals)
      .values({ companyId, signalKey, dismissedByUserId: userId, snoozedUntil })
      .onConflictDoUpdate({
        target: [signalDismissals.companyId, signalDismissals.signalKey],
        set: { dismissedByUserId: userId, snoozedUntil, createdAt: new Date() },
      })
      .returning();
    return row;
  }

  // --- Work Sessions ("shifts") ---

  async getActiveWorkSession(internId: string): Promise<WorkSession | undefined> {
    const [session] = await db.select().from(workSessions)
      .where(and(eq(workSessions.internId, internId), eq(workSessions.status, "active")));
    return session;
  }

  // The partial unique index (one active session per intern) is the real
  // guarantee against a race between two near-simultaneous start calls;
  // this pre-check just gives the common (non-race) case a clean, typed
  // error path instead of surfacing a raw constraint-violation.
  async startWorkSession(internId: string, companyId: string): Promise<WorkSession> {
    // No pre-check here on purpose: the route already did one, and a
    // second one would let a racing request silently "succeed" by
    // returning the other request's row. The unique index decides.
    const [created] = await db.insert(workSessions)
      .values({ internId, companyId, status: "active" })
      .returning();
    return created;
  }

  async endWorkSession(internId: string, endReason: string = "manual", endedByUserId: string | null = null, endedAt: Date = new Date()): Promise<WorkSession | undefined> {
    const active = await this.getActiveWorkSession(internId);
    if (!active) return undefined;
    return this.endWorkSessionById(active.id, endReason, endedByUserId, endedAt);
  }

  // Conditional on status='active' so a double End (or an auto-timeout
  // racing a manual End) can only ever close the row once. Also waits on
  // any in-flight activity insert that holds the row lock (see
  // createWorkActivitiesForActiveSession), so nothing lands after the end.
  async endWorkSessionById(sessionId: string, endReason: string, endedByUserId: string | null, endedAt: Date = new Date()): Promise<WorkSession | undefined> {
    return db.transaction(async (tx) => {
      const [locked] = await tx.select().from(workSessions).where(and(eq(workSessions.id, sessionId), eq(workSessions.status, "active"))).for("update");
      if (!locked) return undefined;
      const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(locked.startedAt).getTime()) / 1000));
      const [updated] = await tx.update(workSessions)
        .set({ endedAt, durationSeconds, status: "completed", endReason, endedByUserId })
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.status, "active")))
        .returning();
      return updated;
    });
  }

  async getActiveWorkSessionsOlderThan(cutoff: Date): Promise<WorkSession[]> {
    return db.select().from(workSessions).where(and(eq(workSessions.status, "active"), lt(workSessions.startedAt, cutoff)));
  }

  // Inserts activity only if the session is STILL active at commit time.
  // The FOR UPDATE lock on the session row serialises this against
  // endWorkSessionById: whichever transaction wins, the other sees the
  // final state — no sample can land on a shift that has already ended.
  async createWorkActivitiesForActiveSession(sessionId: string, rows: InsertWorkActivity[]): Promise<WorkActivity[] | null> {
    return db.transaction(async (tx) => {
      const [locked] = await tx.select({ id: workSessions.id }).from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.status, "active"))).for("update");
      if (!locked) return null;
      if (rows.length === 0) return [];
      return tx.insert(workActivities).values(rows).returning();
    });
  }

  async getWorkActivitiesBySessions(sessionIds: string[]): Promise<WorkActivity[]> {
    if (sessionIds.length === 0) return [];
    return db.select().from(workActivities).where(inArray(workActivities.sessionId, sessionIds)).orderBy(workActivities.startedAt);
  }

  async getLatestWorkActivityForSession(sessionId: string): Promise<WorkActivity | undefined> {
    const [row] = await db.select().from(workActivities).where(eq(workActivities.sessionId, sessionId)).orderBy(desc(workActivities.endedAt)).limit(1);
    return row;
  }

  async getLatestWorkActivitiesForSessions(sessionIds: string[]): Promise<Map<string, WorkActivity>> {
    const out = new Map<string, WorkActivity>();
    if (sessionIds.length === 0) return out;
    const rows = await db.select().from(workActivities).where(inArray(workActivities.sessionId, sessionIds)).orderBy(desc(workActivities.endedAt));
    for (const r of rows) if (!out.has(r.sessionId)) out.set(r.sessionId, r);
    return out;
  }

  async getWorkSessionById(id: string): Promise<WorkSession | undefined> {
    const [found] = await db.select().from(workSessions).where(eq(workSessions.id, id));
    return found;
  }

  async getWorkSessionsByIntern(internId: string, limit = 50): Promise<WorkSession[]> {
    return db.select().from(workSessions)
      .where(eq(workSessions.internId, internId))
      .orderBy(desc(workSessions.startedAt))
      .limit(limit);
  }

  async getWorkSessionsByInternSince(internId: string, since: Date): Promise<WorkSession[]> {
    return db.select().from(workSessions)
      .where(and(eq(workSessions.internId, internId), gt(workSessions.startedAt, since)))
      .orderBy(desc(workSessions.startedAt));
  }

  async getActiveWorkSessionsByCompany(companyId: string): Promise<WorkSession[]> {
    return db.select().from(workSessions)
      .where(and(eq(workSessions.companyId, companyId), eq(workSessions.status, "active")));
  }

  async getWorkSessionsByCompanySince(companyId: string, since: Date): Promise<WorkSession[]> {
    return db.select().from(workSessions)
      .where(and(eq(workSessions.companyId, companyId), gt(workSessions.startedAt, since)))
      .orderBy(desc(workSessions.startedAt));
  }

  // SQL-aggregated rather than fetching every row — "overall" totals grow
  // unbounded over a long internship, so this stays O(1) response size
  // regardless of history length.
  async getWorkSessionAggregateByIntern(internId: string): Promise<{ totalSeconds: number; sessionCount: number }> {
    const [row] = await db.select({
      totalSeconds: sql<number>`coalesce(sum(${workSessions.durationSeconds}), 0)::int`,
      sessionCount: count(),
    }).from(workSessions).where(and(eq(workSessions.internId, internId), eq(workSessions.status, "completed")));
    return { totalSeconds: row?.totalSeconds ?? 0, sessionCount: row?.sessionCount ?? 0 };
  }

  // --- Desktop companion: activity + shift reports ---

  async createWorkActivities(data: InsertWorkActivity[]): Promise<WorkActivity[]> {
    if (data.length === 0) return [];
    return db.insert(workActivities).values(data).returning();
  }

  async getWorkActivitiesBySession(sessionId: string): Promise<WorkActivity[]> {
    return db.select().from(workActivities).where(eq(workActivities.sessionId, sessionId)).orderBy(workActivities.startedAt);
  }

  async createTaskSubmission(data: InsertTaskSubmission): Promise<TaskSubmission> {
    const [created] = await db.insert(taskSubmissions).values(data).returning();
    return created;
  }

  async getTaskSubmissionsByInternInWindow(internId: string, start: Date, end: Date): Promise<TaskSubmission[]> {
    return db.select().from(taskSubmissions).where(
      and(eq(taskSubmissions.internId, internId), gte(taskSubmissions.submittedAt, start), lte(taskSubmissions.submittedAt, end))
    );
  }

  // Aggregated by application rather than returning every raw sample — an
  // admin should see "VS Code · 1h 12m", never a timestamped dump of every
  // app switch.
  async getWorkActivityBreakdownBySession(sessionId: string): Promise<{ application: string; category: string; totalSeconds: number }[]> {
    return db.select({
      application: workActivities.application,
      category: workActivities.category,
      totalSeconds: sql<number>`coalesce(sum(${workActivities.durationSeconds}), 0)::int`,
    }).from(workActivities).where(eq(workActivities.sessionId, sessionId))
      .groupBy(workActivities.application, workActivities.category)
      .orderBy(sql`coalesce(sum(${workActivities.durationSeconds}), 0) desc`);
  }

  async createWorkSummary(data: InsertWorkSummary): Promise<WorkSummary> {
    const [created] = await db.insert(workSummaries).values(data).returning();
    return created;
  }

  async getWorkSummaryBySession(sessionId: string): Promise<WorkSummary | undefined> {
    const [found] = await db.select().from(workSummaries).where(eq(workSummaries.sessionId, sessionId));
    return found;
  }

  async updateWorkSummary(id: string, data: { internNote?: string; reviewedAt?: Date; submittedAt?: Date }): Promise<WorkSummary | undefined> {
    const [updated] = await db.update(workSummaries).set(data).where(eq(workSummaries.id, id)).returning();
    return updated;
  }

  async getWorkSummariesByIntern(internId: string, limit = 50): Promise<WorkSummary[]> {
    return db.select().from(workSummaries).where(eq(workSummaries.internId, internId)).orderBy(desc(workSummaries.generatedAt)).limit(limit);
  }

  async getRecentSubmittedWorkSummariesByCompany(companyId: string, since: Date): Promise<WorkSummary[]> {
    return db.select().from(workSummaries)
      .where(and(eq(workSummaries.companyId, companyId), gt(workSummaries.submittedAt, since)))
      .orderBy(desc(workSummaries.submittedAt));
  }
}

export const storage = new DatabaseStorage();
