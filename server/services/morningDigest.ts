import { storage } from "../storage";
import { computeRiskFlags } from "./riskRadar";
import type { Task } from "@shared/schema";

// Ships fully rule-based, zero OpenAI calls — this is the first
// *unattended* scheduled feature in the codebase, and there's no AI
// cost-tracking anywhere yet. Reuses riskRadar's computeRiskFlags rather
// than re-deriving blocked/overdue/stale logic a second time.

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildDigestMessage(internName: string, tasks: Task[], riskReason?: string): string {
  const now = Date.now();
  const todayKey = dateKey(new Date(now));
  const open = tasks.filter((t) => t.status !== "completed");

  const dueToday = open.filter((t) => t.dueDate && dateKey(new Date(t.dueDate)) === todayKey);
  const dueThisWeek = open.filter((t) => {
    if (!t.dueDate) return false;
    const due = new Date(t.dueDate).getTime();
    return due > now && due - now <= 7 * DAY_MS && dateKey(new Date(t.dueDate)) !== todayKey;
  });

  const lines: string[] = [`Good morning, ${internName.split(" ")[0]}!`];

  if (dueToday.length > 0) {
    lines.push(`\nDue today:\n` + dueToday.map((t) => `- ${t.title}`).join("\n"));
  }
  if (dueThisWeek.length > 0) {
    lines.push(`\nDue this week:\n` + dueThisWeek.map((t) => `- ${t.title} (${formatDate(new Date(t.dueDate!))})`).join("\n"));
  }
  if (riskReason) {
    lines.push(`\nHeads up: ${riskReason}`);
  }
  if (dueToday.length === 0 && dueThisWeek.length === 0 && !riskReason) {
    lines.push(`\nNothing due soon and nothing blocked — you're all caught up.`);
  }

  return lines.join("\n");
}

export async function runMorningDigestForCompany(companyId: string): Promise<void> {
  const interns = await storage.getInternsByCompany(companyId);
  const activeInterns = interns.filter((i) => !i.deactivatedAt && i.morningDigestEnabled);
  if (activeInterns.length === 0) return;

  const allTasks = await storage.getTasksByCompany(companyId);
  const riskFlags = computeRiskFlags(activeInterns, allTasks);
  const riskByIntern = new Map(riskFlags.map((f) => [f.internId, f.reason]));

  const sentDate = dateKey(new Date());
  const systemUser = await storage.getOrCreateSystemUser(companyId);

  for (const intern of activeInterns) {
    const isNewSend = await storage.recordDigestRun(intern.id, sentDate);
    if (!isNewSend) continue; // already sent today — the unique constraint is the real guard

    const internTasks = allTasks.filter((t) => t.assigneeId === intern.id);
    const message = buildDigestMessage(intern.name, internTasks, riskByIntern.get(intern.id));

    const channel = await storage.getOrCreateDMChannel(companyId, systemUser.id, intern.id, systemUser.name, intern.name);
    await storage.createChannelMessage({ channelId: channel.id, userId: systemUser.id, content: message });
  }
}

export async function runMorningDigestSweep(): Promise<void> {
  const companies = await storage.getAllCompanies();
  for (const company of companies) {
    try {
      await runMorningDigestForCompany(company.id);
    } catch (error) {
      console.error(`Morning digest failed for company ${company.id}:`, error);
    }
  }
}
