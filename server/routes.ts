import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generatePlan, aiChat, summarizeLog, modifyPlan, orgAssistantChat, generatePerformanceNarrative, type OrgDigest, type PerformanceDigest } from "./services/aiService";
import { normalizeSkillTag, aggregateSkillTags } from "@shared/skills";
import { computeRiskFlags } from "./services/riskRadar";
import {
  sendInviteEmail, sendPlanSubmittedEmail, sendPlanApprovedEmail,
  sendRevisionRequestedEmail, sendCommentEmail, sendNewInternJoinedEmail,
  sendPasswordResetEmail,
  sendApplicationReceivedEmail, sendNewApplicationAdminEmail,
  sendApplicationApprovedEmail, sendApplicationRejectedEmail,
  getAdminNotificationEmails,
} from "./services/emailService";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer, { type StorageEngine } from "multer";
import path from "path";
import fs from "fs";
import rateLimit from "express-rate-limit";

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error(
    "JWT_SECRET must be set in production. Refusing to start with a known, insecure default secret — anyone could forge valid auth tokens.",
  );
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRY = "24h";

// Public, unauthenticated endpoints that create accounts, sessions, or
// consume single-use tokens are the highest-value targets for automated
// abuse (credential stuffing, token brute-forcing, spam signups).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." },
});
// InternOps runs as a single fixed workspace for EDAI — nobody creates or
// names a company at signup. Every manager who signs up joins this same
// company record, created lazily on first use.
const EDAI_COMPANY_NAME = "EDAI";
const EDAI_COMPANY_SLUG = "edai";

async function getOrCreateEdaiCompany() {
  const existing = await storage.getCompanyBySlug(EDAI_COMPANY_SLUG);
  if (existing) return existing;
  return storage.createCompany({ name: EDAI_COMPANY_NAME, slug: EDAI_COMPANY_SLUG });
}

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}


const diskStorage: StorageEngine = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, UPLOAD_DIR),
  filename: (_req: any, file: any, cb: any) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

