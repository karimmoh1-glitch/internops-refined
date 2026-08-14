import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generatePlan, aiChat, summarizeLog, modifyPlan } from "./services/aiService";
import {
  sendInviteEmail, sendPlanSubmittedEmail, sendPlanApprovedEmail,
  sendRevisionRequestedEmail, sendCommentEmail, sendNewInternJoinedEmail,
  sendManagerVerificationEmail, sendPasswordResetEmail,
} from "./services/emailService";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer, { type StorageEngine } from "multer";
import path from "path";
import fs from "fs";

declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const JWT_EXPIRY = "24h";
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

function signToken(userId: string, role: string, companyId: string | null): string {
  return jwt.sign({ userId, role, companyId }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string; companyId: string | null };
    (req as any).userId = decoded.userId;
    (req as any).userRole = decoded.role;
    (req as any).companyId = decoded.companyId;
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

  // Step 1: Manager registers with email + company name → gets verification email
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { companyName, email } = req.body;
      if (!companyName || !email) {
        return res.status(400).json({ message: "Company name and email are required" });
      }

      const existing = await storage.getUserByEmail(email.toLowerCase().trim());
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

      await storage.createSignupToken({
        email: email.toLowerCase().trim(),
        companyName: companyName.trim(),
        managerName: "",
        passwordHash: "",
        token,
        expiresAt,
        used: false,
      });

      const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : (process.env.APP_URL || 'http://localhost:3000');
      const verifyLink = `${baseUrl}/verify-signup/${token}`;
      console.log(`\n========================================`);
      console.log(`📧 SIGNUP VERIFICATION LINK`);
      console.log(`   Email: ${email.toLowerCase().trim()}`);
      console.log(`   Company: ${companyName.trim()}`);
      console.log(`   Link: ${verifyLink}`);
      console.log(`========================================\n`);
      sendManagerVerificationEmail(email.toLowerCase().trim(), verifyLink, companyName.trim()).catch(() => {});

      res.status(200).json({
        message: "Verification email sent! Check your inbox to complete registration.",
      });
    } catch (error: any) {
      console.error("Signup failed:", error);
      res.status(500).json({ message: "Signup failed" });
    }
  });

  // Step 2: Validate signup token
  app.get("/api/auth/verify-signup/:token", async (req, res) => {
    try {
      const signupToken = await storage.getSignupToken(req.params.token);
      if (!signupToken) return res.status(404).json({ message: "Invalid or expired signup link" });
      if (signupToken.used) return res.status(400).json({ message: "This signup link has already been used" });
      if (new Date() > signupToken.expiresAt) return res.status(400).json({ message: "This signup link has expired" });

      res.json({
        valid: true,
        email: signupToken.email,
        companyName: signupToken.companyName,
      });
    } catch (error: any) {
      console.error("Validation failed:", error);
      res.status(500).json({ message: "Validation failed" });
    }
  });

  // Step 3: Complete signup — set name + password, create company + user
  app.post("/api/auth/complete-signup/:token", async (req, res) => {
    try {
      const { name, password } = req.body;
      if (!name || !password) {
        return res.status(400).json({ message: "Name and password are required" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      const signupToken = await storage.getSignupToken(req.params.token);
      if (!signupToken) return res.status(404).json({ message: "Invalid or expired signup link" });
      if (signupToken.used) return res.status(400).json({ message: "This signup link has already been used" });
      if (new Date() > signupToken.expiresAt) return res.status(400).json({ message: "This signup link has expired" });

      const existing = await storage.getUserByEmail(signupToken.email);
      if (existing) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      const company = await storage.createCompany({ name: signupToken.companyName });
      const passwordHash = await bcrypt.hash(password, 10);

      const user = await storage.createUser({
        name: name.trim(),
        email: signupToken.email,
        passwordHash,
        role: "admin",
        companyId: company.id,
      });

      await storage.markSignupTokenUsed(req.params.token);

      // Create #general channel and add admin as first member
      const generalChannel = await storage.ensureGeneralChannel(company.id);
      await storage.addChannelMember(generalChannel.id, user.id);

      const jwtToken = signToken(user.id, user.role, user.companyId);
      res.status(201).json({
        token: jwtToken,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
      });
    } catch (error: any) {
      console.error("Signup completion failed:", error);
      res.status(500).json({ message: "Signup completion failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password, expectedRole } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email.toLowerCase().trim());
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (expectedRole === "admin" && user.role !== "admin") {
        return res.status(403).json({ message: "This login is for managers only. Please use the intern login page." });
      }
      if (expectedRole === "intern" && user.role !== "intern") {
        return res.status(403).json({ message: "This login is for interns only. Please use the manager login page." });
      }

      const token = signToken(user.id, user.role, user.companyId);
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
      res.json({ id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId });
    } catch (error: any) {
      console.error("Failed to get user:", error);
      res.status(500).json({ message: "Failed to get user" });
    }
  });

  // Forgot password: send reset email
  app.post("/api/auth/forgot-password", async (req, res) => {
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

      const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : (process.env.APP_URL || 'http://localhost:3000');
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
  app.post("/api/auth/reset-password/:token", async (req, res) => {
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

      const baseUrl = process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : (process.env.APP_URL || 'http://localhost:3000');
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

  app.post("/api/invitations/accept/:token", async (req, res) => {
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

      const token = signToken(user.id, user.role, user.companyId);
      res.status(201).json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, companyId: user.companyId },
      });
    } catch (error: any) {
      console.error("Failed to accept invitation:", error);
      res.status(500).json({ message: "Failed to accept invitation" });
    }
  });

  app.get("/api/interns", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json([]);
      const interns = await storage.getInternsByCompany(companyId);
      res.json(interns.map(i => ({ id: i.id, name: i.name, email: i.email, role: i.role, createdAt: i.createdAt })));
    } catch (error: any) {
      console.error("Failed to get interns:", error);
      res.status(500).json({ message: "Failed to get interns" });
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
      if (pv.status !== "draft") {
        return res.status(400).json({ message: "Only draft plans can be edited" });
      }

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
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
      if (pv.status !== "draft") {
        return res.status(400).json({ message: "Only draft plans can be submitted" });
      }

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.internId !== (req as any).userId) {
        return res.status(403).json({ message: "Access denied" });
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
      if (pv.status !== "submitted") {
        return res.status(400).json({ message: "Only submitted plans can be approved" });
      }

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
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
      if (pv.status !== "submitted") {
        return res.status(400).json({ message: "Only submitted plans can be sent back for revision" });
      }

      const project = await storage.getProjectById(pv.projectId);
      if (!project || project.companyId !== (req as any).companyId) {
        return res.status(403).json({ message: "Access denied" });
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

  app.get("/api/dashboard", requireAuth, requireRole("admin"), async (req, res) => {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) return res.json({ interns: [], company: null });

      const company = await storage.getCompanyById(companyId);
      const interns = await storage.getInternsByCompany(companyId);
      const allProjects = await storage.getProjectsByCompany(companyId);

      const internSummaries = await Promise.all(interns.map(async (intern) => {
        const internProjects = allProjects.filter(p => p.internId === intern.id);

        const projectDetails = await Promise.all(internProjects.map(async (project) => {
          const versions = await storage.getPlanVersionsByProject(project.id);
          const logs = await storage.getWeeklyLogsByProject(project.id);
          return { ...project, versions, weeklyLogs: logs };
        }));

        return {
          id: intern.id,
          name: intern.name,
          email: intern.email,
          projects: projectDetails,
        };
      }));

      res.json({
        company: { id: company?.id, name: company?.name },
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

      // Completion rates per intern
      const completionRates = await Promise.all(interns.map(async (intern) => {
        const internProjects = allProjects.filter(p => p.internId === intern.id);
        let totalSubtasks = 0;
        let completedSubtasks = 0;
        for (const project of internProjects) {
          const latestVersion = await storage.getLatestPlanVersion(project.id);
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
      }));

      // Hours comparison per intern
      const hoursComparison = await Promise.all(interns.map(async (intern) => {
        const internProjects = allProjects.filter(p => p.internId === intern.id);
        let totalPlanned = 0;
        let totalLogged = 0;
        for (const project of internProjects) {
          const latestVersion = await storage.getLatestPlanVersion(project.id);
          totalPlanned += (latestVersion?.contentJson as any)?.totalPlannedHours || 0;
          totalLogged += allLogs.filter((l: any) => l.projectId === project.id).length;
        }
        return {
          internName: intern.name.split(" ")[0],
          planned: totalPlanned,
          logged: totalLogged,
        };
      }));

      res.json({
        statusCounts,
        completionRates,
        logActivity,
        hoursComparison,
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

      // Personal progress per week across all projects
      const progressByWeek: { week: number; completed: number; total: number }[] = [];
      const activityByWeek: { week: number; logs: number }[] = [];

      for (const project of internProjects) {
        const latestVersion = await storage.getLatestPlanVersion(project.id);
        const weeks: any[] = (latestVersion?.contentJson as any)?.weeks || [];
        const projectLogs = await storage.getWeeklyLogsByProject(project.id);

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

  return httpServer;
}
