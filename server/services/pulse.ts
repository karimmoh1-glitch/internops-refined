import OpenAI from "openai";
import { storage } from "../storage";
import { buildOrgContext, collectApprovals, isOverdue, dueWithin, hoursThisWeek, secondsToday, activityRollup, type OrgContext } from "./orgContext";
import { computeNextBestAction } from "./nextBestAction";
import { buildActivitySegments } from "./workJournal";
import type { Task, User } from "@shared/schema";

// Pulse Chat — the assistant that answers questions from the
// organization's REAL data. Two engines share one contract:
//
//   1. A deterministic engine that routes a question to a specific data
//      lookup and writes the answer itself. Always available, never
//      invents anything, and is what runs when no OpenAI key is set.
//   2. An LLM engine (when a key exists) that receives the same context
//      with object ids, streams its answer, and is told to cite objects
//      with the reference syntax below. Its output is validated: any
//      reference to an id that isn't in the context is dropped.
//
// Reference syntax, in both engines' output:  [[task:ID|Label]]
// [[person:ID|Name]]  [[project:ID|Title]]  [[replay:SESSION_ID|Label]]
// The client turns these into links; nothing else is interpreted.

export type PulseRef = { type: "task" | "person" | "project" | "replay"; id: string; label: string };
export interface PulseAnswer { text: string; references: PulseRef[]; aiGenerated: boolean }
export interface PulseSuggestion { label: string; prompt: string }

const REF_RE = /\[\[(task|person|project|replay):([A-Za-z0-9-]+)\|([^\]]+)\]\]/g;

export function extractReferences(text: string, allowed: (type: string, id: string) => boolean): { text: string; references: PulseRef[] } {
  const refs: PulseRef[] = [];
  const seen = new Set<string>();
  const cleaned = text.replace(REF_RE, (_m, type, id, label) => {
    if (!allowed(type, id)) return label; // unknown id: keep the label, drop the link
    const key = `${type}:${id}`;
    if (!seen.has(key)) { seen.add(key); refs.push({ type, id, label }); }
    return `[[${type}:${id}|${label}]]`;
  });
  return { text: cleaned, references: refs };
}

