/**
 * Development-only demo data seed.
 *
 * Creates a realistic demo organization, manager, interns, projects, work
 * logs, feedback, and applications so the app can be reviewed with
 * populated screens instead of empty states. Refuses to run against a
 * production database.
 *
 * Usage: npm run db:seed
 */
import "dotenv/config";
import { db, pool } from "../server/db";
import { storage } from "../server/storage";
import bcrypt from "bcryptjs";

const DEMO_PASSWORD = "DemoPass123!";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed demo data into a production environment (NODE_ENV=production).");
  }

  console.log("Seeding demo data...\n");

  const existing = await storage.getUserByEmail("manager@edai.fun");
  if (existing) {
    console.log("Demo data already exists (manager@edai.fun found). Skipping.");
    console.log("To reseed from scratch, drop and recreate the database, then run `npm run db:push` again.");
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // --- Organization + manager ---
  // InternOps runs as a single fixed workspace for EDAI — every account
  // joins this same company, matching how signup now works (no company
  // creation step).
  let company = await storage.getCompanyBySlug("edai");
  if (!company) {
    company = await storage.createCompany({
      name: "EDAI",
      slug: "edai",
      acceptingApplications: true,
    });
  }
  console.log(`Company: ${company.name} (${company.slug})`);

  const manager = await storage.createUser({
    name: "EDAI Manager",
    email: "manager@edai.fun",
    passwordHash,
    role: "admin",
    companyId: company.id,
  });
  console.log(`Manager: ${manager.email}`);

  const generalChannel = await storage.ensureGeneralChannel(company.id);
  await storage.addChannelMember(generalChannel.id, manager.id);

  // --- Interns ---
  const internDefs = [
    { name: "Alex Johnson", email: "alex@internops.local" },
    { name: "Maya Patel", email: "maya@internops.local" },
    { name: "Jordan Lee", email: "jordan@internops.local" },
  ];
  const interns = [];
  for (const def of internDefs) {
    const intern = await storage.createUser({
      name: def.name,
      email: def.email,
      passwordHash,
      role: "intern",
      companyId: company.id,
    });
    await storage.addChannelMember(generalChannel.id, intern.id);
    interns.push(intern);
    console.log(`Intern: ${intern.email}`);
  }
  const [alex, maya, jordan] = interns;

  // --- Project 1: Alex, active with logged work + manager feedback ---
  const project1 = await storage.createProject({
    internId: alex.id,
    companyId: company.id,
    title: "InternOps Website Redesign",
    idea: "Refresh the marketing site's landing page copy and hero section, and add a pricing page.",
    minimumTotalHours: 40,
    status: "active",
  });
  await storage.createProjectChannel(project1);

  const plan1 = await storage.createPlanVersion({
    projectId: project1.id,
    versionNumber: 1,
    contentJson: {
      hoursPerDay: 4,
      daysPerWeek: 5,
      numberOfWeeks: 2,
      totalPlannedHours: 40,
      weeks: [
        {
          weekNumber: 1,
          milestone: "Landing page copy and hero redesign",
          deliverables: [
            "Audit current landing page copy and identify weak spots",
            "Draft new hero headline and supporting copy",
            "Implement redesigned hero section",
          ],
          successCriteria: "Hero section redesign is live on staging and reviewed by the team",
          hours: 20,
        },
        {
          weekNumber: 2,
          milestone: "Pricing page",
          deliverables: [
            "Design pricing page layout",
            "Write pricing tier copy",
            "Implement and deploy pricing page",
          ],
          successCriteria: "Pricing page is live and linked from the main nav",
          hours: 20,
        },
      ],
    },
    status: "approved",
  });
  await storage.createComment({
    versionId: plan1.id,
    managerId: manager.id,
    content: "This looks great — approved. Keep the hero copy punchy, we want it scannable in under 5 seconds.",
  });

  const log1a = await storage.createWeeklyLog({
    projectId: project1.id,
    weekNumber: 1,
    dayNumber: 1,
    subtaskIndex: 0,
    logText: "Went through the current landing page line by line. The hero copy buries the value prop under two sentences of throat-clearing before it gets to the point. Flagged 4 other sections with similar issues.",
    commitRef: null,
  });
  await storage.createWeeklyLog({
    projectId: project1.id,
    weekNumber: 1,
    dayNumber: 2,
    subtaskIndex: 1,
    logText: "Drafted 3 headline variants. Going with 'Run your internship program from one place' — tested it against the other two with a few teammates and it was the clear favorite for clarity.",
    commitRef: null,
  });
  const log1c = await storage.createWeeklyLog({
    projectId: project1.id,
    weekNumber: 1,
    dayNumber: 3,
    subtaskIndex: 2,
    logText: "Hero section is implemented and deployed to staging. Responsive at 375px through 1440px. Left the old version behind a feature flag in case we want to A/B test.",
    commitRef: "a3f8e21",
  });
  await storage.createLogComment({
    logId: log1c.id,
    managerId: manager.id,
    content: "Looks fantastic on staging. One note: the CTA button could use a bit more contrast on mobile. Otherwise ready to ship.",
  });
  await storage.createLogComment({
    logId: log1a.id,
    managerId: manager.id,
    content: "Good instinct catching this — this is exactly the kind of audit that should happen before any redesign work starts.",
  });

  // --- Project 2: Maya, plan submitted, awaiting manager review ---
  const project2 = await storage.createProject({
    internId: maya.id,
    companyId: company.id,
    title: "AI Research Summary Tool",
    idea: "Build a small internal tool that summarizes long research documents using the OpenAI API.",
    minimumTotalHours: 60,
    status: "submitted",
  });
  await storage.createProjectChannel(project2);

  await storage.createPlanVersion({
    projectId: project2.id,
    versionNumber: 1,
    contentJson: {
      hoursPerDay: 4,
      daysPerWeek: 5,
      numberOfWeeks: 3,
      totalPlannedHours: 60,
      weeks: [
        {
          weekNumber: 1,
          milestone: "Prototype summarization pipeline",
          deliverables: ["Set up OpenAI API integration", "Build a CLI prototype that summarizes a single document"],
          successCriteria: "CLI tool produces a usable summary from a sample PDF",
          hours: 20,
        },
        {
          weekNumber: 2,
          milestone: "Batch processing + web UI",
          deliverables: ["Support processing multiple documents", "Build a simple upload-and-view web interface"],
          successCriteria: "Team members can upload a document and get a summary without touching the CLI",
          hours: 20,
        },
        {
          weekNumber: 3,
          milestone: "Polish and internal rollout",
          deliverables: ["Add error handling for unsupported file types", "Write a short usage guide", "Demo to the team"],
          successCriteria: "Tool is usable by non-technical teammates",
          hours: 20,
        },
      ],
    },
    status: "submitted",
  });

  // --- Project 3: Jordan, just assigned, still planning ---
  const project3 = await storage.createProject({
    internId: jordan.id,
    companyId: company.id,
    title: "Marketing Operations Cleanup",
    idea: "Audit and clean up our email marketing lists and set up basic campaign tracking.",
    minimumTotalHours: 30,
    status: "assigned",
  });
  await storage.createProjectChannel(project3);

  // --- Notifications ---
  await storage.createNotification({
    userId: manager.id,
    title: "Plan Submitted for Review",
    message: `Maya Patel submitted a plan for "AI Research Summary Tool" for your review.`,
    read: false,
    link: "/?view=review&projectId=" + project2.id,
  });
  await storage.createNotification({
    userId: alex.id,
    title: "New Comment on Log",
    message: "EDAI Manager commented on your log entry.",
    read: true,
    link: "/?projectId=" + project1.id,
  });

  // --- Applications: pending, approved (already-onboarded example), rejected ---
  await storage.createApplication({
    companyId: company.id,
    name: "Priya Sharma",
    email: "priya.sharma@example.com",
    passwordHash: await bcrypt.hash("ApplicantPass123!", 10),
    skills: "Python, data analysis, SQL",
    motivation: "I'm studying data science and want hands-on experience with a real product team before I graduate.",
    githubUrl: "https://github.com/example-priya",
    linkedinUrl: null,
    portfolioUrl: null,
    status: "pending",
  } as any);

  await storage.createApplication({
    companyId: company.id,
    name: "Sam Rivera",
    email: "sam.rivera@example.com",
    passwordHash: await bcrypt.hash("ApplicantPass123!", 10),
    skills: "Figma, UI design, basic HTML/CSS",
    motivation: "Looking to build a portfolio with real product design work.",
    githubUrl: null,
    linkedinUrl: "https://linkedin.com/in/example-sam",
    portfolioUrl: "https://example-sam.design",
    status: "rejected",
    reviewerNotes: "Strong portfolio, but we don't have design capacity to mentor right now. Worth revisiting next quarter.",
    reviewedByUserId: manager.id,
    reviewedAt: new Date(),
  } as any);

  // --- Chat messages in #general ---
  await storage.createChannelMessage({ channelId: generalChannel.id, userId: manager.id, content: "Welcome to the team! Glad to have everyone on board this cycle." });
  await storage.createChannelMessage({ channelId: generalChannel.id, userId: alex.id, content: "Excited to get started on the website redesign!" });
  await storage.createChannelMessage({ channelId: generalChannel.id, userId: maya.id, content: "Just submitted my plan for the research tool — let me know if you'd like any changes." });

  console.log("\nSeed complete.");
  console.log("\nDemo accounts (password for all: " + DEMO_PASSWORD + "):");
  console.log("  Manager: manager@edai.fun");
  console.log("  Intern:  alex@internops.local   (active project with logged work + feedback)");
  console.log("  Intern:  maya@internops.local   (plan submitted, awaiting review)");
  console.log("  Intern:  jordan@internops.local (just assigned, no plan yet)");

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