function signToken(userId: string, role: string, companyId: string | null, deviceId: string): string {
  return jwt.sign({ userId, role, companyId, deviceId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function getBaseUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

// Generates a URL-safe slug for a company's public application page,
// appending a short random suffix on collision rather than failing signup
// over a cosmetic URL detail.
async function generateUniqueCompanySlug(name: string): Promise<string> {
  const base = name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "company";

  let slug = base;
  let attempt = 0;
  while (await storage.getCompanyBySlug(slug)) {
    attempt++;
    slug = `${base}-${crypto.randomBytes(3).toString("hex")}`;
    if (attempt > 5) break;
  }
  return slug;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Coarse, display-only parsing — never used for security decisions.
// Device identity/trust is entirely the server-generated deviceId below.
function parseUserAgent(ua: string | undefined): { platform: string; browser: string } {
  const s = ua || "";
  let platform = "Unknown";
  if (/iPhone|iPad|iPod/.test(s)) platform = "iOS";
  else if (/Android/.test(s)) platform = "Android";
  else if (/Mac OS X/.test(s)) platform = "macOS";
  else if (/Windows/.test(s)) platform = "Windows";
  else if (/Linux/.test(s)) platform = "Linux";

  let browser = "Unknown";
  if (/Edg\//.test(s)) browser = "Edge";
  else if (/OPR\//.test(s)) browser = "Opera";
  else if (/Chrome\//.test(s)) browser = "Chrome";
  else if (/CriOS\//.test(s)) browser = "Chrome";
  else if (/Firefox\//.test(s)) browser = "Firefox";
  else if (/Safari\//.test(s)) browser = "Safari";

  return { platform, browser };
}

// Mints a new device record for a freshly-issued session. The returned
// deviceId is a random server-generated token embedded in the JWT — never
// derived from the User-Agent, which is only parsed here for a
// human-readable label in the devices UI.
async function createDeviceForLogin(userId: string, req: Request): Promise<string> {
  const deviceId = crypto.randomBytes(24).toString("hex");
  const { platform, browser } = parseUserAgent(req.headers["user-agent"]);
  await storage.createUserDevice({
    userId,
    deviceId,
    name: `${browser} on ${platform}`,
    platform,
    browser,
  });
  return deviceId;
}

async function logAudit(params: {
  actorUserId: string | null;
  companyId: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await storage.createAuditLog({
      actorUserId: params.actorUserId,
      companyId: params.companyId,
      action: params.action,
      targetType: params.targetType || null,
      targetId: params.targetId || null,
      metadata: params.metadata || null,
    } as any);
  } catch (err) {
    // Audit logging must never break the request it's describing.
    console.error("Failed to write audit log:", err);
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; companyId: string | null; deviceId?: string };

    // Tokens minted before device tracking existed have no deviceId claim;
    // treat those as trusted (nothing to revoke) rather than locking
    // everyone out on deploy.
    if (decoded.deviceId) {
      const device = await storage.getUserDeviceByDeviceId(decoded.deviceId);
      if (device && device.revokedAt) {
        return res.status(401).json({ message: "This device's access has been revoked" });
      }
      storage.touchUserDevice(decoded.deviceId).catch(() => {});
    }

    // Checked on every request, not just at login, so deactivating an
    // intern mid-session cuts their access immediately rather than
    // waiting for their token to expire or for them to log in again.
    const user = await storage.getUser(decoded.userId);
    if (!user || user.deactivatedAt) {
      return res.status(401).json({ message: "This account has been deactivated" });
    }

    // Role/company come from this live lookup, not the JWT claim — the
    // claim is a snapshot from whenever the token was issued and never
    // updates, so trusting it here would mean a promoted intern (or an
    // admin demoted some other way) keeps stale permissions until their
    // token expires. Same immediacy principle as the deactivation check
    // above.
    (req as any).userId = decoded.userId;
    (req as any).userRole = user.role;
    (req as any).companyId = user.companyId;
    (req as any).deviceId = decoded.deviceId || null;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = (req as any).userRole;
    if (!roles.includes(role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Production-only: rewrites <title>/og:title/og:description in the
  // static index.html for this one dynamic path before falling through to
  // the normal SPA render, so link-preview crawlers (which don't execute
  // JS) see per-profile metadata. In dev, Vite's own middleware already
  // serves the SPA correctly for this path, so just fall through.
  app.get("/i/:slug", async (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();
    try {
      const user = await storage.getUserByPublicSlug(req.params.slug as string);
      if (!user || !user.publicProfileEnabled || user.deactivatedAt) return next();

      const indexPath = path.resolve(__dirname, "public", "index.html");
      const template = await fs.promises.readFile(indexPath, "utf-8");
      const title = `${escapeHtml(user.name)} — InternOps Profile`;
      const description = `See ${escapeHtml(user.name)}'s completed work and skills on InternOps.`;
      const html = template
        .replace(/<title>.*?<\/title>/, `<title>${title}</title>`)
        .replace(/property="og:title" content=".*?"/, `property="og:title" content="${title}"`)
        .replace(/property="og:description" content=".*?"/, `property="og:description" content="${description}"`)
        .replace(/name="twitter:title" content=".*?"/, `name="twitter:title" content="${title}"`)
        .replace(/name="twitter:description" content=".*?"/, `name="twitter:description" content="${description}"`);
      res.status(200).set({ "Content-Type": "text/html" }).send(html);
    } catch (error) {
      console.error("Failed to pre-render public profile page:", error);
      next();
    }
  });

  app.use("/uploads", (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Invalid or expired token" });
    }
    const filePath = path.join(UPLOAD_DIR, path.basename(req.path));
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ message: "File not found" });
    }
  });

  // Public signup — no email verification step, but also no immediate
  // account creation. This is a private internal app for EDAI, so every
  // public signup becomes a pending Application that a manager must
  // approve or reject from the dashboard before a real user account (and
  // any login access) exists. This reuses the same applications
  // table/approve/reject routes as the public /apply page below — signup
  // and "apply to join" are the same underlying flow.
  // SECURITY: nothing here ever creates a role: "admin" account, and role
  // is never read from the request body — manager accounts only ever come
  // from the dev-only seed script or an existing admin's direct action.
  app.post("/api/auth/signup", strictAuthLimiter, async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists. Try logging in instead." });
      }

      const company = await getOrCreateEdaiCompany();

      // Bootstrap escape hatch: a freshly deployed instance has zero admins
      // and the dev-only seed script refuses to run in production, so
      // without this there would be no way to ever get a first manager
      // account on a real deployment. Only fires once — the moment any
      // admin exists, every subsequent signup goes through the normal
      // pending-approval queue below, same as always.
      const existingAdmins = await storage.getAdminsByCompany(company.id);
      if (existingAdmins.length === 0) {
        const passwordHash = await bcrypt.hash(password, 10);
        const user = await storage.createUser({
          name: name.trim(),
          email: normalizedEmail,
          passwordHash,
          role: "admin",
          companyId: company.id,
        });
        const generalChannel = await storage.ensureGeneralChannel(company.id);
        await storage.addChannelMember(generalChannel.id, user.id);

        await logAudit({
          actorUserId: user.id,
          companyId: company.id,
          action: "admin.bootstrapped",
          targetType: "user",
          targetId: user.id,
        });

        const deviceId = await createDeviceForLogin(user.id, req);
        const jwtToken = signToken(user.id, user.role, user.companyId, deviceId);
        return res.status(201).json({
          token: jwtToken,
          user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
        });
      }

      const existingApplication = await storage.getPendingApplicationByEmail(company.id, normalizedEmail);
      if (existingApplication) {
        return res.status(400).json({ message: "You already have a pending signup request awaiting approval" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const application = await storage.createApplication({
        companyId: company.id,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        skills: null,
        motivation: null,
        githubUrl: null,
        linkedinUrl: null,
        portfolioUrl: null,
        status: "pending",
      } as any);

      for (const admin of existingAdmins) {
        await storage.createNotification({
          userId: admin.id,
          title: "New Signup Request",
          message: `${name.trim()} signed up and is waiting for approval.`,
          read: false,
          link: "/?view=applications",
        });
      }

      res.status(201).json({
        message: "Your account request has been submitted and is pending manager approval.",
        pending: true,
      });
    } catch (error: any) {
      console.error("Signup failed:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // Single unified login — no separate admin/intern login surface. The role
  // on the response comes entirely from the database, never from anything
  // the client asserts, so the client just routes to the right dashboard
  // after the fact rather than picking a login mode beforehand.
  app.post("/api/auth/login", strictAuthLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const normalizedEmail = email.toLowerCase().trim();

      const user = await storage.getUserByEmail(normalizedEmail);
      if (!user) {
        // No account yet — but if there's a pending/rejected signup request
        // for this email, and the password matches what they set when they
        // applied, tell them why they can't log in instead of a generic
        // "invalid credentials". Gated on the password matching so this
        // can't be used to enumerate who has applied.
        const company = await getOrCreateEdaiCompany();
        const application = await storage.getApplicationByEmail(company.id, normalizedEmail);
        if (application) {
          const passwordMatches = await bcrypt.compare(password, application.passwordHash);
          if (passwordMatches) {
            if (application.status === "rejected") {
              return res.status(403).json({ message: "Your account request was not approved. Contact an admin if you think this is a mistake.", applicationStatus: "rejected" });
            }
            return res.status(403).json({ message: "Your account is still waiting on admin approval.", applicationStatus: "pending" });
          }
        }
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (user.deactivatedAt) {
        return res.status(403).json({ message: "This account has been deactivated. Contact an admin." });
      }

      const deviceId = await createDeviceForLogin(user.id, req);
      const token = signToken(user.id, user.role, user.companyId, deviceId);
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
      });
    } catch (error: any) {
      console.error("Login failed:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json({
        id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId,
        publicProfileEnabled: user.publicProfileEnabled, publicProfileSlug: user.publicProfileSlug,
        completionBadgeAwardedAt: user.completionBadgeAwardedAt,
      });
    } catch (error: any) {
      console.error("Failed to get user:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Self-service change-password for an already-logged-in user (either
  // role). Distinct from forgot-password below, which is for someone
  // who's locked out and doesn't have a current password to prove.
  app.put("/api/auth/change-password", requireAuth, authLimiter, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: "Current and new password are required" });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ message: "New password must be at least 6 characters" });
      }

      const user = await storage.getUser((req as any).userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Current password is incorrect" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, passwordHash);

      await logAudit({
        actorUserId: user.id,
        companyId: user.companyId,
        action: "user.changed_password",
        targetType: "user",
        targetId: user.id,
      });

      res.json({ message: "Password updated" });
    } catch (error: any) {
      console.error("Failed to change password:", error);
      res.status(500).json({ message: "Failed to change password" });
    }
  });

  // Self-service — any role can opt their own account in/out of having a
  // public profile page. Distinct from the completion badge, which is
  // admin-awarded only.
  app.put("/api/settings/public-profile", requireAuth, async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ message: "enabled must be a boolean" });
      }
      const updated = await storage.setUserPublicProfile((req as any).userId, enabled);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json({ publicProfileEnabled: updated.publicProfileEnabled, publicProfileSlug: updated.publicProfileSlug });
    } catch (error: any) {
      console.error("Failed to update public profile setting:", error);
      res.status(500).json({ message: "Failed to update public profile setting" });
    }
  });

  // Forgot password: send reset email
  app.post("/api/auth/forgot-password", strictAuthLimiter, async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      // Always return success to avoid leaking whether an email exists
      if (!user) {
        return res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await storage.createPasswordResetToken({
        email: user.email,
        token,
        expiresAt,
        used: false,
      });

      const baseUrl = getBaseUrl();
      const resetLink = `${baseUrl}/reset-password/${token}`;
      console.log(`\n========================================`);
      console.log(`🔑 PASSWORD RESET LINK`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Link: ${resetLink}`);
      console.log(`========================================\n`);
      sendPasswordResetEmail(user.email, resetLink).catch(() => {});

      res.status(200).json({ message: "If an account with that email exists, a reset link has been sent." });
    } catch (error: any) {
      console.error("Failed to process request:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  // Validate reset token
  app.get("/api/auth/verify-reset/:token", async (req, res) => {
    try {
      const resetToken = await storage.getPasswordResetToken(req.params.token);
      if (!resetToken) return res.status(404).json({ message: "Invalid or expired reset link" });
      if (resetToken.used) return res.status(400).json({ message: "This reset link has already been used" });
      if (new Date() > resetToken.expiresAt) return res.status(400).json({ message: "This reset link has expired" });

      res.json({ valid: true, email: resetToken.email });
    } catch (error: any) {
      console.error("Validation failed:", error);
      res.status(500).json({ message: "Validation failed" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password/:token", authLimiter, async (req, res) => {
    try {
      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ message: "Password is required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const resetToken = await storage.getPasswordResetToken(req.params.token);
      if (!resetToken) return res.status(404).json({ message: "Invalid or expired reset link" });
      if (resetToken.used) return res.status(400).json({ message: "This reset link has already been used" });
      if (new Date() > resetToken.expiresAt) return res.status(400).json({ message: "This reset link has expired" });

      const user = await storage.getUserByEmail(resetToken.email);
      if (!user) return res.status(404).json({ message: "User not found" });

      const passwordHash = await bcrypt.hash(password, 10);
      await storage.updateUserPassword(user.id, passwordHash);

      await storage.markPasswordResetTokenUsed(req.params.token);

      res.json({ message: "Password reset successfully. You can now log in with your new password." });
    } catch (error: any) {
      console.error("Password reset failed:", error);
      res.status(500).json({ message: "Password reset failed" });
    }
  });

  app.post("/api/invitations", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name, email } = req.body;
      const companyId = (req as any).companyId;

      if (!name || !email) {
        return res.status(400).json({ message: "Name and email are required" });
      }
      if (!companyId) {
        return res.status(400).json({ message: "Admin must belong to a company" });
      }

      const existingUser = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

      const invitation = await storage.createInvitation({
        email: email.toLowerCase().trim(),
        companyId,
        token,
        expiresAt,
        used: false,
      });

      const baseUrl = getBaseUrl();
      const inviteLink = `${baseUrl}/invite/${token}`;
      console.log(`\n========================================`);
      console.log(`📧 INTERN INVITE LINK`);
      console.log(`   Email: ${email.toLowerCase().trim()}`);
      console.log(`   Link: ${inviteLink}`);
      console.log(`========================================\n`);

      // Fire-and-forget email
      const company = await storage.getCompanyById(companyId);
      const adminUser = await storage.getUser((req as any).userId);
      sendInviteEmail(email.toLowerCase().trim(), inviteLink, company?.name || "your company", adminUser?.name).catch(() => {});

      res.status(201).json({
        message: "Invitation sent successfully",
        invitation: { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt },
        inviteLink,
      });
    } catch (error: any) {
      console.error("Failed to create invitation:", error);
      res.status(500).json({ message: "Failed to create invitation" });
    }
  });

  app.get("/api/invitations", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const invites = await storage.getInvitationsByCompany(companyId);
      res.json(invites);
    } catch (error: any) {
      console.error("Failed to get invitations:", error);
      res.status(500).json({ message: "Failed to get invitations" });
    }
  });

  app.get("/api/invitations/validate/:token", async (req, res) => {
    try {
      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) return res.status(404).json({ message: "Invalid invitation link" });
      if (invitation.used) return res.status(400).json({ message: "This invitation has already been used" });
      if (new Date() > invitation.expiresAt) return res.status(400).json({ message: "This invitation has expired" });

      const company = await storage.getCompanyById(invitation.companyId);
      const admins = (await storage.getUsersByCompany(invitation.companyId)).filter(u => u.role === "admin");
      const inviterName = admins.length > 0 ? admins[0].name : undefined;

      res.json({
        valid: true,
        email: invitation.email,
        companyName: company?.name || "Unknown",
        inviterName,
      });
    } catch (error: any) {
      console.error("Failed to validate invitation:", error);
      res.status(500).json({ message: "Failed to validate invitation" });
    }
  });

  app.post("/api/invitations/accept/:token", authLimiter, async (req, res) => {
    try {
      const { name, password } = req.body;
      if (!name || !password) {
        return res.status(400).json({ message: "Name and password are required" });
      }

      const invitation = await storage.getInvitationByToken(req.params.token);
      if (!invitation) return res.status(404).json({ message: "Invalid invitation link" });
      if (invitation.used) return res.status(400).json({ message: "This invitation has already been used" });
      if (new Date() > invitation.expiresAt) return res.status(400).json({ message: "This invitation has expired" });

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        name: name.trim(),
        email: invitation.email,
        passwordHash,
        role: "intern",
        companyId: invitation.companyId,
      });

      await storage.markInvitationUsed(invitation.id);

      // Add intern to #general channel
      const generalChannel = await storage.ensureGeneralChannel(invitation.companyId);
      await storage.addChannelMember(generalChannel.id, user.id);

      const adminUsers = (await storage.getUsersByCompany(invitation.companyId)).filter(u => u.role === "admin");
      const joinedCompany = await storage.getCompanyById(invitation.companyId);
      for (const admin of adminUsers) {
        await storage.createNotification({
          userId: admin.id,
          title: "New Intern Joined",
          message: `${name.trim()} has accepted the invitation and joined as an intern.`,
          read: false,
          link: "/?view=interns",
        });
        sendNewInternJoinedEmail(admin.email, name.trim(), joinedCompany?.name || "your company").catch(() => {});
      }

      const deviceId = await createDeviceForLogin(user.id, req);
      const token = signToken(user.id, user.role, user.companyId, deviceId);
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
      });
    } catch (error: any) {
      console.error("Failed to accept invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  // Public: lets the /apply/:slug page render a company name and confirm
  // applications are open, without exposing anything else about the company.
  app.get("/api/companies/:slug/public", async (req, res) => {
    try {
      const company = await storage.getCompanyBySlug(req.params.slug as string);
      if (!company || !company.acceptingApplications) {
        return res.status(404).json({ message: "This company isn't accepting applications right now" });
      }
      res.json({ name: company.name, slug: company.slug, acceptingApplications: true });
    } catch (error: any) {
      console.error("Failed to load company:", error);
      res.status(500).json({ message: "Failed to load company" });
    }
  });

  // Public: curated, opt-in intern profile — mirrors the company/public
  // pattern above. Deliberately projects only fields the intern consented
  // to expose; never email, feedback, blockedReason, or submission text.
  // Disappears immediately if the intern disables it or is deactivated,
  // same immediacy principle as requireAuth's live deactivation check.
  app.get("/api/public/interns/:slug", async (req, res) => {
    try {
      const user = await storage.getUserByPublicSlug(req.params.slug as string);
      if (!user || !user.publicProfileEnabled || user.deactivatedAt) {
        return res.status(404).json({ message: "Profile not found" });
      }
      const tasks = await storage.getTasksByAssignee(user.id);
      const completed = tasks
        .filter((t) => t.status === "completed")
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime())
        .slice(0, 50);

      res.json({
        name: user.name,
        completionBadge: !!user.completionBadgeAwardedAt,
        memberSince: user.createdAt ? new Date(user.createdAt).getFullYear() : null,
        completedTasks: completed.map((t) => ({ title: t.title, completedAt: t.completedAt })),
        skillTags: aggregateSkillTags(completed),
      });
    } catch (error: any) {
      console.error("Failed to load public intern profile:", error);
      res.status(500).json({ message: "Failed to load profile" });
    }
  });

  // Public: submit an internship application. Distinct from
  // /api/invitations/accept — this is applicant-initiated and always
  // requires admin review before an account is created.
  app.post("/api/applications", strictAuthLimiter, async (req, res) => {
    try {
      const { slug, name, email, password, skills, motivation, githubUrl, linkedinUrl, portfolioUrl } = req.body;
      if (!slug || !name?.trim() || !email?.trim() || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const company = await storage.getCompanyBySlug(slug);
      if (!company || !company.acceptingApplications) {
        return res.status(404).json({ message: "This company isn't accepting applications right now" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await storage.getUserByEmail(normalizedEmail);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists. Try logging in instead." });
      }
      const existingApplication = await storage.getPendingApplicationByEmail(company.id, normalizedEmail);
      if (existingApplication) {
        return res.status(400).json({ message: "You already have a pending application with this company" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const application = await storage.createApplication({
        companyId: company.id,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        skills: skills?.trim() || null,
        motivation: motivation?.trim() || null,
        githubUrl: githubUrl?.trim() || null,
        linkedinUrl: linkedinUrl?.trim() || null,
        portfolioUrl: portfolioUrl?.trim() || null,
        status: "pending",
      } as any);

      sendApplicationReceivedEmail(normalizedEmail, name.trim(), company.name).catch(() => {});

      const reviewLink = `${getBaseUrl()}/?view=applications`;
      const admins = (await storage.getUsersByCompany(company.id)).filter((u) => u.role === "admin");
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          title: "New Application",
          message: `${name.trim()} applied to join ${company.name}.`,
          read: false,
          link: "/?view=applications",
        });
        sendNewApplicationAdminEmail(admin.email, name.trim(), normalizedEmail, company.name, reviewLink, { skills, motivation }).catch(() => {});
      }
      for (const platformEmail of getAdminNotificationEmails()) {
        sendNewApplicationAdminEmail(platformEmail, name.trim(), normalizedEmail, company.name, reviewLink, { skills, motivation }).catch(() => {});
      }

      res.status(201).json({ message: "Application received", id: application.id });
    } catch (error: any) {
      console.error("Failed to submit application:", error);
      res.status(500).json({ message: "Failed to submit application" });
    }
  });

  app.get("/api/applications", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const apps = await storage.getApplicationsByCompany(companyId);
      res.json(apps.map(({ passwordHash, ...rest }) => rest));
    } catch (error: any) {
      console.error("Failed to get applications:", error);
      res.status(500).json({ message: "Failed to get applications" });
    }
  });

  app.get("/api/applications/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const application = await storage.getApplicationById(req.params.id as string);
      if (!application || application.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const { passwordHash, ...rest } = application;
      res.json(rest);
    } catch (error: any) {
      console.error("Failed to get application:", error);
      res.status(500).json({ message: "Failed to get application" });
    }
  });

  app.post("/api/applications/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const application = await storage.getApplicationById(req.params.id as string);
      if (!application || application.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Application not found" });
      }
      if (application.status === "approved") {
        return res.status(400).json({ message: "Application already approved" });
      }
      const existingUser = await storage.getUserByEmail(application.email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const user = await storage.createUser({
        name: application.name,
        email: application.email,
        passwordHash: application.passwordHash,
        role: "intern",
        companyId: application.companyId,
      });

      const generalChannel = await storage.ensureGeneralChannel(application.companyId);
      await storage.addChannelMember(generalChannel.id, user.id);

      await storage.updateApplicationStatus(application.id, "approved", (req as any).userId);

      const company = await storage.getCompanyById(application.companyId);
      const loginLink = `${getBaseUrl()}/intern-login`;
      sendApplicationApprovedEmail(application.email, application.name, company?.name || "your company", loginLink).catch(() => {});

      await logAudit({
        actorUserId: (req as any).userId,
        companyId: application.companyId,
        action: "application.approved",
        targetType: "application",
        targetId: application.id,
        metadata: { applicantEmail: application.email },
      });

      res.json({ message: "Application approved", userId: user.id });
    } catch (error: any) {
      console.error("Failed to approve application:", error);
      res.status(500).json({ message: "Failed to approve application" });
    }
  });

  app.post("/api/applications/:id/reject", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const application = await storage.getApplicationById(req.params.id as string);
      if (!application || application.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const { notes } = req.body || {};

      await storage.updateApplicationStatus(application.id, "rejected", (req as any).userId, notes?.trim() || undefined);

      const company = await storage.getCompanyById(application.companyId);
      sendApplicationRejectedEmail(application.email, application.name, company?.name || "your company").catch(() => {});

      await logAudit({
        actorUserId: (req as any).userId,
        companyId: application.companyId,
        action: "application.rejected",
        targetType: "application",
        targetId: application.id,
        metadata: { applicantEmail: application.email },
      });

      res.json({ message: "Application rejected" });
    } catch (error: any) {
      console.error("Failed to reject application:", error);
      res.status(500).json({ message: "Failed to reject application" });
    }
  });

  app.post("/api/applications/:id/request-info", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const application = await storage.getApplicationById(req.params.id as string);
      if (!application || application.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Application not found" });
      }
      const { notes } = req.body;
      if (!notes?.trim()) {
        return res.status(400).json({ message: "Notes explaining what's needed are required" });
      }

      await storage.updateApplicationStatus(application.id, "needs_information", (req as any).userId, notes.trim());

      await logAudit({
        actorUserId: (req as any).userId,
        companyId: application.companyId,
        action: "application.info_requested",
        targetType: "application",
        targetId: application.id,
      });

      res.json({ message: "Marked as needing more information" });
    } catch (error: any) {
      console.error("Failed to update application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  app.put("/api/company/accepting-applications", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ message: "No company" });
      const { accepting } = req.body;

      // Companies created before public applications existed have no slug.
      // Backfill one on first use instead of leaving the admin stuck with
      // no public URL to turn this on.
      const company = await storage.getCompanyById(companyId);
      if (company && !company.slug) {
        const slug = await generateUniqueCompanySlug(company.name);
        await storage.setCompanySlug(companyId, slug);
      }

      const updated = await storage.updateCompanyAcceptingApplications(companyId, !!accepting);
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update setting:", error);
      res.status(500).json({ message: "Failed to update setting" });
    }
  });

  app.get("/api/interns", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const interns = await storage.getInternsByCompany(companyId);
      res.json(interns.map(i => ({ id: i.id, name: i.name, email: i.email, role: i.role, createdAt: i.createdAt, deactivatedAt: i.deactivatedAt })));
    } catch (error: any) {
      console.error("Failed to get interns:", error);
      res.status(500).json({ message: "Failed to get interns" });
    }
  });

  // Deactivate blocks login immediately (checked on every request, not
  // just at login) but never deletes the intern's tasks, logs, or chat
  // history. Reactivating restores access with everything intact.
  app.post("/api/interns/:id/deactivate", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }
      const updated = await storage.setUserDeactivated(intern.id, true);

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "intern.deactivated",
        targetType: "user",
        targetId: intern.id,
      });

      res.json({ id: updated?.id, name: updated?.name, email: updated?.email, deactivatedAt: updated?.deactivatedAt });
    } catch (error: any) {
      console.error("Failed to deactivate intern:", error);
      res.status(500).json({ message: "Failed to deactivate intern" });
    }
  });

  app.post("/api/interns/:id/reactivate", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }
      const updated = await storage.setUserDeactivated(intern.id, false);

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "intern.reactivated",
        targetType: "user",
        targetId: intern.id,
      });

      res.json({ id: updated?.id, name: updated?.name, email: updated?.email, deactivatedAt: updated?.deactivatedAt });
    } catch (error: any) {
      console.error("Failed to reactivate intern:", error);
      res.status(500).json({ message: "Failed to reactivate intern" });
    }
  });

  // Irreversible. Unlike deactivate (which just blocks login), this erases
  // the intern's tasks, work logs, chat messages, and devices for good.
  // Scoped to role === "intern" only — deleting a manager isn't offered
  // here; demote them first (POST /api/managers/:id/demote), which is
  // itself already blocked from ever reaching zero managers.
  app.delete("/api/interns/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "intern.deleted_permanently",
        targetType: "user",
        targetId: intern.id,
        metadata: { name: intern.name, email: intern.email },
      });

      await storage.deleteUserPermanently(intern.id);

      res.json({ message: `${intern.name}'s account and all associated data has been permanently deleted.` });
    } catch (error: any) {
      console.error("Failed to delete intern:", error);
      res.status(500).json({ message: "Failed to delete intern" });
    }
  });

  // Free — just returns the last generated summary, if any. No AI call.
  app.get("/api/interns/:id/performance-narrative", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }
      const narrative = await storage.getLatestPerformanceNarrative(intern.id);
      res.json(narrative || null);
    } catch (error: any) {
      console.error("Failed to get performance narrative:", error);
      res.status(500).json({ message: "Failed to get performance narrative" });
    }
  });

  app.post("/api/interns/:id/performance-narrative", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }

      const company = await storage.getCompanyById(companyId);
      const internTasks = await storage.getTasksByAssignee(intern.id);
      const completed = internTasks
        .filter((t) => t.status === "completed")
        .sort((a, b) => new Date(b.completedAt || 0).getTime() - new Date(a.completedAt || 0).getTime());

      const digest: PerformanceDigest = {
        internName: intern.name,
        companyName: company?.name || "the organization",
        completedTasks: completed.map((t) => ({
          title: t.title,
          completedAt: t.completedAt ? new Date(t.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "unknown date",
          priority: t.priority,
          skillTags: t.skillTags || [],
        })),
        skillCounts: aggregateSkillTags(completed),
        totalCompleted: completed.length,
      };

      const { content, aiGenerated } = await generatePerformanceNarrative(digest);
      const narrative = await storage.createPerformanceNarrative({
        userId: intern.id,
        companyId,
        generatedByUserId: (req as any).userId,
        content,
        aiGenerated,
        taskSnapshotCount: completed.length,
      });

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "performance_narrative.generated",
        targetType: "user",
        targetId: intern.id,
      });

      res.status(201).json(narrative);
    } catch (error: any) {
      console.error("Failed to generate performance narrative:", error);
      res.status(500).json({ message: "Failed to generate performance narrative" });
    }
  });

  // Admin-awarded institutional credential, shown on the intern's public
  // profile if they've opted in. Never self-asserted by the intern.
  app.post("/api/interns/:id/completion-badge", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }
      const { awarded } = req.body;
      if (typeof awarded !== "boolean") {
        return res.status(400).json({ message: "awarded must be a boolean" });
      }
      const updated = await storage.setUserCompletionBadge(intern.id, awarded, awarded ? (req as any).userId : null);

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: awarded ? "intern.completion_badge_awarded" : "intern.completion_badge_revoked",
        targetType: "user",
        targetId: intern.id,
      });

      res.json({ completionBadgeAwardedAt: updated?.completionBadgeAwardedAt });
    } catch (error: any) {
      console.error("Failed to update completion badge:", error);
      res.status(500).json({ message: "Failed to update completion badge" });
    }
  });

  // Grants full admin access — the most sensitive action an admin can take
  // here. Only reachable by an existing admin (requireRole below), and the
  // target's role is a hardcoded server-side "admin" constant, never taken
  // from the request body, so this can't be pointed at an arbitrary role.
  // Deliberately no self-service or intern-facing path to this route.
  app.post("/api/interns/:id/promote", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const intern = await storage.getUser(req.params.id as string);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(404).json({ message: "Intern not found" });
      }
      if (intern.deactivatedAt) {
        return res.status(400).json({ message: "Reactivate this account before promoting it" });
      }

      const updated = await storage.promoteToAdmin(intern.id);

      await storage.createNotification({
        userId: intern.id,
        title: "You're now a manager",
        message: "You've been promoted to manager on EDAI. Log out and back in to see the manager dashboard.",
        read: false,
        link: "/",
      });

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "intern.promoted_to_admin",
        targetType: "user",
        targetId: intern.id,
      });

      res.json({ id: updated?.id, name: updated?.name, email: updated?.email, role: updated?.role });
    } catch (error: any) {
      console.error("Failed to promote intern:", error);
      res.status(500).json({ message: "Failed to promote intern" });
    }
  });

  app.get("/api/managers", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const admins = await storage.getAdminsByCompany(companyId);
      res.json(admins.map(a => ({ id: a.id, name: a.name, email: a.email, createdAt: a.createdAt })));
    } catch (error: any) {
      console.error("Failed to get managers:", error);
      res.status(500).json({ message: "Failed to get managers" });
    }
  });

  // Demoting is deliberately restricted beyond just "must be an admin":
  // - Can't demote yourself (no accidental or malicious self-lockout).
  // - Can't demote the last remaining admin — there's no self-service path
  //   back to admin, so that would permanently strand the whole company
  //   with nobody able to manage it.
  // Role is a hardcoded server-side "intern" constant, same as every other
  // role-changing route here — never taken from the request body.
  app.post("/api/managers/:id/demote", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const actorId = (req as any).userId;
      const target = await storage.getUser(req.params.id as string);
      if (!target || target.companyId !== companyId || target.role !== "admin") {
        return res.status(404).json({ message: "Manager not found" });
      }
      if (target.id === actorId) {
        return res.status(400).json({ message: "You can't demote yourself" });
      }

      const allAdmins = await storage.getAdminsByCompany(companyId);
      if (allAdmins.length <= 1) {
        return res.status(400).json({ message: "Can't demote the last remaining manager" });
      }

      const updated = await storage.demoteToIntern(target.id);

      await storage.createNotification({
        userId: target.id,
        title: "Your manager access was removed",
        message: "You've been moved back to an intern account on EDAI.",
        read: false,
        link: "/",
      });

      await logAudit({
        actorUserId: actorId,
        companyId,
        action: "admin.demoted_to_intern",
        targetType: "user",
        targetId: target.id,
      });

      res.json({ id: updated?.id, name: updated?.name, email: updated?.email, role: updated?.role });
    } catch (error: any) {
      console.error("Failed to demote manager:", error);
      res.status(500).json({ message: "Failed to demote manager" });
    }
  });

  // Immediate intern account creation — no invite link, no email to check.
  // The admin sets the intern's name/email/password directly and relays the
  // credentials however they like; the account exists right away.
  app.post("/api/interns", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name, email, password } = req.body;
      const companyId = (req as any).companyId;

      if (!name?.trim() || !email || !password) {
        return res.status(400).json({ message: "Name, email, and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }
      if (!companyId) {
        return res.status(400).json({ message: "Admin must belong to a company" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const existing = await storage.getUserByEmail(normalizedEmail);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const intern = await storage.createUser({
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        role: "intern",
        companyId,
      });

      const generalChannel = await storage.ensureGeneralChannel(companyId);
      await storage.addChannelMember(generalChannel.id, intern.id);

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "intern.created",
        targetType: "user",
        targetId: intern.id,
      });

      res.status(201).json({ id: intern.id, name: intern.name, email: intern.email, role: intern.role, createdAt: intern.createdAt });
    } catch (error: any) {
      console.error("Failed to create intern account:", error);
      res.status(500).json({ message: "Failed to create intern account" });
    }
  });

  app.post("/api/projects", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { internId, title, idea, minimumTotalHours } = req.body;
      const companyId = (req as any).companyId;

      if (!internId || !title || !idea || !minimumTotalHours) {
        return res.status(400).json({ message: "internId, title, idea, and minimumTotalHours are required" });
      }
      if (Number(minimumTotalHours) <= 0) {
        return res.status(400).json({ message: "Minimum total hours must be greater than 0" });
      }
      if (!companyId) {
        return res.status(400).json({ message: "Admin must belong to a company" });
      }

      const intern = await storage.getUser(internId);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(400).json({ message: "Invalid intern" });
      }

      const project = await storage.createProject({
        internId,
        companyId,
        title: title.trim(),
        idea: idea.trim(),
        minimumTotalHours: Number(minimumTotalHours),
        status: "assigned",
      });

      // Create project channel with intern + admins
      await storage.createProjectChannel(project);

      await storage.createNotification({
        userId: internId,
        title: "New Project Assigned",
        message: `You've been assigned a new project: "${title.trim()}"`,
        read: false,
        link: "/?projectId=" + project.id,
      });

      res.status(201).json(project);
    } catch (error: any) {
      console.error("Failed to assign project:", error);
      res.status(500).json({ message: "Failed to assign project" });
    }
  });

  app.get("/api/projects", requireAuth, async (req, res) => {
    try {
      const role = (req as any).userRole;
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;

      if (role === "intern") {
        const projects = await storage.getProjectsByIntern(userId);
        const enriched = await Promise.all(projects.map(async (p) => {
          const logs = await storage.getWeeklyLogsByProject(p.id);
          const latestVersion = await storage.getLatestPlanVersion(p.id);
          return { ...p, logCount: logs.length, weeklyLogs: logs, latestVersion: latestVersion || null };
        }));
        return res.json(enriched);
      }

      if (companyId) {
        const projects = await storage.getProjectsByCompany(companyId);
        return res.json(projects);
      }

      res.json([]);
    } catch (error: any) {
      console.error("Failed to get projects:", error);
      res.status(500).json({ message: "Failed to get projects" });
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });

      const role = (req as any).userRole;
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;

      if (role === "intern" && project.internId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (role === "admin" && project.companyId !== companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const versions = await storage.getPlanVersionsByProject(project.id);
      const intern = await storage.getUser(project.internId);
      const weeklyLogs = await storage.getWeeklyLogsByProject(project.id);

      res.json({
        ...project,
        versions,
        weeklyLogs,
        internName: intern?.name || "Unknown",
      });
    } catch (error: any) {
      console.error("Failed to get project:", error);
      res.status(500).json({ message: "Failed to get project" });
    }
  });

  app.post("/api/projects/:id/generate-plan", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { hoursPerDay, daysPerWeek, numberOfWeeks } = req.body;
      if (!hoursPerDay || !daysPerWeek || !numberOfWeeks) {
        return res.status(400).json({ message: "hoursPerDay, daysPerWeek, and numberOfWeeks are required" });
      }

      const totalPlannedHours = Number(hoursPerDay) * Number(daysPerWeek) * Number(numberOfWeeks);

      if (totalPlannedHours < project.minimumTotalHours) {
        return res.status(400).json({
          message: `Total planned hours (${totalPlannedHours}) must be at least ${project.minimumTotalHours} hours`,
        });
      }

      const existingVersions = await storage.getPlanVersionsByProject(project.id);
      const nextVersion = existingVersions.length > 0
        ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1
        : 1;

      const generated = await generatePlan(project.idea, totalPlannedHours, Number(numberOfWeeks));

      const contentJson = {
        hoursPerDay: Number(hoursPerDay),
        daysPerWeek: Number(daysPerWeek),
        numberOfWeeks: Number(numberOfWeeks),
        totalPlannedHours,
        weeks: generated.weeks,
      };

      const planVersion = await storage.createPlanVersion({
        projectId: project.id,
        versionNumber: nextVersion,
        contentJson,
        status: "draft",
      });

      await storage.updateProjectStatus(project.id, "planning");

      res.json({ planVersion });
    } catch (error: any) {
      console.error("Failed to generate plan:", error);
      res.status(500).json({ message: "Failed to generate plan" });
    }
  });

  app.put("/api/plan-versions/:id", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const pv = await storage.getPlanVersionById(req.params.id as string);
      if (!pv) return res.status(404).json({ message: "Plan version not found" });

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (pv.status !== "draft") {
        return res.status(400).json({ message: "Only draft plans can be edited" });
      }

      const { contentJson } = req.body;
      if (!contentJson) {
        return res.status(400).json({ message: "contentJson is required" });
      }

      const updated = await storage.updatePlanVersionContent(pv.id, contentJson);
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update plan:", error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.post("/api/plan-versions/:id/submit", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const pv = await storage.getPlanVersionById(req.params.id as string);
      if (!pv) return res.status(404).json({ message: "Plan version not found" });

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (pv.status !== "draft") {
        return res.status(400).json({ message: "Only draft plans can be submitted" });
      }

      await storage.updatePlanVersionStatus(pv.id, "submitted");
      await storage.updateProjectStatus(project.id, "submitted");

      const admins = (await storage.getUsersByCompany(project.companyId)).filter(u => u.role === "admin");
      const user = await storage.getUser((req as any).userId);
      for (const admin of admins) {
        await storage.createNotification({
          userId: admin.id,
          title: "Plan Submitted for Review",
          message: `${user?.name || "An intern"} submitted plan v${pv.versionNumber} for "${project.title}" for your review.`,
          read: false,
          link: "/?view=review&projectId=" + project.id,
        });
        sendPlanSubmittedEmail(admin.email, user?.name || "An intern", project.title, pv.versionNumber).catch(() => {});
      }

      res.json({ message: "Plan submitted for review" });
    } catch (error: any) {
      console.error("Failed to submit plan:", error);
      res.status(500).json({ message: "Failed to submit plan" });
    }
  });

  app.post("/api/plan-versions/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const pv = await storage.getPlanVersionById(req.params.id as string);
      if (!pv) return res.status(404).json({ message: "Plan version not found" });

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (pv.status !== "submitted") {
        return res.status(400).json({ message: "Only submitted plans can be approved" });
      }

      const { comment } = req.body || {};
      if (comment?.trim()) {
        await storage.createComment({
          versionId: pv.id,
          managerId: (req as any).userId,
          content: comment.trim(),
        });
      }

      await storage.updatePlanVersionStatus(pv.id, "approved");
      await storage.updateProjectStatus(project.id, "active");

      await storage.createNotification({
        userId: project.internId,
        title: "Plan Approved!",
        message: `Your plan v${pv.versionNumber} for "${project.title}" has been approved. Execution mode is now active.${comment?.trim() ? ` Manager's note: "${comment.trim().substring(0, 100)}"` : ""}`,
        read: false,
        link: "/?projectId=" + project.id,
      });

      const intern = await storage.getUser(project.internId);
      if (intern) {
        sendPlanApprovedEmail(intern.email, project.title, pv.versionNumber, comment?.trim()).catch(() => {});
      }

      res.json({ message: "Plan approved" });
    } catch (error: any) {
      console.error("Failed to approve plan:", error);
      res.status(500).json({ message: "Failed to approve plan" });
    }
  });

  app.post("/api/plan-versions/:id/request-revision", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const pv = await storage.getPlanVersionById(req.params.id as string);
      if (!pv) return res.status(404).json({ message: "Plan version not found" });

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (pv.status !== "submitted") {
        return res.status(400).json({ message: "Only submitted plans can be sent back for revision" });
      }

      const { comment } = req.body;
      if (!comment?.trim()) {
        return res.status(400).json({ message: "A comment explaining requested changes is required" });
      }

      await storage.createComment({
        versionId: pv.id,
        managerId: (req as any).userId,
        content: comment.trim(),
      });

      const newVersion = await storage.createPlanVersion({
        projectId: project.id,
        versionNumber: pv.versionNumber + 1,
        contentJson: pv.contentJson as any,
        status: "draft",
      });

      await storage.updateProjectStatus(project.id, "planning");

      await storage.createNotification({
        userId: project.internId,
        title: "Revision Requested",
        message: `Your manager requested changes to plan v${pv.versionNumber} for "${project.title}": "${comment.trim().substring(0, 100)}"`,
        read: false,
        link: "/?projectId=" + project.id,
      });

      const revIntern = await storage.getUser(project.internId);
      if (revIntern) {
        sendRevisionRequestedEmail(revIntern.email, project.title, pv.versionNumber, comment.trim()).catch(() => {});
      }

      try {
        const { generateRevisionGuidance } = await import("./services/aiService");
        const latestPlan = await storage.getLatestPlanVersion(project.id);
        const guidance = await generateRevisionGuidance(comment.trim(), latestPlan?.contentJson, project.idea);
        await storage.createNotification({
          userId: project.internId,
          title: "AI Revision Guidance",
          message: guidance.substring(0, 500),
          read: false,
          link: "/?projectId=" + project.id,
        });
      } catch (guidanceErr: any) {
        console.error("Failed to generate revision guidance:", guidanceErr.message);
      }

      res.json({ message: "Revision requested" });
    } catch (error: any) {
      console.error("Failed to request revision:", error);
      res.status(500).json({ message: "Failed to request revision" });
    }
  });

  app.get("/api/plan-versions/:id/comments", requireAuth, async (req, res) => {
    try {
      const comments = await storage.getCommentsByVersion(req.params.id as string);
      res.json(comments);
    } catch (error: any) {
      console.error("Failed to get comments:", error);
      res.status(500).json({ message: "Failed to get comments" });
    }
  });

  app.post("/api/plan-versions/:id/comments", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { content } = req.body;
      if (!content?.trim()) {
        return res.status(400).json({ message: "Comment content is required" });
      }

      const comment = await storage.createComment({
        versionId: req.params.id as string,
        managerId: (req as any).userId,
        content: content.trim(),
      });

      const pv = await storage.getPlanVersionById(req.params.id as string);
      if (pv) {
        const project = await storage.getProjectById(pv.projectId);
        if (project) {
          const manager = await storage.getUser((req as any).userId);
          await storage.createNotification({
            userId: project.internId,
            title: "New Comment on Plan",
            message: `${manager?.name || "Your manager"} commented on plan v${pv.versionNumber}: "${content.trim().substring(0, 100)}"`,
            read: false,
            link: "/?projectId=" + pv.projectId,
          });
          const commentIntern = await storage.getUser(project.internId);
          if (commentIntern) {
            sendCommentEmail(commentIntern.email, manager?.name || "Your manager", project.title, content.trim().substring(0, 200), "plan").catch(() => {});
          }
        }
      }

      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Failed to add comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
      const { projectId, messages, mode } = req.body;
      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "Messages array is required" });
      }

      let projectContext: any = null;

      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (project) {
          const versions = await storage.getPlanVersionsByProject(project.id);
          const latestPlan = await storage.getLatestPlanVersion(project.id);
          const allComments = await storage.getAllCommentsByProject(project.id);
          const weeklyLogs = await storage.getWeeklyLogsByProject(project.id);
          const logCommentsData = await storage.getLogCommentsByProject(project.id);

          projectContext = {
            title: project.title,
            idea: project.idea,
            status: project.status,
            minimumTotalHours: project.minimumTotalHours,
            currentPlan: latestPlan?.contentJson || null,
            currentPlanStatus: latestPlan?.status || null,
            currentPlanVersionId: latestPlan?.id || null,
            versionCount: versions.length,
            managerComments: allComments.map((c: any) => c.content),
            weeklyLogs: weeklyLogs.map((l: any) => ({ week: l.weekNumber, text: l.logText, date: l.createdAt })),
            logComments: logCommentsData.map((c: any) => c.content),
          };
        }
      }

      const chatMode = mode === "brainstorm" ? "brainstorm" : "plan";
      const response = await aiChat(projectContext, messages, chatMode);

      // Persist the latest user message and assistant reply
      const userId = (req as any).userId;
      if (projectId && userId) {
        const lastUserMsg = messages[messages.length - 1];
        if (lastUserMsg && lastUserMsg.role === "user") {
          await storage.saveChatMessage({
            projectId, userId, mode: chatMode,
            role: "user", content: lastUserMsg.content,
          });
        }
        await storage.saveChatMessage({
          projectId, userId, mode: chatMode,
          role: "assistant", content: response,
        });
      }

      res.json({ response });
    } catch (error: any) {
      console.error("AI chat failed:", error);
      res.status(500).json({ message: "AI chat failed" });
    }
  });

  // Chat history endpoints
  app.get("/api/ai/chat-history/:projectId/:mode", requireAuth, async (req, res) => {
    try {
      const { projectId, mode } = req.params;
      if (!["brainstorm", "plan"].includes(mode)) {
        return res.status(400).json({ message: "Mode must be brainstorm or plan" });
      }
      const messages = await storage.getChatMessages(projectId, mode);
      res.json({ messages: messages.map(m => ({ role: m.role, content: m.content })) });
    } catch (error: any) {
      console.error("Failed to load chat history:", error);
      res.status(500).json({ message: "Failed to load chat history" });
    }
  });

  app.delete("/api/ai/chat-history/:projectId/:mode", requireAuth, async (req, res) => {
    try {
      const { projectId, mode } = req.params;
      if (!["brainstorm", "plan"].includes(mode)) {
        return res.status(400).json({ message: "Mode must be brainstorm or plan" });
      }
      await storage.clearChatMessages(projectId, mode);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to clear chat history:", error);
      res.status(500).json({ message: "Failed to clear chat history" });
    }
  });

  // Spark — random creative prompt
  app.post("/api/ai/spark", requireAuth, async (req, res) => {
    try {
      const sparkPrompts = [
        "What if you built this for a completely different audience than intended?",
        "Imagine this project exists 10 years from now. What would it look like?",
        "What is the simplest possible version of this that still delivers value?",
        "What if you had to build this without any external libraries or frameworks?",
        "How would a game designer approach this problem differently?",
        "What if the main constraint was speed of development, not feature completeness?",
        "What part of this project excites you the most? Let's start there and build outward.",
        "What would a user complain about first if they tried this today?",
        "If you could only ship one feature, which one changes everything?",
        "What is the opposite of what everyone expects this project to do?",
        "What would make this project go viral? Think about the 'wow' factor.",
        "How would you explain this project to a 10-year-old?",
        "What if you combined this idea with something completely unrelated?",
        "What's the most unconventional technology you could use to solve this?",
        "If your project had a superpower, what would it be?",
      ];
      const spark = sparkPrompts[Math.floor(Math.random() * sparkPrompts.length)];
      res.json({ spark });
    } catch (error: any) {
      console.error("Spark failed:", error);
      res.status(500).json({ message: "Spark failed" });
    }
  });

  app.post("/api/ai/modify-plan", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const { projectId, instruction } = req.body;
      if (!projectId || !instruction?.trim()) {
        return res.status(400).json({ message: "projectId and instruction are required" });
      }

      const project = await storage.getProjectById(projectId);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const latestVersion = await storage.getLatestPlanVersion(projectId);
      if (!latestVersion) {
        return res.status(400).json({ message: "No plan exists to modify" });
      }

      const currentContent = latestVersion.contentJson as any;

      const { modifyPlan } = await import("./services/aiService");
      const modifiedContent = await modifyPlan(currentContent, instruction.trim(), project.idea);

      if (latestVersion.status === "draft") {
        const updated = await storage.updatePlanVersionContent(latestVersion.id, modifiedContent);
        return res.json({ planVersion: updated, action: "updated_draft" });
      }

      const existingVersions = await storage.getPlanVersionsByProject(projectId);
      const nextVersion = Math.max(...existingVersions.map(v => v.versionNumber)) + 1;

      const newVersion = await storage.createPlanVersion({
        projectId,
        versionNumber: nextVersion,
        contentJson: modifiedContent,
        status: "draft",
      });

      if (project.status === "active" || project.status === "approved") {
        await storage.updateProjectStatus(projectId, "planning");
      }

      res.json({ planVersion: newVersion, action: "created_new_version" });
    } catch (error: any) {
      console.error("Failed to modify plan:", error);
      res.status(500).json({ message: "Failed to modify plan" });
    }
  });

  app.post("/api/ai/summarize", requireAuth, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text?.trim()) {
        return res.status(400).json({ message: "Text is required" });
      }
      const summary = await summarizeLog(text.trim());
      res.json({ summary });
    } catch (error: any) {
      console.error("Summarization failed:", error);
      res.status(500).json({ message: "Summarization failed" });
    }
  });

  app.post("/api/weekly-logs", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const { projectId, weekNumber, subtaskIndex, dayNumber, logText, commitRef } = req.body;
      if (!projectId || weekNumber === undefined || !logText?.trim()) {
        return res.status(400).json({ message: "projectId, weekNumber, and logText are required" });
      }

      const project = await storage.getProjectById(projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (project.status !== "active") {
        return res.status(400).json({ message: "Project must be in active (execution) mode to add logs" });
      }

      const log = await storage.createWeeklyLog({
        projectId,
        weekNumber: Number(weekNumber),
        subtaskIndex: subtaskIndex !== undefined ? Number(subtaskIndex) : null,
        dayNumber: dayNumber !== undefined ? Number(dayNumber) : null,
        logText: logText.trim(),
        commitRef: commitRef?.trim() || null,
      });

      res.status(201).json(log);
    } catch (error: any) {
      console.error("Failed to create log:", error);
      res.status(500).json({ message: "Failed to create log" });
    }
  });

  app.get("/api/weekly-logs/project/:projectId", requireAuth, async (req, res) => {
    try {
      const logs = await storage.getWeeklyLogsByProject(req.params.projectId as string);
      res.json(logs);
    } catch (error: any) {
      console.error("Failed to get logs:", error);
      res.status(500).json({ message: "Failed to get logs" });
    }
  });

  app.put("/api/weekly-logs/:id", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const { logText } = req.body;
      if (!logText?.trim()) {
        return res.status(400).json({ message: "logText is required" });
      }
      const log = await storage.getWeeklyLogById(req.params.id as string);
      if (!log) return res.status(404).json({ message: "Log not found" });

      const project = await storage.getProjectById(log.projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const updated = await storage.updateWeeklyLog(req.params.id as string, logText.trim());
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update log:", error);
      res.status(500).json({ message: "Failed to update log" });
    }
  });

  app.post("/api/log-comments", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { logId, content } = req.body;
      if (!logId || !content?.trim()) {
        return res.status(400).json({ message: "logId and content are required" });
      }

      const log = await storage.getWeeklyLogById(logId);
      if (!log) return res.status(404).json({ message: "Log not found" });

      const project = await storage.getProjectById(log.projectId);
      if (!project || project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const comment = await storage.createLogComment({
        logId,
        managerId: (req as any).userId,
        content: content.trim(),
      });

      const manager = await storage.getUser((req as any).userId);
      await storage.createNotification({
        userId: project.internId,
        title: "New Comment on Log",
        message: `${manager?.name || "Your manager"} commented on your log entry: "${content.trim().substring(0, 80)}"`,
        read: false,
        link: "/?projectId=" + project.id,
      });

      const logIntern = await storage.getUser(project.internId);
      if (logIntern) {
        sendCommentEmail(logIntern.email, manager?.name || "Your manager", project.title, content.trim().substring(0, 200), "log").catch(() => {});
      }

      res.status(201).json(comment);
    } catch (error: any) {
      console.error("Failed to add comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });

  app.get("/api/log-comments/project/:projectId", requireAuth, async (req, res) => {
    try {
      const comments = await storage.getLogCommentsByProject(req.params.projectId as string);
      const enriched = await Promise.all(comments.map(async (c) => {
        const manager = await storage.getUser(c.managerId);
        return { ...c, managerName: manager?.name || "Manager" };
      }));
      res.json(enriched);
    } catch (error: any) {
      console.error("Failed to get comments:", error);
      res.status(500).json({ message: "Failed to get comments" });
    }
  });

  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifs = await storage.getNotificationsByUser((req as any).userId);
      res.json(notifs);
    } catch (error: any) {
      console.error("Failed to get notifications:", error);
      res.status(500).json({ message: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const count = await storage.getUnreadNotificationCount((req as any).userId);
      res.json({ count });
    } catch (error: any) {
      console.error("Failed to get unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  app.put("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      await storage.markAllNotificationsRead((req as any).userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error: any) {
      console.error("Failed to mark all read:", error);
      res.status(500).json({ message: "Failed to mark all read" });
    }
  });

  app.put("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const updated = await storage.markNotificationRead(req.params.id as string);
      if (!updated) return res.status(404).json({ message: "Notification not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to mark read:", error);
      res.status(500).json({ message: "Failed to mark read" });
    }
  });

  // --- Tasks ---
  // Generic assigned work item, distinct from the AI-planned project/log
  // flow above. Status transitions are exposed as dedicated action
  // endpoints (start/submit/block/approve/etc.) rather than a raw PATCH,
  // so each transition can carry its own validation and notification.

  async function notifyAdmins(companyId: string, title: string, message: string, link?: string): Promise<void> {
    const companyUsers = await storage.getUsersByCompany(companyId);
    const admins = companyUsers.filter(u => u.role === "admin");
    for (const admin of admins) {
      await storage.createNotification({ userId: admin.id, title, message, read: false, link: link || null });
    }
  }

  app.post("/api/tasks", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ message: "Admin must belong to a company" });

      const { title, description, assigneeId, projectId, priority, dueDate, skillTags } = req.body;
      if (!title?.trim() || !assigneeId) {
        return res.status(400).json({ message: "Title and assignee are required" });
      }

      const assignee = await storage.getUser(assigneeId);
      if (!assignee || assignee.companyId !== companyId) {
        return res.status(400).json({ message: "Invalid assignee" });
      }

      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (!project || project.companyId !== companyId) {
          return res.status(400).json({ message: "Invalid project" });
        }
      }

      if (priority && !["low", "medium", "high"].includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }

      const task = await storage.createTask({
        companyId,
        title: title.trim(),
        description: description?.trim() || null,
        assigneeId,
        createdByUserId: (req as any).userId,
        projectId: projectId || null,
        priority: priority || "medium",
        status: "todo",
        dueDate: dueDate ? new Date(dueDate) : null,
        skillTags: Array.isArray(skillTags)
          ? skillTags.map(normalizeSkillTag).filter(Boolean).slice(0, 10)
          : [],
      } as any);

      await storage.createNotification({
        userId: assigneeId,
        title: "New Task Assigned",
        message: `You've been assigned a new task: "${task.title}"`,
        read: false,
        link: "/?view=tasks&taskId=" + task.id,
      });

      await logAudit({
        actorUserId: (req as any).userId,
        companyId,
        action: "task.created",
        targetType: "task",
        targetId: task.id,
      });

      res.status(201).json(task);
    } catch (error: any) {
      console.error("Failed to create task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.get("/api/tasks", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      let taskList = await storage.getTasksByCompany(companyId);

      const { assigneeId, projectId, status, priority } = req.query;
      if (assigneeId) taskList = taskList.filter(t => t.assigneeId === assigneeId);
      if (projectId) taskList = taskList.filter(t => t.projectId === projectId);
      if (status) taskList = taskList.filter(t => t.status === status);
      if (priority) taskList = taskList.filter(t => t.priority === priority);

      res.json(taskList);
    } catch (error: any) {
      console.error("Failed to get tasks:", error);
      res.status(500).json({ message: "Failed to get tasks" });
    }
  });

  app.get("/api/tasks/mine", requireAuth, async (req, res) => {
    try {
      const taskList = await storage.getTasksByAssignee((req as any).userId);
      res.json(taskList);
    } catch (error: any) {
      console.error("Failed to get tasks:", error);
      res.status(500).json({ message: "Failed to get tasks" });
    }
  });

  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Task not found" });
      }
      const role = (req as any).userRole;
      if (role !== "admin" && task.assigneeId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      res.json(task);
    } catch (error: any) {
      console.error("Failed to get task:", error);
      res.status(500).json({ message: "Failed to get task" });
    }
  });

  app.put("/api/tasks/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Task not found" });
      }

      const { title, description, assigneeId, projectId, priority, dueDate, skillTags } = req.body;

      if (assigneeId) {
        const assignee = await storage.getUser(assigneeId);
        if (!assignee || assignee.companyId !== task.companyId) {
          return res.status(400).json({ message: "Invalid assignee" });
        }
      }
      if (projectId) {
        const project = await storage.getProjectById(projectId);
        if (!project || project.companyId !== task.companyId) {
          return res.status(400).json({ message: "Invalid project" });
        }
      }
      if (priority && !["low", "medium", "high"].includes(priority)) {
        return res.status(400).json({ message: "Invalid priority" });
      }

      const updated = await storage.updateTaskDetails(task.id, {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(assigneeId !== undefined ? { assigneeId } : {}),
        ...(projectId !== undefined ? { projectId: projectId || null } : {}),
        ...(priority !== undefined ? { priority } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(Array.isArray(skillTags) ? { skillTags: skillTags.map(normalizeSkillTag).filter(Boolean).slice(0, 10) } : {}),
      });

      if (assigneeId && assigneeId !== task.assigneeId) {
        await storage.createNotification({
          userId: assigneeId,
          title: "Task Reassigned To You",
          message: `You've been assigned the task: "${updated?.title}"`,
          read: false,
          link: "/?view=tasks&taskId=" + task.id,
        });
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Task not found" });
      }
      await storage.deleteTask(task.id);
      res.json({ message: "Task deleted" });
    } catch (error: any) {
      console.error("Failed to delete task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  app.post("/api/tasks/:id/start", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId || task.assigneeId !== (req as any).userId) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.status !== "todo") {
        return res.status(400).json({ message: "Only a To Do task can be started" });
      }
      const updated = await storage.updateTaskStatus(task.id, "in_progress");
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to start task:", error);
      res.status(500).json({ message: "Failed to start task" });
    }
  });

  app.post("/api/tasks/:id/submit", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId || task.assigneeId !== (req as any).userId) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.status !== "in_progress" && task.status !== "blocked") {
        return res.status(400).json({ message: "Only an in-progress or blocked task can be submitted" });
      }
      const { submission } = req.body;
      if (!submission?.trim()) {
        return res.status(400).json({ message: "Submission text is required" });
      }
      const updated = await storage.updateTaskStatus(task.id, "in_review", {
        submission: submission.trim(),
        submittedAt: new Date(),
        blockedReason: null,
      });

      await notifyAdmins(task.companyId, "Task Submitted for Review", `A task was submitted for review: "${task.title}"`, "/?view=tasks&taskId=" + task.id);

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to submit task:", error);
      res.status(500).json({ message: "Failed to submit task" });
    }
  });

  app.post("/api/tasks/:id/block", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId || task.assigneeId !== (req as any).userId) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.status !== "todo" && task.status !== "in_progress") {
        return res.status(400).json({ message: "Only a To Do or in-progress task can be marked blocked" });
      }
      const { reason } = req.body;
      if (!reason?.trim()) {
        return res.status(400).json({ message: "A reason is required to mark a task blocked" });
      }
      const updated = await storage.updateTaskStatus(task.id, "blocked", { blockedReason: reason.trim() });

      await notifyAdmins(task.companyId, "Task Blocked", `"${task.title}" is blocked: ${reason.trim()}`, "/?view=tasks&taskId=" + task.id);

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to mark task blocked:", error);
      res.status(500).json({ message: "Failed to mark task blocked" });
    }
  });

  app.post("/api/tasks/:id/unblock", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId || task.assigneeId !== (req as any).userId) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.status !== "blocked") {
        return res.status(400).json({ message: "Only a blocked task can be unblocked" });
      }
      const updated = await storage.updateTaskStatus(task.id, "in_progress", { blockedReason: null });
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to unblock task:", error);
      res.status(500).json({ message: "Failed to unblock task" });
    }
  });

  app.post("/api/tasks/:id/approve", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.status !== "in_review") {
        return res.status(400).json({ message: "Only a task in review can be approved" });
      }
      const { feedback } = req.body;
      const updated = await storage.updateTaskStatus(task.id, "completed", {
        completedAt: new Date(),
        ...(feedback?.trim() ? { feedback: feedback.trim() } : {}),
      });

      await storage.createNotification({
        userId: task.assigneeId,
        title: "Task Approved",
        message: `Your task "${task.title}" was approved.`,
        read: false,
        link: "/?view=tasks&taskId=" + task.id,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to approve task:", error);
      res.status(500).json({ message: "Failed to approve task" });
    }
  });

  app.post("/api/tasks/:id/request-changes", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const task = await storage.getTaskById(req.params.id as string);
      if (!task || task.companyId !== (req as any).companyId) {
        return res.status(404).json({ message: "Task not found" });
      }
      if (task.status !== "in_review") {
        return res.status(400).json({ message: "Only a task in review can have changes requested" });
      }
      const { feedback } = req.body;
      if (!feedback?.trim()) {
        return res.status(400).json({ message: "Feedback explaining the requested changes is required" });
      }
      const updated = await storage.updateTaskStatus(task.id, "in_progress", { feedback: feedback.trim() });

      await storage.createNotification({
        userId: task.assigneeId,
        title: "Changes Requested on Task",
        message: `Changes were requested on "${task.title}".`,
        read: false,
        link: "/?view=tasks&taskId=" + task.id,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to request changes:", error);
      res.status(500).json({ message: "Failed to request changes" });
    }
  });

  app.get("/api/risk-radar", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const interns = await storage.getInternsByCompany(companyId);
      const tasks = await storage.getTasksByCompany(companyId);
      res.json(computeRiskFlags(interns, tasks));
    } catch (error: any) {
      console.error("Failed to compute risk radar:", error);
      res.status(500).json({ message: "Failed to compute risk radar" });
    }
  });

  app.post("/api/ai/org-assistant", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ message: "Admin must belong to a company" });

      const { messages } = req.body;
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ message: "messages is required" });
      }

      const company = await storage.getCompanyById(companyId);
      const interns = await storage.getInternsByCompany(companyId);
      const allTasks = await storage.getTasksByCompany(companyId);
      const now = Date.now();
      const internNameById = new Map(interns.map((i) => [i.id, i.name]));

      const toDigestTask = (t: typeof allTasks[number]) => ({
        title: t.title,
        internName: internNameById.get(t.assigneeId) || "Unknown",
        status: t.status,
        priority: t.priority,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString() : null,
        blockedReason: t.blockedReason,
      });

      const digest: OrgDigest = {
        companyName: company?.name || "the organization",
        interns: interns.map((i) => {
          const mine = allTasks.filter((t) => t.assigneeId === i.id);
          return {
            name: i.name,
            totalTasks: mine.length,
            completedTasks: mine.filter((t) => t.status === "completed").length,
            blockedTasks: mine.filter((t) => t.status === "blocked").length,
            overdueTasks: mine.filter((t) => t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now).length,
          };
        }),
        blockedTasks: allTasks.filter((t) => t.status === "blocked").map(toDigestTask),
        overdueTasks: allTasks.filter((t) => t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now).map(toDigestTask),
        inReviewTasks: allTasks.filter((t) => t.status === "in_review").map(toDigestTask),
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter((t) => t.status === "completed").length,
      };

      const { reply, aiGenerated } = await orgAssistantChat(digest, messages);
      res.json({ reply, aiGenerated });
    } catch (error: any) {
      console.error("Assistant request failed:", error);
      res.status(500).json({ message: "Assistant request failed" });
    }
  });

  app.get("/api/dashboard", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json({ interns: [], company: null });

      const company = await storage.getCompanyById(companyId);
      const interns = await storage.getInternsByCompany(companyId);
      const allProjects = await storage.getProjectsByCompany(companyId);
      // This is the main dashboard endpoint, hit on every page load — two
      // bulk queries here instead of two queries per project (previously
      // getPlanVersionsByProject + getWeeklyLogsByProject inside the loop).
      const projectIds = allProjects.map(p => p.id);
      const allVersions = await storage.getPlanVersionsByProjectIds(projectIds);
      const allLogs = await storage.getWeeklyLogsByProjectIds(projectIds);

      const internSummaries = interns.map((intern) => {
        const internProjects = allProjects.filter(p => p.internId === intern.id);

        const projectDetails = internProjects.map((project) => {
          const versions = allVersions.filter(v => v.projectId === project.id);
          const logs = allLogs.filter(l => l.projectId === project.id);
          return { ...project, versions, weeklyLogs: logs };
        });

        return {
          id: intern.id,
          name: intern.name,
          email: intern.email,
          deactivatedAt: intern.deactivatedAt,
          completionBadgeAwardedAt: intern.completionBadgeAwardedAt,
          projects: projectDetails,
        };
      });

      res.json({
        company: { id: company?.id, name: company?.name, slug: company?.slug, acceptingApplications: company?.acceptingApplications },
        interns: internSummaries,
        totalProjects: allProjects.length,
        activeProjects: allProjects.filter(p => p.status === "active").length,
        pendingReview: allProjects.filter(p => p.status === "submitted").length,
      });
    } catch (error: any) {
      console.error("Failed to load dashboard:", error);
      res.status(500).json({ message: "Failed to load dashboard" });
    }
  });

  app.put("/api/projects/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { title, idea, minimumTotalHours } = req.body;
      if (!title && !idea && minimumTotalHours === undefined) {
        return res.status(400).json({ message: "At least one field (title, idea, minimumTotalHours) is required" });
      }
      if (minimumTotalHours !== undefined && Number(minimumTotalHours) <= 0) {
        return res.status(400).json({ message: "Minimum total hours must be greater than 0" });
      }

      const updated = await storage.updateProject(req.params.id as string, {
        title: title?.trim(),
        idea: idea?.trim(),
        minimumTotalHours: minimumTotalHours ? Number(minimumTotalHours) : undefined,
      });

      await storage.createNotification({
        userId: project.internId,
        title: "Project Updated",
        message: `Your project "${updated?.title || project.title}" has been updated by your manager.`,
        read: false,
        link: "/?projectId=" + project.id,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update project:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  app.delete("/api/projects/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      await storage.createNotification({
        userId: project.internId,
        title: "Project Removed",
        message: `The project "${project.title}" has been removed by your manager.`,
        read: false,
      });

      await storage.deleteProject(req.params.id as string);
      res.json({ message: "Project deleted" });
    } catch (error: any) {
      console.error("Failed to delete project:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  app.delete("/api/projects/intern/:internId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      const internId = req.params.internId as string;
      const intern = await storage.getUser(internId);
      if (!intern || intern.companyId !== companyId || intern.role !== "intern") {
        return res.status(403).json({ message: "Access denied" });
      }
      const count = await storage.deleteProjectsByIntern(internId, companyId);
      await storage.createNotification({
        userId: internId,
        title: "All Projects Removed",
        message: `Your manager has removed all ${count} project(s) from your account.`,
        read: false,
      });
      res.json({ message: `Deleted ${count} project(s)`, count });
    } catch (error: any) {
      console.error("Failed to delete projects:", error);
      res.status(500).json({ message: "Failed to delete projects" });
    }
  });

  app.delete("/api/plan-versions/project/:projectId", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const projectId = req.params.projectId as string;
      const project = await storage.getProjectById(projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      await storage.deletePlanVersionsByProject(projectId);
      await storage.updateProjectStatus(projectId, "assigned");
      res.json({ message: "Plan deleted. You can start fresh." });
    } catch (error: any) {
      console.error("Failed to reset plan:", error);
      res.status(500).json({ message: "Failed to reset plan" });
    }
  });

  app.post("/api/ai/action", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const { projectId, action, instruction } = req.body;
      if (!projectId || !action) {
        return res.status(400).json({ message: "projectId and action are required" });
      }

      const project = await storage.getProjectById(projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (action === "modify_plan") {
        if (!instruction?.trim()) {
          return res.status(400).json({ message: "Instruction is required for plan modification" });
        }
        const latestVersion = await storage.getLatestPlanVersion(projectId);
        if (!latestVersion) {
          return res.status(400).json({ message: "No plan exists to modify" });
        }
        const currentContent = latestVersion.contentJson as any;
        const modifiedContent = await modifyPlan(currentContent, instruction.trim(), project.idea);

        if (latestVersion.status === "draft") {
          const updated = await storage.updatePlanVersionContent(latestVersion.id, modifiedContent);
          return res.json({ success: true, action: "updated_draft", planVersion: updated });
        }
        const existingVersions = await storage.getPlanVersionsByProject(projectId);
        const nextVersion = Math.max(...existingVersions.map(v => v.versionNumber)) + 1;
        const newVersion = await storage.createPlanVersion({
          projectId,
          versionNumber: nextVersion,
          contentJson: modifiedContent,
          status: "draft",
        });
        if (project.status === "active" || project.status === "approved") {
          await storage.updateProjectStatus(projectId, "planning");
        }
        return res.json({ success: true, action: "created_new_version", planVersion: newVersion });
      }

      if (action === "delete_plan") {
        await storage.deletePlanVersionsByProject(projectId);
        await storage.updateProjectStatus(projectId, "assigned");
        return res.json({ success: true, action: "plan_deleted" });
      }

      if (action === "generate_plan") {
        const { hoursPerDay = 4, daysPerWeek = 5, numberOfWeeks = 8 } = req.body;
        const totalHours = hoursPerDay * daysPerWeek * numberOfWeeks;
        if (project.minimumTotalHours && totalHours < project.minimumTotalHours) {
          return res.status(400).json({ message: `Total hours (${totalHours}) must be at least ${project.minimumTotalHours}` });
        }
        const plan = await generatePlan(project.idea, totalHours, numberOfWeeks);
        const existingVersions = await storage.getPlanVersionsByProject(projectId);
        const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.versionNumber)) + 1 : 1;
        const planVersion = await storage.createPlanVersion({
          projectId,
          versionNumber: nextVersion,
          contentJson: {
            hoursPerDay,
            daysPerWeek,
            numberOfWeeks,
            totalPlannedHours: totalHours,
            weeks: plan.weeks,
          },
          status: "draft",
        });
        if (project.status === "assigned") {
          await storage.updateProjectStatus(projectId, "planning");
        }
        return res.json({ success: true, action: "plan_generated", planVersion });
      }

      res.status(400).json({ message: `Unknown action: ${action}` });
    } catch (error: any) {
      console.error("Action failed:", error);
      res.status(500).json({ message: "Action failed" });
    }
  });

  // GitHub Integration endpoints
  app.put("/api/projects/:id/github", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
      }

      const { githubRepoUrl } = req.body;
      if (githubRepoUrl) {
        const { parseGithubUrl, validateRepo } = await import("./services/githubService");
        const parsed = parseGithubUrl(githubRepoUrl);
        if (!parsed) {
          return res.status(400).json({ message: "Invalid GitHub URL. Use format: https://github.com/owner/repo" });
        }

        const token = await storage.getCompanyGithubToken((req as any).companyId);
        if (token) {
          const valid = await validateRepo(token, parsed.owner, parsed.repo);
          if (!valid) {
            return res.status(400).json({ message: "Cannot access repository. Check URL and token permissions." });
          }
        }
      }

      const updated = await storage.updateProjectGithubUrl(req.params.id as string, githubRepoUrl || null);
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to update GitHub URL:", error);
      res.status(500).json({ message: "Failed to update GitHub URL" });
    }
  });

  app.put("/api/company/github-token", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ message: "No company" });

      const { githubToken } = req.body;
      await storage.updateCompanyGithubToken(companyId, githubToken || null);
      res.json({ message: githubToken ? "GitHub token saved" : "GitHub token removed" });
    } catch (error: any) {
      console.error("Failed to update GitHub token:", error);
      res.status(500).json({ message: "Failed to update GitHub token" });
    }
  });

  app.get("/api/projects/:id/github/commits", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!project.githubRepoUrl) return res.json([]);

      const { parseGithubUrl, getRecentCommits } = await import("./services/githubService");
      const parsed = parseGithubUrl(project.githubRepoUrl);
      if (!parsed) return res.json([]);

      const token = await storage.getCompanyGithubToken(project.companyId);
      if (!token) return res.status(400).json({ message: "No GitHub token configured for this company" });

      const commits = await getRecentCommits(token, parsed.owner, parsed.repo);
      res.json(commits);
    } catch (error: any) {
      console.error("Failed to fetch commits:", error);
      res.status(500).json({ message: "Failed to fetch commits" });
    }
  });

  app.get("/api/projects/:id/github/pulls", requireAuth, async (req, res) => {
    try {
      const project = await storage.getProjectById(req.params.id as string);
      if (!project) return res.status(404).json({ message: "Project not found" });
      if (!project.githubRepoUrl) return res.json([]);

      const { parseGithubUrl, getRecentPullRequests } = await import("./services/githubService");
      const parsed = parseGithubUrl(project.githubRepoUrl);
      if (!parsed) return res.json([]);

      const token = await storage.getCompanyGithubToken(project.companyId);
      if (!token) return res.status(400).json({ message: "No GitHub token configured for this company" });

      const pulls = await getRecentPullRequests(token, parsed.owner, parsed.repo);
      res.json(pulls);
    } catch (error: any) {
      console.error("Failed to fetch pull requests:", error);
      res.status(500).json({ message: "Failed to fetch pull requests" });
    }
  });

  // Modify weekly-logs POST to accept commitRef
  // (already handled by existing schema — commitRef is nullable)

  // Analytics endpoints
  app.get("/api/analytics/admin", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json({});

      const statusCounts = await storage.getProjectStatusCounts(companyId);
      const allLogs = await storage.getWeeklyLogsByCompany(companyId);
      const logActivity = await storage.getLogActivityByCompany(companyId);
      const interns = await storage.getInternsByCompany(companyId);
      const allProjects = await storage.getProjectsByCompany(companyId);
      // One query for the latest plan version of every project, instead of
      // one query per project per metric below (previously up to 2x N
      // queries for N projects across completionRates + hoursComparison).
      const latestVersions = await storage.getLatestPlanVersionsByProjectIds(allProjects.map(p => p.id));

      // Completion rates per intern
      const completionRates = interns.map((intern) => {
        const internProjects = allProjects.filter(p => p.internId === intern.id);
        let totalSubtasks = 0;
        let completedSubtasks = 0;
        for (const project of internProjects) {
          const latestVersion = latestVersions.get(project.id);
          const weeks: any[] = (latestVersion?.contentJson as any)?.weeks || [];
          const projectLogs = allLogs.filter((l: any) => l.projectId === project.id);
          const subtasksWithLogs = new Set<string>();
          projectLogs.forEach((l: any) => {
            if (l.subtaskIndex !== null && l.subtaskIndex !== undefined) {
              subtasksWithLogs.add(`${l.weekNumber}-${l.subtaskIndex}`);
            }
          });
          weeks.forEach((w: any) => {
            const deliverables = w.deliverables || [];
            totalSubtasks += deliverables.length;
            deliverables.forEach((_: any, idx: number) => {
              if (subtasksWithLogs.has(`${w.weekNumber}-${idx}`)) completedSubtasks++;
            });
          });
        }
        return {
          internName: intern.name.split(" ")[0],
          completionRate: totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0,
        };
      });

      // Hours comparison per intern
      const hoursComparison = interns.map((intern) => {
        const internProjects = allProjects.filter(p => p.internId === intern.id);
        let totalPlanned = 0;
        let totalLogged = 0;
        for (const project of internProjects) {
          const latestVersion = latestVersions.get(project.id);
          totalPlanned += (latestVersion?.contentJson as any)?.totalPlannedHours || 0;
          totalLogged += allLogs.filter((l: any) => l.projectId === project.id).length;
        }
        return {
          internName: intern.name.split(" ")[0],
          planned: totalPlanned,
          logged: totalLogged,
        };
      });

      // Task status breakdown + per-intern task completion, from the real
      // Task table (separate from the AI-planned project/log data above).
      const allTasks = await storage.getTasksByCompany(companyId);
      const taskStatusCounts = ["todo", "in_progress", "in_review", "completed", "blocked"].map((status) => ({
        status,
        count: allTasks.filter((t) => t.status === status).length,
      })).filter((s) => s.count > 0);

      const taskCompletionByIntern = interns.map((intern) => {
        const internTasks = allTasks.filter((t) => t.assigneeId === intern.id);
        return {
          internName: intern.name.split(" ")[0],
          completed: internTasks.filter((t) => t.status === "completed").length,
          total: internTasks.length,
        };
      }).filter((t) => t.total > 0);

      res.json({
        statusCounts,
        completionRates,
        logActivity,
        hoursComparison,
        taskStatusCounts,
        taskCompletionByIntern,
      });
    } catch (error: any) {
      console.error("Failed to load analytics:", error);
      res.status(500).json({ message: "Failed to load analytics" });
    }
  });

  app.get("/api/analytics/intern", requireAuth, requireRole("intern"), async (req, res) => {
    try {
      const userId = (req as any).userId;
      const internProjects = await storage.getProjectsByIntern(userId);
      const projectIds = internProjects.map(p => p.id);
      // Two bulk queries instead of two queries per project (previously
      // getLatestPlanVersion + getWeeklyLogsByProject inside the loop below).
      const latestVersions = await storage.getLatestPlanVersionsByProjectIds(projectIds);
      const allLogs = await storage.getWeeklyLogsByProjectIds(projectIds);

      // Personal progress per week across all projects
      const progressByWeek: { week: number; completed: number; total: number }[] = [];
      const activityByWeek: { week: number; logs: number }[] = [];

      for (const project of internProjects) {
        const latestVersion = latestVersions.get(project.id);
        const weeks: any[] = (latestVersion?.contentJson as any)?.weeks || [];
        const projectLogs = allLogs.filter((l: any) => l.projectId === project.id);

        const subtasksWithLogs = new Set<string>();
        projectLogs.forEach((l: any) => {
          if (l.subtaskIndex !== null && l.subtaskIndex !== undefined) {
            subtasksWithLogs.add(`${l.weekNumber}-${l.subtaskIndex}`);
          }
        });

        weeks.forEach((w: any) => {
          const deliverables = w.deliverables || [];
          const weekNum = w.weekNumber;
          let existing = progressByWeek.find(p => p.week === weekNum);
          if (!existing) {
            existing = { week: weekNum, completed: 0, total: 0 };
            progressByWeek.push(existing);
          }
          existing.total += deliverables.length;
          deliverables.forEach((_: any, idx: number) => {
            if (subtasksWithLogs.has(`${weekNum}-${idx}`)) existing!.completed++;
          });

          let actExisting = activityByWeek.find(a => a.week === weekNum);
          if (!actExisting) {
            actExisting = { week: weekNum, logs: 0 };
            activityByWeek.push(actExisting);
          }
        });

        projectLogs.forEach((l: any) => {
          let actExisting = activityByWeek.find(a => a.week === l.weekNumber);
          if (!actExisting) {
            actExisting = { week: l.weekNumber, logs: 0 };
            activityByWeek.push(actExisting);
          }
          actExisting.logs++;
        });
      }

      progressByWeek.sort((a, b) => a.week - b.week);
      activityByWeek.sort((a, b) => a.week - b.week);

      res.json({
        progressByWeek,
        activityByWeek,
      });
    } catch (error: any) {
      console.error("Failed to load analytics:", error);
      res.status(500).json({ message: "Failed to load analytics" });
    }
  });

  // Team Chat
  app.get("/api/team/messages", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "No company associated with your account" });
      }
      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await storage.getTeamMessages(user.companyId, limit);
      res.json(messages);
    } catch (error: any) {
      console.error("Failed to load team messages:", error);
      res.status(500).json({ message: "Failed to load team messages" });
    }
  });

  app.post("/api/team/messages", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser((req as any).userId);
      if (!user?.companyId) {
        return res.status(400).json({ message: "No company associated with your account" });
      }
      const { content } = req.body;
      if (!content?.trim()) {
        return res.status(400).json({ message: "Message content is required" });
      }
      const message = await storage.createTeamMessage({
        companyId: user.companyId,
        userId: user.id,
        content: content.trim(),
      });
      res.json(message);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // ==================== Channel API (Discord-like Chat) ====================

  // List channels for current user (grouped by type, with unread counts)
  app.get("/api/channels", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ message: "No company" });
      const allChannels = await storage.getChannelsByCompany(companyId, userId);
      res.json(allChannels);
    } catch (error: any) {
      console.error("Failed to list channels:", error);
      res.status(500).json({ message: "Failed to list channels" });
    }
  });

  // Create custom channel (admin only)
  app.post("/api/channels", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const { name, memberIds } = req.body;
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;
      if (!name?.trim()) return res.status(400).json({ message: "Channel name is required" });
      const channel = await storage.createChannel({
        companyId,
        type: "custom",
        name: name.trim(),
        createdById: userId,
      });
      // Add creator
      await storage.addChannelMember(channel.id, userId);
      // Add specified members
      if (Array.isArray(memberIds)) {
        for (const memberId of memberIds) {
          await storage.addChannelMember(channel.id, memberId);
        }
      }
      res.status(201).json(channel);
    } catch (error: any) {
      console.error("Failed to create channel:", error);
      res.status(500).json({ message: "Failed to create channel" });
    }
  });

  // Total unread count (for nav badge) — MUST be before :id routes
  app.get("/api/channels/unread", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;
      if (!companyId) return res.json({ count: 0 });
      const totalCount = await storage.getTotalUnreadCount(companyId, userId);
      res.json({ count: totalCount });
    } catch (error: any) {
      console.error("Failed to get unread count:", error);
      res.status(500).json({ message: "Failed to get unread count" });
    }
  });

  // Delete channel (admin, custom only)
  app.delete("/api/channels/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const channel = await storage.getChannelById(req.params.id);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      if (channel.type !== "custom") return res.status(400).json({ message: "Only custom channels can be deleted" });
      await storage.deleteChannel(channel.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to delete channel:", error);
      res.status(500).json({ message: "Failed to delete channel" });
    }
  });

  // Get messages for a channel
  app.get("/api/channels/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const isMember = await storage.isChannelMember(req.params.id, userId);
      if (!isMember) return res.status(403).json({ message: "Not a member of this channel" });
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getChannelMessages(req.params.id, limit);
      res.json(messages);
    } catch (error: any) {
      console.error("Failed to load messages:", error);
      res.status(500).json({ message: "Failed to load messages" });
    }
  });

  // Send message to a channel
  app.post("/api/channels/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const isMember = await storage.isChannelMember(req.params.id, userId);
      if (!isMember) return res.status(403).json({ message: "Not a member of this channel" });
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Message content is required" });
      const message = await storage.createChannelMessage({
        channelId: req.params.id,
        userId,
        content: content.trim(),
      });
      // Auto mark as read for sender
      await storage.updateLastReadAt(req.params.id, userId);
      res.status(201).json(message);
    } catch (error: any) {
      console.error("Failed to send message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // List channel members
  app.get("/api/channels/:id/members", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const isMember = await storage.isChannelMember(req.params.id, userId);
      if (!isMember) return res.status(403).json({ message: "Not a member of this channel" });
      const members = await storage.getChannelMembers(req.params.id);
      res.json(members);
    } catch (error: any) {
      console.error("Failed to load members:", error);
      res.status(500).json({ message: "Failed to load members" });
    }
  });

  // Add member to custom channel (admin only)
  app.post("/api/channels/:id/members", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const channel = await storage.getChannelById(req.params.id);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      if (channel.type !== "custom") return res.status(400).json({ message: "Can only manage members of custom channels" });
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const member = await storage.addChannelMember(channel.id, userId);
      res.status(201).json(member);
    } catch (error: any) {
      console.error("Failed to add member:", error);
      res.status(500).json({ message: "Failed to add member" });
    }
  });

  // Remove member from custom channel (admin only)
  app.delete("/api/channels/:id/members/:userId", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const channel = await storage.getChannelById(req.params.id);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      if (channel.type !== "custom") return res.status(400).json({ message: "Can only manage members of custom channels" });
      await storage.removeChannelMember(channel.id, req.params.userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to remove member:", error);
      res.status(500).json({ message: "Failed to remove member" });
    }
  });

  // Mark channel as read
  app.put("/api/channels/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      await storage.updateLastReadAt(req.params.id, userId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Failed to mark as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Get or create DM channel
  app.post("/api/channels/dm", requireAuth, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ message: "targetUserId is required" });
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser || targetUser.companyId !== companyId) {
        return res.status(400).json({ message: "Target user not found in your company" });
      }
      const currentUser = await storage.getUser(userId);
      const channel = await storage.getOrCreateDMChannel(
        companyId, userId, targetUserId,
        currentUser?.name || "User", targetUser.name
      );
      res.json(channel);
    } catch (error: any) {
      console.error("Failed to create DM:", error);
      res.status(500).json({ message: "Failed to create DM" });
    }
  });

  // List company users (for DM picker + member selector)
  app.get("/api/company/users", requireAuth, async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const allUsers = await storage.getUsersByCompany(companyId);
      res.json(allUsers.map(u => ({ id: u.id, name: u.name, role: u.role })));
    } catch (error: any) {
      console.error("Failed to list users:", error);
      res.status(500).json({ message: "Failed to list users" });
    }
  });

  // One-time migration: move teamMessages to channelMessages via general channels
  app.post("/api/admin/migrate-team-messages", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const userId = (req as any).userId;
      const companyId = (req as any).companyId;
      if (!companyId) return res.status(400).json({ message: "No company" });

      // Ensure general channel exists
      const generalChannel = await storage.ensureGeneralChannel(companyId);

      // Add all company users as members
      const companyUsers = await storage.getUsersByCompany(companyId);
      for (const u of companyUsers) {
        await storage.addChannelMember(generalChannel.id, u.id);
      }

      // Get all team messages for this company
      const teamMsgs = await storage.getTeamMessages(companyId, 10000);

      // Insert into channelMessages (oldest first)
      let migrated = 0;
      for (const msg of teamMsgs.reverse()) {
        await storage.createChannelMessage({
          channelId: generalChannel.id,
          userId: msg.userId,
          content: msg.content,
        });
        migrated++;
      }

      res.json({ message: `Migrated ${migrated} messages to #general channel`, migrated });
    } catch (error: any) {
      console.error("Migration failed:", error);
      res.status(500).json({ message: "Migration failed" });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Device management — every user manages their own list of devices/
  // sessions (the ones that have logged into their account). This is the
  // real, server-enforced mechanism behind "revoke a device": revoking
  // sets revokedAt, and requireAuth rejects that device's token on its
  // very next request regardless of the JWT's remaining natural expiry.
  app.get("/api/devices", requireAuth, async (req, res) => {
    try {
      const devices = await storage.getUserDevicesByUser((req as any).userId);
      const currentDeviceId = (req as any).deviceId;
      res.json(devices.map(d => ({ ...d, isCurrent: d.deviceId === currentDeviceId })));
    } catch (error: any) {
      console.error("Failed to get devices:", error);
      res.status(500).json({ message: "Failed to get devices" });
    }
  });

  app.put("/api/devices/:id", requireAuth, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ message: "Device name is required" });
      }
      const updated = await storage.renameUserDevice(req.params.id as string, (req as any).userId, name.trim());
      if (!updated) return res.status(404).json({ message: "Device not found" });
      res.json(updated);
    } catch (error: any) {
      console.error("Failed to rename device:", error);
      res.status(500).json({ message: "Failed to rename device" });
    }
  });

  app.delete("/api/devices/:id", requireAuth, async (req, res) => {
    try {
      const revoked = await storage.revokeUserDevice(req.params.id as string, (req as any).userId);
      if (!revoked) return res.status(404).json({ message: "Device not found" });
      await logAudit({
        actorUserId: (req as any).userId,
        companyId: (req as any).companyId,
        action: "device.revoked",
        targetType: "device",
        targetId: revoked.id,
        metadata: { deviceName: revoked.name },
      });
      res.json({ message: "Device access revoked" });
    } catch (error: any) {
      console.error("Failed to revoke device:", error);
      res.status(500).json({ message: "Failed to revoke device" });
    }
  });

  app.get("/api/audit-logs", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const logs = await storage.getAuditLogsByCompany(companyId);
      res.json(logs);
    } catch (error: any) {
      console.error("Failed to get audit logs:", error);
      res.status(500).json({ message: "Failed to get audit logs" });
    }
  });

  return httpServer;
}