const ref = {
  task: (t: Task) => `[[task:${t.id}|${t.title}]]`,
  person: (u: { id: string; name: string }) => `[[person:${u.id}|${u.name}]]`,
  project: (p: { id: string; title: string }) => `[[project:${p.id}|${p.title}]]`,
  replay: (sessionId: string, label: string) => `[[replay:${sessionId}|${label}]]`,
};

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.round((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
function daysOverdue(t: Task, now: Date): number {
  return Math.max(1, Math.floor((now.getTime() - new Date(t.dueDate!).getTime()) / 86_400_000));
}
function plural(n: number, word: string): string { return `${n} ${word}${n === 1 ? "" : "s"}`; }

// ---------------------------------------------------------------------
// Name resolution (deliberately strict: never guess between two people)
// ---------------------------------------------------------------------
type Match = { person: User } | { ambiguous: User[] } | null;

export function findMentionedPerson(people: User[], question: string): Match {
  const q = question.toLowerCase();
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const exact = people.filter((p) => new RegExp(`\\b${esc(p.name.toLowerCase())}\\b`).test(q));
  if (exact.length === 1) return { person: exact[0] };
  if (exact.length > 1) return { ambiguous: exact };
  let best = 0; let candidates: User[] = [];
  for (const p of people) {
    const words = p.name.toLowerCase().split(/\s+/).filter((w) => w.length >= 2);
    let score = 0;
    for (const w of words) if (new RegExp(`\\b${esc(w)}\\b`).test(q)) score += w.length;
    if (score > 0 && score > best) { best = score; candidates = [p]; }
    else if (score > 0 && score === best) candidates.push(p);
  }
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { person: candidates[0] };
  return { ambiguous: candidates };
}

// ---------------------------------------------------------------------
// Deterministic org engine
// ---------------------------------------------------------------------
async function personAnswer(ctx: OrgContext, person: User, q: string): Promise<string> {
  const mine = ctx.tasks.filter((t) => t.assigneeId === person.id);
  const onShift = ctx.activeSessions.find((s) => s.internId === person.id);
  const live = ctx.liveActivityByInternId.get(person.id);
  const today = ctx.todayActivityByInternId.get(person.id) ?? [];
  const inProgress = mine.filter((t) => t.status === "in_progress");

  if (/session|shift|replay|what happened/.test(q)) {
    const sessions = ctx.recentSessions.filter((s) => s.internId === person.id).sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    const target = sessions[0];
    if (!target) return `${ref.person(person)} has no recorded Work Mode sessions in the last 14 days.`;
    const activities = await storage.getWorkActivitiesBySession(target.id);
    const segments = buildActivitySegments(activities as any);
    const subs = await storage.getTaskSubmissionsByInternInWindow(person.id, new Date(target.startedAt), target.endedAt ? new Date(target.endedAt) : ctx.now);
    const lines = [`**${target.status === "active" ? "Current" : "Most recent"} session for ${ref.person(person)}** — started ${new Date(target.startedAt).toLocaleString()}${target.endedAt ? `, ${fmtDuration(target.durationSeconds ?? 0)}` : ", still active"}.`];
    if (segments.length === 0) lines.push(`- No Companion activity was observed for this session.`);
    else {
      lines.push(`- Observed (${plural(segments.length, "segment")}):`);
      for (const seg of segments.slice(0, 6)) lines.push(`  - ${seg.label} — ${fmtDuration(seg.durationSeconds)}`);
      if (segments.length > 6) lines.push(`  - …and ${segments.length - 6} more`);
    }
    if (subs.length > 0) lines.push(`- Submitted: ${subs.map((s) => { const t = ctx.taskById.get(s.taskId); return t ? ref.task(t) : "a task"; }).join(", ")}`);
    lines.push(`Open ${ref.replay(target.id, "Workday Replay")} for the full timeline.`);
    return lines.join("\n");
  }
  if (/hour|how long|how much time|time this week/.test(q)) {
    return `${ref.person(person)} has ${fmtDuration(secondsToday(ctx, person.id))} recorded today and ~${hoursThisWeek(ctx, person.id)}h this week, from Work Mode sessions.`;
  }
  if (/right now|at this moment|on.?screen|what app/.test(q)) {
    if (!onShift) return `${ref.person(person)} isn't in Work Mode right now, so nothing is being observed.`;
    if (!live) return `${ref.person(person)} is in Work Mode, but the Companion hasn't reported any activity yet this session.`;
    const ago = Math.max(0, Math.round((ctx.now.getTime() - new Date(live.observedAt).getTime()) / 60000));
    return `${ref.person(person)} was last observed in **${live.application}${live.context ? ` — ${live.context}` : ""}** (${ago <= 1 ? "just now" : `~${ago}m ago`}). That's what the Companion directly observed — not a claim about what was accomplished.`;
  }
  if (/next|should.*do/.test(q)) {
    const { recommended } = computeNextBestAction(mine, ctx.tasks, ctx.tzOffsetMinutes);
    if (!recommended) return `${ref.person(person)} has no open To Do or in-progress tasks, so there's nothing to recommend next.`;
    return `**Next for ${ref.person(person)}:** ${ref.task(recommended.task)} — ${recommended.reason}`;
  }
  if (/work(ed|ing)? on|what.*(did|has|is).*(do|doing)|today/.test(q)) {
    const lines: string[] = [];
    const rollup = activityRollup(today);
    if (rollup.length > 0) lines.push(`**Observed today** (Companion): ` + rollup.map((a) => `${a.application}${a.context ? ` (${a.context})` : ""} ${fmtDuration(a.seconds)}`).join("; ") + ".");
    else lines.push(`**Observed today:** nothing recorded — ${onShift ? "the Companion hasn't reported activity this session" : "no Work Mode session today"}.`);
    lines.push(inProgress.length > 0 ? `**In progress:** ${inProgress.map(ref.task).join(", ")}.` : `**In progress:** no task currently in progress.`);
    const submittedToday = ctx.recentSubmissions.filter((s) => s.internId === person.id && new Date(s.submittedAt) >= ctx.todayStart);
    if (submittedToday.length > 0) lines.push(`**Submitted today:** ${submittedToday.map((s) => { const t = ctx.taskById.get(s.taskId); return t ? ref.task(t) : "a task"; }).join(", ")}.`);
    lines.push(`Observed activity and task status are separate facts; the Companion can't verify what was accomplished.`);
    return lines.join("\n");
  }
  const overdue = mine.filter((t) => isOverdue(t, ctx.now));
  const blocked = mine.filter((t) => t.status === "blocked");
  const inReview = mine.filter((t) => t.status === "in_review");
  const parts = [`**${ref.person(person)}** — ${mine.filter((t) => t.status === "completed").length}/${mine.length} tasks completed${onShift ? ", in Work Mode now" : ""}.`];
  if (inProgress.length) parts.push(`In progress: ${inProgress.map(ref.task).join(", ")}.`);
  if (inReview.length) parts.push(`Waiting on your review: ${inReview.map(ref.task).join(", ")}.`);
  if (blocked.length) parts.push(`Blocked: ${blocked.map((t) => `${ref.task(t)} (${t.blockedReason || "no reason given"})`).join(", ")}.`);
  if (overdue.length) parts.push(`Overdue: ${overdue.map((t) => `${ref.task(t)} by ${plural(daysOverdue(t, ctx.now), "day")}`).join(", ")}.`);
  return parts.join("\n");
}

export async function answerOrgQuestion(ctx: OrgContext, question: string): Promise<PulseAnswer> {
  const q = question.toLowerCase();
  const allowed = (type: string, id: string) => type === "task" ? ctx.taskById.has(id) : type === "project" ? ctx.projectById.has(id) : type === "person" ? ctx.internById.has(id) : true;
  const done = (text: string) => ({ ...extractReferences(text, allowed), aiGenerated: false });

  const mentioned = findMentionedPerson(ctx.interns, q);
  if (mentioned && "ambiguous" in mentioned) {
    return done(`I'm not sure which person you mean — ${mentioned.ambiguous.map(ref.person).join(", ")} all match. Could you use their full name?`);
  }
  if (mentioned && "person" in mentioned) return done(await personAnswer(ctx, mentioned.person, q));

  if (/who.?s? (is )?working|working (right )?now|active (shift|session)|in work mode|online/.test(q)) {
    if (ctx.activeSessions.length === 0) return done(`No one is in Work Mode right now.`);
    const lines = [`**${plural(ctx.activeSessions.length, "person")} in Work Mode:**`];
    for (const s of ctx.activeSessions) {
      const p = ctx.internById.get(s.internId); if (!p) continue;
      const live = ctx.liveActivityByInternId.get(p.id);
      const since = fmtDuration(Math.round((ctx.now.getTime() - new Date(s.startedAt).getTime()) / 1000));
      lines.push(`- ${ref.person(p)} — ${since}${live ? `, last seen in ${live.application}${live.context ? ` (${live.context})` : ""}` : ", no Companion activity yet"} · ${ref.replay(s.id, "replay")}`);
    }
    return done(lines.join("\n"));
  }
  if (/overdue|past due|late/.test(q)) {
    const overdue = ctx.tasks.filter((t) => isOverdue(t, ctx.now)).sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    if (overdue.length === 0) return done(`Nothing is overdue right now.`);
    return done(`**${plural(overdue.length, "overdue task")}:**\n` + overdue.map((t) => `- ${ref.task(t)} — ${ref.person(ctx.internById.get(t.assigneeId) ?? { id: t.assigneeId, name: "Unknown" })}, ${plural(daysOverdue(t, ctx.now), "day")} overdue, ${t.status.replace("_", " ")}`).join("\n"));
  }
  if (/blocked|stuck|blocker/.test(q)) {
    const blocked = ctx.tasks.filter((t) => t.status === "blocked");
    if (blocked.length === 0) return done(`Nothing is blocked right now.`);
    return done(`**${plural(blocked.length, "blocked task")}:**\n` + blocked.map((t) => `- ${ref.task(t)} — ${ref.person(ctx.internById.get(t.assigneeId) ?? { id: t.assigneeId, name: "Unknown" })}: ${t.blockedReason || "no reason given"}`).join("\n"));
  }
  if (/approv|review|waiting on me|waiting for me|pending|inbox/.test(q)) {
    const items = await collectApprovals(ctx);
    if (items.length === 0) return done(`Nothing is waiting on your decision right now.`);
    const label: Record<string, string> = { task_review: "Task submission", plan_review: "Plan to review", proposal: "Project proposal", application: "Application", shift_report: "Shift report" };
    return done(`**${plural(items.length, "item")} waiting on you:**\n` + items.map((i) => {
      const link = i.kind === "task_review" ? `[[task:${i.id}|${i.title}]]` : (i.kind === "plan_review" || i.kind === "proposal") ? `[[project:${i.id}|${i.title}]]` : i.title;
      return `- ${label[i.kind]}: ${link}${i.personId ? ` — ${ref.person({ id: i.personId, name: i.personName })}` : ""}`;
    }).join("\n"));
  }
  if (/submitted|hand(ed)? in|turned in/.test(q)) {
    const since = /week/.test(q) ? ctx.weekStart : ctx.todayStart;
    const subs = ctx.recentSubmissions.filter((s) => new Date(s.submittedAt) >= since);
    if (subs.length === 0) return done(`No submissions ${/week/.test(q) ? "this week" : "today"}.`);
    return done(`**${plural(subs.length, "submission")} ${/week/.test(q) ? "this week" : "today"}:**\n` + subs.map((s) => { const t = ctx.taskById.get(s.taskId); const p = ctx.internById.get(s.internId); return `- ${t ? ref.task(t) : "a task"} — ${p ? ref.person(p) : "Unknown"}, ${new Date(s.submittedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`; }).join("\n"));
  }
  if (/changed|what.?s new|recent|happened today|summar(y|ize)|activity/.test(q)) {
    const since = /week/.test(q) ? ctx.weekStart : ctx.todayStart;
    const lines: string[] = [];
    const started = ctx.tasks.filter((t) => t.startedAt && new Date(t.startedAt) >= since);
    const approved = ctx.tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= since);
    const subs = ctx.recentSubmissions.filter((s) => new Date(s.submittedAt) >= since);
    const sessions = ctx.recentSessions.filter((s) => new Date(s.startedAt) >= since);
    const totalSeconds = sessions.reduce((sum, s) => sum + (s.status === "completed" ? (s.durationSeconds ?? 0) : Math.round((ctx.now.getTime() - new Date(s.startedAt).getTime()) / 1000)), 0);
    lines.push(`**Since ${/week/.test(q) ? "Monday" : "midnight"}:** ${plural(sessions.length, "Work Mode session")} (${fmtDuration(totalSeconds)} total), ${plural(subs.length, "submission")}, ${plural(approved.length, "approval")}, ${plural(started.length, "task")} started.`);
    if (subs.length) lines.push(`- Submitted: ` + subs.slice(0, 8).map((s) => { const t = ctx.taskById.get(s.taskId); return t ? ref.task(t) : "a task"; }).join(", "));
    if (approved.length) lines.push(`- Approved: ` + approved.slice(0, 8).map(ref.task).join(", "));
    if (started.length) lines.push(`- Started: ` + started.slice(0, 8).map(ref.task).join(", "));
    const newlyBlocked = ctx.tasks.filter((t) => t.status === "blocked" && t.updatedAt && new Date(t.updatedAt) >= since);
    if (newlyBlocked.length) lines.push(`- Newly blocked: ` + newlyBlocked.map(ref.task).join(", "));
    if (lines.length === 1 && sessions.length === 0 && subs.length === 0) lines.push(`Nothing has moved yet.`);
    return done(lines.join("\n"));
  }
  if (/attention|behind|at risk|needs? me|focus on|priorit/.test(q)) {
    if (ctx.signals.length === 0) return done(`Nothing needs your attention right now — no overdue, blocked, stalled, or waiting work.`);
    const top = ctx.signals.slice(0, 8);
    return done(`**${plural(ctx.signals.length, "signal")} right now:**\n` + top.map((s) => {
      const task = s.taskId ? ctx.taskById.get(s.taskId) : null;
      const who = s.internId ? ctx.internById.get(s.internId) : null;
      const project = s.projectId ? ctx.projectById.get(s.projectId) : null;
      const anchor = task ? ref.task(task) : project ? ref.project(project) : who ? ref.person(who) : "";
      return `- **${s.headline}** — ${s.description}${anchor ? ` ${anchor}` : ""}`;
    }).join("\n") + (ctx.signals.length > 8 ? `\n…and ${ctx.signals.length - 8} more on the Signals page.` : ""));
  }
  if (/project/.test(q) && /(behind|late|risk|status|progress)/.test(q)) {
    const lines: string[] = [];
    for (const p of ctx.projects) {
      if (p.status === "rejected") continue;
      const pt = ctx.tasks.filter((t) => t.projectId === p.id);
      const overdue = pt.filter((t) => isOverdue(t, ctx.now)).length;
      const blocked = pt.filter((t) => t.status === "blocked").length;
      const doneCount = pt.filter((t) => t.status === "completed").length;
      if (overdue === 0 && blocked === 0 && !/status|progress/.test(q)) continue;
      lines.push(`- ${ref.project(p)} (${ref.person(ctx.internById.get(p.internId) ?? { id: p.internId, name: "Unknown" })}) — ${doneCount}/${pt.length} tasks done${overdue ? `, ${overdue} overdue` : ""}${blocked ? `, ${blocked} blocked` : ""}`);
    }
    if (lines.length === 0) return done(`No project has overdue or blocked tasks right now.`);
    return done(`**Projects:**\n` + lines.join("\n"));
  }
  if (/no (assigned |open )?work|unassigned|nothing assigned|idle|free/.test(q)) {
    const none = ctx.interns.filter((i) => !ctx.tasks.some((t) => t.assigneeId === i.id && t.status !== "completed"));
    if (none.length === 0) return done(`Everyone has at least one open task.`);
    return done(`**${plural(none.length, "person")} with no open tasks:** ${none.map(ref.person).join(", ")}.`);
  }
  if (/hours|time (logged|worked)|how much/.test(q)) {
    const lines = ctx.interns.map((i) => `- ${ref.person(i)} — ${fmtDuration(secondsToday(ctx, i.id))} today, ~${hoursThisWeek(ctx, i.id)}h this week`);
    return done(`**Recorded Work Mode time:**\n` + lines.join("\n"));
  }

  // Not recognised: say what is possible rather than guessing.
  const approvals = await collectApprovals(ctx);
  return done(
    `I can only answer from recorded data, and I didn't recognise that question. Right now: ${plural(ctx.activeSessions.length, "person")} in Work Mode, ${plural(ctx.tasks.filter((t) => isOverdue(t, ctx.now)).length, "overdue task")}, ${plural(ctx.tasks.filter((t) => t.status === "blocked").length, "blocked task")}, ${plural(approvals.length, "item")} waiting on you.\n\n` +
    `Try: *who is working right now*, *what needs my attention*, *what changed today*, *what was submitted today*, *what's blocked*, *what needs approval*, *which projects are behind*, or ask about a person by name (what they worked on today, their hours, their last session, what's next for them).`,
  );
}

export async function orgSuggestions(ctx: OrgContext): Promise<PulseSuggestion[]> {
  const out: PulseSuggestion[] = [];
  const approvals = await collectApprovals(ctx);
  if (ctx.signals.length > 0) out.push({ label: "What needs my attention?", prompt: "What needs my attention?" });
  if (approvals.length > 0) out.push({ label: `Who is waiting on me? (${approvals.length})`, prompt: "Who is waiting on me?" });
  if (ctx.activeSessions.length > 0) out.push({ label: `Who is working right now? (${ctx.activeSessions.length})`, prompt: "Who is working right now?" });
  const overdue = ctx.tasks.filter((t) => isOverdue(t, ctx.now)).length;
  if (overdue > 0) out.push({ label: `Show overdue work (${overdue})`, prompt: "What tasks are overdue?" });
  const blocked = ctx.tasks.filter((t) => t.status === "blocked").length;
  if (blocked > 0) out.push({ label: `Show blocked work (${blocked})`, prompt: "What tasks are blocked?" });
  const subsToday = ctx.recentSubmissions.filter((s) => new Date(s.submittedAt) >= ctx.todayStart).length;
  if (subsToday > 0) out.push({ label: `What was submitted today? (${subsToday})`, prompt: "What was submitted today?" });
  if (ctx.recentSessions.length > 0 || ctx.recentSubmissions.length > 0) out.push({ label: "What changed today?", prompt: "What changed today?" });
  for (const s of ctx.activeSessions.slice(0, 2)) {
    const p = ctx.internById.get(s.internId);
    if (p) out.push({ label: `What is ${p.name.split(" ")[0]} working on?`, prompt: `What is ${p.name} working on today?` });
  }
  if (out.length === 0) out.push({ label: "Summarize the workspace", prompt: "What changed this week?" });
  return out.slice(0, 6);
}

// ---------------------------------------------------------------------
// Deterministic intern engine (only the caller's own data is ever loaded)
// ---------------------------------------------------------------------
export interface InternContext {
  user: User;
  tasks: Task[];
  projects: { id: string; title: string; status: string }[];
  activeSession: { id: string; startedAt: Date } | null;
  recentSessions: { id: string; startedAt: Date; endedAt: Date | null; durationSeconds: number | null; status: string }[];
  secondsToday: number;
  secondsWeek: number;
  now: Date;
  tzOffsetMinutes: number;
}

export async function buildInternContext(userId: string, tzOffsetMinutes = 0): Promise<InternContext | null> {
  const user = await storage.getUser(userId);
  if (!user) return null;
  const now = new Date();
  const { startOfToday, startOfWeek, summarizeSessions } = await import("./worktime");
  const [tasks, projects, activeSession, recentSessions, todaySessions, weekSessions] = await Promise.all([
    storage.getTasksByAssignee(userId),
    storage.getProjectsByIntern(userId),
    storage.getActiveWorkSession(userId),
    storage.getWorkSessionsByIntern(userId, 20),
    storage.getWorkSessionsByInternSince(userId, startOfToday(now, tzOffsetMinutes)),
    storage.getWorkSessionsByInternSince(userId, startOfWeek(now, tzOffsetMinutes)),
  ]);
  return {
    user, tasks, projects: projects.map((p) => ({ id: p.id, title: p.title, status: p.status })),
    activeSession: activeSession ? { id: activeSession.id, startedAt: new Date(activeSession.startedAt) } : null,
    recentSessions: recentSessions.map((s) => ({ id: s.id, startedAt: new Date(s.startedAt), endedAt: s.endedAt ? new Date(s.endedAt) : null, durationSeconds: s.durationSeconds, status: s.status })),
    secondsToday: summarizeSessions(todaySessions, now).totalSeconds,
    secondsWeek: summarizeSessions(weekSessions, now).totalSeconds,
    now, tzOffsetMinutes,
  };
}

export function answerInternQuestion(ctx: InternContext, question: string): PulseAnswer {
  const q = question.toLowerCase();
  const allowed = (type: string, id: string) => type === "task" ? ctx.tasks.some((t) => t.id === id) : type === "project" ? ctx.projects.some((p) => p.id === id) : type === "replay" ? ctx.recentSessions.some((s) => s.id === id) : type === "person" ? id === ctx.user.id : false;
  const done = (text: string) => ({ ...extractReferences(text, allowed), aiGenerated: false });
  const open = ctx.tasks.filter((t) => t.status !== "completed");

  if (/next|should i|start with|priorit|focus/.test(q)) {
    const { recommended, alternates } = computeNextBestAction(ctx.tasks, ctx.tasks, ctx.tzOffsetMinutes);
    if (!recommended) return done(open.length === 0 ? `You have no open tasks — nothing to pick up right now.` : `Everything open is either blocked or waiting on review, so there's nothing to start right now.`);
    return done(`**Start with ${ref.task(recommended.task)}.** ${recommended.reason}${alternates.length ? `\n\nAfter that: ${alternates.slice(0, 3).map(ref.task).join(", ")}.` : ""}`);
  }
  if (/overdue|late|due/.test(q)) {
    const overdue = open.filter((t) => isOverdue(t, ctx.now));
    const soon = open.filter((t) => dueWithin(t, ctx.now, 3));
    if (overdue.length === 0 && soon.length === 0) return done(`Nothing is overdue, and nothing is due in the next three days.`);
    const lines: string[] = [];
    if (overdue.length) lines.push(`**Overdue:** ` + overdue.map((t) => `${ref.task(t)} (${plural(daysOverdue(t, ctx.now), "day")})`).join(", "));
    if (soon.length) lines.push(`**Due soon:** ` + soon.map((t) => `${ref.task(t)} (${new Date(t.dueDate!).toLocaleDateString()})`).join(", "));
    return done(lines.join("\n"));
  }
  if (/blocked|stuck/.test(q)) {
    const blocked = open.filter((t) => t.status === "blocked");
    if (blocked.length === 0) return done(`None of your tasks are blocked.`);
    return done(`**Blocked:** ` + blocked.map((t) => `${ref.task(t)} — ${t.blockedReason || "no reason given"}`).join("; ") + `.\n\nUnblock a task from its page once you can move again, or message your manager.`);
  }
  if (/feedback|changes requested|review/.test(q)) {
    const withFeedback = ctx.tasks.filter((t) => t.feedback && t.status === "in_progress");
    const inReview = ctx.tasks.filter((t) => t.status === "in_review");
    const lines: string[] = [];
    if (withFeedback.length) lines.push(`**Changes requested:** ` + withFeedback.map((t) => `${ref.task(t)} — "${t.feedback!.slice(0, 140)}${t.feedback!.length > 140 ? "…" : ""}"`).join("; "));
    if (inReview.length) lines.push(`**Waiting on your manager:** ` + inReview.map(ref.task).join(", "));
    if (lines.length === 0) return done(`No open feedback, and nothing is waiting on review.`);
    return done(lines.join("\n"));
  }
  if (/hour|time|how long|today|this week/.test(q)) {
    return done(`**Recorded Work Mode time:** ${fmtDuration(ctx.secondsToday)} today, ${fmtDuration(ctx.secondsWeek)} this week${ctx.activeSession ? ` (a session is running now — ${fmtDuration(Math.round((ctx.now.getTime() - ctx.activeSession.startedAt.getTime()) / 1000))} so far)` : ""}.`);
  }
  if (/session|shift|replay|what did i/.test(q)) {
    const last = ctx.recentSessions[0];
    if (!last) return done(`You haven't recorded a Work Mode session yet.`);
    return done(`Your ${last.status === "active" ? "current" : "last"} session started ${last.startedAt.toLocaleString()}${last.endedAt ? ` and ran ${fmtDuration(last.durationSeconds ?? 0)}` : ""}. Open ${ref.replay(last.id, "Workday Replay")} to see exactly what was recorded.`);
  }
  if (/project/.test(q)) {
    if (ctx.projects.length === 0) return done(`You don't have a project assigned yet.`);
    return done(`**Your projects:** ` + ctx.projects.map((p) => `${ref.project(p)} (${p.status.replace("_", " ")})`).join(", "));
  }
  // Default: a compact status.
  const inProgress = open.filter((t) => t.status === "in_progress");
  const todo = open.filter((t) => t.status === "todo");
  const parts = [`**You have ${plural(open.length, "open task")}**: ${inProgress.length} in progress, ${todo.length} to do, ${open.filter((t) => t.status === "blocked").length} blocked, ${open.filter((t) => t.status === "in_review").length} in review.`];
  if (inProgress.length) parts.push(`In progress: ${inProgress.map(ref.task).join(", ")}.`);
  parts.push(`Ask me *what should I do next*, *what's due*, *what's blocked*, *any feedback*, or *my hours*.`);
  return done(parts.join("\n"));
}

export function internSuggestions(ctx: InternContext): PulseSuggestion[] {
  const out: PulseSuggestion[] = [];
  const open = ctx.tasks.filter((t) => t.status !== "completed");
  if (open.some((t) => t.status === "todo" || t.status === "in_progress")) out.push({ label: "What should I do next?", prompt: "What should I do next?" });
  if (open.some((t) => isOverdue(t, ctx.now) || dueWithin(t, ctx.now, 3))) out.push({ label: "What's due soon?", prompt: "What's overdue or due soon?" });
  if (ctx.tasks.some((t) => t.feedback && t.status === "in_progress")) out.push({ label: "Any feedback for me?", prompt: "Do I have any feedback to act on?" });
  if (open.some((t) => t.status === "blocked")) out.push({ label: "Show my blocked work", prompt: "What's blocked?" });
  if (ctx.recentSessions.length > 0) out.push({ label: "My hours this week", prompt: "How many hours have I worked this week?" });
  if (ctx.recentSessions.length > 0) out.push({ label: "Replay my last session", prompt: "What happened in my last session?" });
  if (out.length === 0) out.push({ label: "What's on my plate?", prompt: "What's on my plate?" });
  return out.slice(0, 6);
}

// ---------------------------------------------------------------------
// LLM engine (streaming) — optional, only when a key is configured
// ---------------------------------------------------------------------
export function hasOpenAiKey(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
}

function orgContextBlock(ctx: OrgContext, approvals: Awaited<ReturnType<typeof collectApprovals>>): string {
  const lines: string[] = [];
  lines.push(`Workspace: ${ctx.company.name}. Now: ${ctx.now.toISOString()}.`);
  lines.push(`People (active interns):`);
  for (const i of ctx.interns) {
    const mine = ctx.tasks.filter((t) => t.assigneeId === i.id);
    const onShift = ctx.activeSessions.find((s) => s.internId === i.id);
    const live = ctx.liveActivityByInternId.get(i.id);
    const today = activityRollup(ctx.todayActivityByInternId.get(i.id) ?? [], 4);
    lines.push(`- person id=${i.id} name="${i.name}" tasks=${mine.length} completed=${mine.filter((t) => t.status === "completed").length} in_progress=${mine.filter((t) => t.status === "in_progress").length} blocked=${mine.filter((t) => t.status === "blocked").length} overdue=${mine.filter((t) => isOverdue(t, ctx.now)).length} hours_today=${(secondsToday(ctx, i.id) / 3600).toFixed(1)} hours_week=${hoursThisWeek(ctx, i.id)} in_work_mode=${onShift ? `yes (session id=${onShift.id}, since ${new Date(onShift.startedAt).toISOString()})` : "no"}${live ? ` last_observed="${live.application}${live.context ? ` — ${live.context}` : ""}" at ${live.observedAt}` : ""}${today.length ? ` observed_today=${today.map((a) => `${a.application}${a.context ? `(${a.context})` : ""} ${Math.round(a.seconds / 60)}m`).join("; ")}` : ""}`);
  }
  lines.push(`Tasks (open and recently completed):`);
  for (const t of ctx.tasks.filter((t) => t.status !== "completed" || (t.completedAt && new Date(t.completedAt) >= ctx.weekStart))) {
    const who = ctx.internById.get(t.assigneeId);
    lines.push(`- task id=${t.id} title="${t.title}" assignee="${who?.name ?? "Unknown"}" assignee_id=${t.assigneeId} status=${t.status} priority=${t.priority}${t.dueDate ? ` due=${new Date(t.dueDate).toISOString().slice(0, 10)}` : ""}${isOverdue(t, ctx.now) ? ` OVERDUE_BY_DAYS=${daysOverdue(t, ctx.now)}` : ""}${t.blockedReason ? ` blocked_reason="${t.blockedReason}"` : ""}${t.projectId ? ` project_id=${t.projectId}` : ""}${t.submittedAt ? ` submitted_at=${new Date(t.submittedAt).toISOString()}` : ""}${t.completedAt ? ` approved_at=${new Date(t.completedAt).toISOString()}` : ""}`);
  }
  lines.push(`Projects:`);
  for (const p of ctx.projects) lines.push(`- project id=${p.id} title="${p.title}" owner_id=${p.internId} status=${p.status}`);
  lines.push(`Waiting on the manager (${approvals.length}): ` + (approvals.map((a) => `${a.kind}:${a.title}(${a.personName})`).join("; ") || "nothing"));
  lines.push(`Submissions today: ` + (ctx.recentSubmissions.filter((s) => new Date(s.submittedAt) >= ctx.todayStart).map((s) => `${ctx.taskById.get(s.taskId)?.title ?? "task"} by ${ctx.internById.get(s.internId)?.name ?? "?"} at ${new Date(s.submittedAt).toISOString()}`).join("; ") || "none"));
  lines.push(`Signals (${ctx.signals.length}): ` + (ctx.signals.map((s) => `${s.headline}: ${s.description}${s.taskId ? ` [task_id=${s.taskId}]` : ""}`).join(" | ") || "none"));
  return lines.join("\n");
}

const ORG_SYSTEM_RULES = `You are Pulse, the assistant inside InternOps, answering a manager's questions about their team from the data below.
RULES:
- Answer ONLY from the data provided. Never invent people, tasks, numbers, or reasons. If the data can't answer, say exactly that.
- Companion activity (observed apps/documents) and task status are separate facts. Never say someone "worked on X" based on activity alone; say what was observed and what was assigned.
- Never judge motivation, effort, or attitude. Describe conditions (overdue, blocked, waiting, no recent session), not people.
- Be concise. Lead with the count or the answer, then a short bullet list. No preamble.
- Cite objects with this exact syntax so they become links: [[task:ID|title]] [[person:ID|name]] [[project:ID|title]] [[replay:SESSION_ID|Workday Replay]]. Use the ids from the data verbatim.
- If a name is ambiguous between two people, ask which one.`;

export async function streamOrgAnswer(ctx: OrgContext, messages: { role: "user" | "assistant"; content: string }[], onDelta: (text: string) => void): Promise<PulseAnswer> {
  const approvals = await collectApprovals(ctx);
  const allowed = (type: string, id: string) => type === "task" ? ctx.taskById.has(id) : type === "project" ? ctx.projectById.has(id) : type === "person" ? ctx.internById.has(id) : type === "replay" ? ctx.recentSessions.some((s) => s.id === id) : false;
  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL });
  const stream = await openai.chat.completions.create({
    model: process.env.PULSE_MODEL || "gpt-4o-mini",
    stream: true,
    max_completion_tokens: 900,
    messages: [{ role: "system", content: `${ORG_SYSTEM_RULES}\n\nDATA:\n${orgContextBlock(ctx, approvals)}` }, ...messages],
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) { full += delta; onDelta(delta); }
  }
  return { ...extractReferences(full, allowed), aiGenerated: true };
}

