import { eq, desc, and, count, inArray, gt, isNull, sql, or } from "drizzle-orm";
import { db } from "./db";
import { lt } from "drizzle-orm";
import crypto from "crypto";
import { aggregateSkillTags } from "@shared/skills";
import {
  users, companies, invitations, projects, planVersions, comments, weeklyLogs, logComments, notifications, teamMessages, chatMessages,
  channels, channelMembers, channelMessages, userDevices, auditLogs, applications, tasks, performanceNarratives, digestRuns, alumniRecords,
  passwordResetTokens as resetTokensTable, signupTokens as signupTokensTable,
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
  type TeamMessage, type InsertTeamMessage,
  type ChatMessage, type InsertChatMessage,
  type Channel, type InsertChannel,
  type ChannelMember, type InsertChannelMember,
  type ChannelMessage, type InsertChannelMessage,
  type PasswordResetToken, type InsertPasswordResetToken,
  type SignupToken, type InsertSignupToken,
  type UserDevice, type InsertUserDevice,
  type AuditLog, type InsertAuditLog,
  type Task, type InsertTask,
  type PerformanceNarrative, type InsertPerformanceNarrative,
  type DigestRun,
  type AlumniRecord,
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
  updateUserPassword(id: string, passwordHash: string): Promise<void>;
  setUserDeactivated(id: string, deactivated: boolean): Promise<User | undefined>;
  setUserPublicProfile(id: string, enabled: boolean): Promise<User | undefined>;
  setUserCompletionBadge(id: string, awarded: boolean, awardedByUserId: string | null): Promise<User | undefined>;
  transitionUserToAlumni(id: string, transitionedByUserId: string): Promise<{ user: User; alumniRecord: AlumniRecord }>;
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
  markInvitationUsed(id: string): Promise<void>;
  getInvitationsByCompany(companyId: string): Promise<Invitation[]>;

  createProject(data: InsertProject): Promise<Project>;
  getProjectById(id: string): Promise<Project | undefined>;
  getProjectsByIntern(internId: string): Promise<Project[]>;
  getProjectsByCompany(companyId: string): Promise<Project[]>;
  updateProjectStatus(id: string, status: string): Promise<Project | undefined>;
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
  getNotificationsByUser(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  getUnreadNotificationCount(userId: string): Promise<number>;

  // Team Chat
  getTeamMessages(companyId: string, limit?: number): Promise<(TeamMessage & { userName: string })[]>;
  createTeamMessage(data: InsertTeamMessage): Promise<TeamMessage>;

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
  markPasswordResetTokenUsed(token: string): Promise<void>;

  createSignupToken(data: InsertSignupToken): Promise<SignupToken>;
  getSignupToken(token: string): Promise<SignupToken | undefined>;
  markSignupTokenUsed(token: string): Promise<void>;

  // Devices
  createUserDevice(data: InsertUserDevice): Promise<UserDevice>;
  getUserDeviceByDeviceId(deviceId: string): Promise<UserDevice | undefined>;
  getUserDevicesByUser(userId: string): Promise<UserDevice[]>;
  touchUserDevice(deviceId: string): Promise<void>;
  renameUserDevice(id: string, userId: string, name: string): Promise<UserDevice | undefined>;
  revokeUserDevice(id: string, userId: string): Promise<UserDevice | undefined>;

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
  getPendingApplicationByEmail(companyId: string, email: string): Promise<Application | undefined>;
  getApplicationByEmail(companyId: string, email: string): Promise<Application | undefined>;
  updateApplicationStatus(id: string, status: string, reviewedByUserId: string, reviewerNotes?: string): Promise<Application | undefined>;

  // Tasks
  createTask(data: InsertTask): Promise<Task>;
  getTaskById(id: string): Promise<Task | undefined>;
  getTasksByCompany(companyId: string): Promise<Task[]>;
  getTasksByAssignee(assigneeId: string): Promise<Task[]>;
  getTasksByProjectIds(projectIds: string[]): Promise<Task[]>;
  updateTaskDetails(id: string, data: { title?: string; description?: string | null; assigneeId?: string; projectId?: string | null; priority?: string; dueDate?: Date | null; skillTags?: string[] }): Promise<Task | undefined>;
  updateTaskStatus(id: string, status: string, extra?: { submission?: string; submittedAt?: Date | null; feedback?: string | null; blockedReason?: string | null; completedAt?: Date | null }): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
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
  async transitionUserToAlumni(id: string, transitionedByUserId: string): Promise<{ user: User; alumniRecord: AlumniRecord }> {
    const [existingUser] = await db.select().from(users).where(eq(users.id, id));
    if (!existingUser) throw new Error("User not found");

    const internTasks = await this.getTasksByAssignee(id);
    const completed = internTasks.filter((t) => t.status === "completed");
    const narrative = await this.getLatestPerformanceNarrative(id);

    const snapshot = {
      userId: id,
      companyId: existingUser.companyId as string,
      internshipStartedAt: existingUser.createdAt,
      internshipEndedAt: new Date(),
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
    return db.select().from(companies);
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

  async getInvitationByToken(token: string): Promise<Invitation | undefined> {
    const [inv] = await db.select().from(invitations).where(eq(invitations.token, token));
    return inv;
  }

  async markInvitationUsed(id: string): Promise<void> {
    await db.update(invitations).set({ used: true }).where(eq(invitations.id, id));
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

  async updateProjectStatus(id: string, status: string): Promise<Project | undefined> {
    const [updated] = await db.update(projects).set({ status }).where(eq(projects.id, id)).returning();
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

  async deleteProject(id: string): Promise<void> {
    const versions = await this.getPlanVersionsByProject(id);
    for (const v of versions) {
      await db.delete(comments).where(eq(comments.versionId, v.id));
    }
    await db.delete(planVersions).where(eq(planVersions.projectId, id));
    const logs = await db.select({ id: weeklyLogs.id }).from(weeklyLogs).where(eq(weeklyLogs.projectId, id));
    if (logs.length > 0) {
      const logIds = logs.map(l => l.id);
      await db.delete(logComments).where(inArray(logComments.logId, logIds));
    }
    await db.delete(weeklyLogs).where(eq(weeklyLogs.projectId, id));
    await db.delete(chatMessages).where(eq(chatMessages.projectId, id));
    // The project's dedicated channel (members/messages cascade via the
    // channel's own FK) — without this, deleting a project left a channel
    // in the sidebar pointing at a project that no longer exists.
    await db.delete(channels).where(eq(channels.projectId, id));
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Full, irreversible removal of a user and everything that references
  // them. Order matters: children before the user row itself. Tables where
  // this user can only appear nullably (audit log actor, channel creator)
  // get nulled out instead of deleted, to preserve the surrounding
  // history/data rather than erase it.
  async deleteUserPermanently(id: string): Promise<void> {
    const ownedProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.internId, id));
    for (const p of ownedProjects) {
      await this.deleteProject(p.id);
    }
    await db.delete(tasks).where(eq(tasks.assigneeId, id));
    await db.delete(notifications).where(eq(notifications.userId, id));
    await db.delete(teamMessages).where(eq(teamMessages.userId, id));
    await db.delete(chatMessages).where(eq(chatMessages.userId, id));
    await db.delete(channelMessages).where(eq(channelMessages.userId, id));
    await db.delete(channelMembers).where(eq(channelMembers.userId, id));
    await db.update(channels).set({ createdById: null }).where(eq(channels.createdById, id));
    await db.delete(userDevices).where(eq(userDevices.userId, id));
    await db.update(auditLogs).set({ actorUserId: null }).where(eq(auditLogs.actorUserId, id));
    await db.delete(users).where(eq(users.id, id));
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

  async getNotificationsByUser(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
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

  async getTeamMessages(companyId: string, limit: number = 50): Promise<(TeamMessage & { userName: string })[]> {
    const rows = await db
      .select({
        id: teamMessages.id,
        companyId: teamMessages.companyId,
        userId: teamMessages.userId,
        content: teamMessages.content,
        createdAt: teamMessages.createdAt,
        userName: users.name,
      })
      .from(teamMessages)
      .innerJoin(users, eq(teamMessages.userId, users.id))
      .where(eq(teamMessages.companyId, companyId))
      .orderBy(desc(teamMessages.createdAt))
      .limit(limit);
    return rows.reverse();
  }

  async createTeamMessage(data: InsertTeamMessage): Promise<TeamMessage> {
    const [created] = await db.insert(teamMessages).values(data).returning();
    return created;
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

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [found] = await db.select().from(resetTokensTable).where(eq(resetTokensTable.token, token));
    return found;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db.update(resetTokensTable).set({ used: true }).where(eq(resetTokensTable.token, token));
  }

  async createSignupToken(data: InsertSignupToken): Promise<SignupToken> {
    const [created] = await db.insert(signupTokensTable).values(data).returning();
    return created;
  }

  async getSignupToken(token: string): Promise<SignupToken | undefined> {
    const [found] = await db.select().from(signupTokensTable).where(eq(signupTokensTable.token, token));
    return found;
  }

  async markSignupTokenUsed(token: string): Promise<void> {
    await db.update(signupTokensTable).set({ used: true }).where(eq(signupTokensTable.token, token));
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

  async updateTaskDetails(id: string, data: { title?: string; description?: string | null; assigneeId?: string; projectId?: string | null; priority?: string; dueDate?: Date | null; skillTags?: string[] }): Promise<Task | undefined> {
    const updateData: any = { updatedAt: new Date() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
    if (data.skillTags !== undefined) updateData.skillTags = data.skillTags;
    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async updateTaskStatus(id: string, status: string, extra?: { submission?: string; submittedAt?: Date | null; feedback?: string | null; blockedReason?: string | null; completedAt?: Date | null }): Promise<Task | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (extra?.submission !== undefined) updateData.submission = extra.submission;
    if (extra?.submittedAt !== undefined) updateData.submittedAt = extra.submittedAt;
    if (extra?.feedback !== undefined) updateData.feedback = extra.feedback;
    if (extra?.blockedReason !== undefined) updateData.blockedReason = extra.blockedReason;
    if (extra?.completedAt !== undefined) updateData.completedAt = extra.completedAt;
    const [updated] = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }
}

export const storage = new DatabaseStorage();