const INTERN_SYSTEM_RULES = `You are Pulse, the assistant inside InternOps, helping an intern with their OWN work from the data below (only their data is here).
RULES: answer only from the data; never invent tasks or deadlines; be concise and practical; cite with [[task:ID|title]] [[project:ID|title]] [[replay:SESSION_ID|Workday Replay]] using ids verbatim.`;

export async function streamInternAnswer(ctx: InternContext, messages: { role: "user" | "assistant"; content: string }[], onDelta: (text: string) => void): Promise<PulseAnswer> {
  const allowed = (type: string, id: string) => type === "task" ? ctx.tasks.some((t) => t.id === id) : type === "project" ? ctx.projects.some((p) => p.id === id) : type === "replay" ? ctx.recentSessions.some((s) => s.id === id) : false;
  const data = [
    `Intern: ${ctx.user.name}. Now: ${ctx.now.toISOString()}. Hours today: ${(ctx.secondsToday / 3600).toFixed(1)}. Hours this week: ${(ctx.secondsWeek / 3600).toFixed(1)}. In Work Mode now: ${ctx.activeSession ? "yes" : "no"}.`,
    `Tasks:`, ...ctx.tasks.map((t) => `- task id=${t.id} title="${t.title}" status=${t.status} priority=${t.priority}${t.dueDate ? ` due=${new Date(t.dueDate).toISOString().slice(0, 10)}` : ""}${t.blockedReason ? ` blocked_reason="${t.blockedReason}"` : ""}${t.feedback ? ` manager_feedback="${t.feedback.slice(0, 300)}"` : ""}`),
    `Projects:`, ...ctx.projects.map((p) => `- project id=${p.id} title="${p.title}" status=${p.status}`),
    `Recent sessions:`, ...ctx.recentSessions.slice(0, 5).map((s) => `- session id=${s.id} started=${s.startedAt.toISOString()} ${s.endedAt ? `duration_min=${Math.round((s.durationSeconds ?? 0) / 60)}` : "active"}`),
  ].join("\n");
  const openai = new OpenAI({ apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY, baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL });
  const stream = await openai.chat.completions.create({
    model: process.env.PULSE_MODEL || "gpt-4o-mini",
    stream: true,
    max_completion_tokens: 700,
    messages: [{ role: "system", content: `${INTERN_SYSTEM_RULES}\n\nDATA:\n${data}` }, ...messages],
  });
  let full = "";
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) { full += delta; onDelta(delta); }
  }
  return { ...extractReferences(full, allowed), aiGenerated: true };
}
