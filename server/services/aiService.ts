import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "dummy-key",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export interface WeekMilestone {
  weekNumber: number;
  milestone: string;
  deliverables: string[];
  successCriteria: string;
  hours: number;
}

export interface GeneratedPlan {
  weeks: WeekMilestone[];
}

export async function generatePlan(
  projectIdea: string,
  totalHours: number,
  numberOfWeeks: number
): Promise<GeneratedPlan> {
  const hoursPerWeek = Math.round(totalHours / numberOfWeeks);

  const prompt = `You are a project planning AI for InternOps, an intern management platform.

An intern has been assigned the following project:
"${projectIdea}"

Time allocation:
- Total hours: ${totalHours}
- Duration: ${numberOfWeeks} weeks
- Approximately ${hoursPerWeek} hours per week

Generate a structured execution plan. Each week should have:
1. A clear milestone (1-2 sentences)
2. 2-4 specific deliverables
3. Success criteria (how to measure completion)
4. Estimated hours for that week

Progress from foundational learning/setup in early weeks to implementation and polish in later weeks.

Respond in this exact JSON format:
{
  "weeks": [
    {
      "weekNumber": 1,
      "milestone": "Set up development environment and understand project requirements",
      "deliverables": ["Deliverable 1", "Deliverable 2"],
      "successCriteria": "Environment is ready and requirements document is complete",
      "hours": ${hoursPerWeek}
    }
  ]
}

Generate exactly ${numberOfWeeks} weeks. Total hours across all weeks should equal approximately ${totalHours}.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    const weeks: WeekMilestone[] = (parsed.weeks || []).map((w: any) => ({
      weekNumber: w.weekNumber,
      milestone: w.milestone || "",
      deliverables: Array.isArray(w.deliverables) ? w.deliverables : [],
      successCriteria: w.successCriteria || "",
      hours: w.hours || hoursPerWeek,
    }));

    if (weeks.length !== numberOfWeeks) {
      throw new Error(`AI generated ${weeks.length} weeks instead of ${numberOfWeeks}`);
    }

    return { weeks };
  } catch (error: any) {
    console.error("AI plan generation failed:", error.message);
    const weeks: WeekMilestone[] = [];
    const phases = ["Research & Setup", "Foundation", "Core Development", "Feature Building", "Testing", "Polish & Delivery"];

    for (let w = 1; w <= numberOfWeeks; w++) {
      const phaseIdx = Math.min(Math.floor((w - 1) / Math.ceil(numberOfWeeks / phases.length)), phases.length - 1);
      weeks.push({
        weekNumber: w,
        milestone: `${phases[phaseIdx]} - Week ${w}`,
        deliverables: [
          `Complete ${phases[phaseIdx].toLowerCase()} tasks for week ${w}`,
          `Document progress and findings`,
          `Prepare for next phase`,
        ],
        successCriteria: `Week ${w} tasks completed and documented`,
        hours: hoursPerWeek,
      });
    }
    return { weeks };
  }
}

export async function aiChat(
  projectContext: any,
  messages: Array<{role: "user" | "assistant"; content: string}>,
  mode: "brainstorm" | "plan" = "plan"
): Promise<string> {
  const projectIdea = projectContext?.idea || "Not specified";
  const projectTitle = projectContext?.title || "Untitled";
  const projectStatus = projectContext?.status || "unknown";
  const planContent = projectContext?.currentPlan;
  const managerComments = projectContext?.managerComments || [];
  const logs = projectContext?.weeklyLogs || [];
  const logFeedback = projectContext?.logComments || [];

  let contextBlock = `Project: "${projectTitle}"
Idea: "${projectIdea}"
Status: ${projectStatus}
Minimum Hours Required: ${projectContext?.minimumTotalHours || 'Not set'}`;

  if (planContent) {
    contextBlock += `\n\nCurrent Plan (${projectContext?.currentPlanStatus || 'unknown'} - v${projectContext?.versionCount || 1}):
${planContent.weeks?.map((w: any) => `  Week ${w.weekNumber}: ${w.milestone} (${w.hours}h) - Deliverables: ${(w.deliverables || []).join(', ')} - Success Criteria: ${w.successCriteria}`).join('\n') || 'No weeks defined'}
Total Planned Hours: ${planContent.totalPlannedHours || 'N/A'} (${planContent.hoursPerDay || '?'}h/day, ${planContent.daysPerWeek || '?'} days/week, ${planContent.numberOfWeeks || '?'} weeks)`;
  } else {
    contextBlock += '\n\nNo plan created yet.';
  }

  if (managerComments.length > 0) {
    contextBlock += `\n\nManager Comments/Revision Feedback:\n${managerComments.map((c: string, i: number) => `  ${i + 1}. "${c}"`).join('\n')}`;
  }

  if (logs.length > 0) {
    contextBlock += `\n\nWork Logs:\n${logs.slice(-10).map((l: any) => `  Week ${l.weekNumber}${l.subtaskIndex !== null && l.subtaskIndex !== undefined ? ` [Subtask ${l.subtaskIndex}]` : ''} (${new Date(l.createdAt).toLocaleDateString()}): "${l.logText}"`).join('\n')}`;
  }

  if (logFeedback.length > 0) {
    contextBlock += `\n\nManager Log Feedback:\n${logFeedback.slice(-5).map((c: string, i: number) => `  ${i + 1}. "${c}"`).join('\n')}`;
  }

  let systemMessage: string;

  if (mode === "brainstorm") {
    systemMessage = `You are an ENERGETIC and CREATIVE AI brainstorming partner for InternOps! Think of yourself as that brilliant friend who gets genuinely excited about ideas and always sees interesting angles others miss.

${contextBlock}

YOUR PERSONALITY:
- You're enthusiastic and playful — you genuinely love exploring ideas!
- You use vivid analogies and metaphors to explain concepts (e.g., "Think of your API like a restaurant menu — each endpoint is a dish, and the request body is how you customize your order")
- You ask thought-provoking "What if...?" questions to push thinking further
- You use emojis sparingly but naturally to add warmth (1-2 per response max)
- You format ideas clearly with **bold headers** for sections, numbered lists for options, and > blockquotes for key insights
- You reference creative frameworks when helpful (SCAMPER: Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse)

YOUR ROLE AS A THOUGHT PARTNER:
- Explore different approaches and architectures, always giving real trade-offs
- When discussing technologies, be opinionated but fair — "I'd lean toward X because..., but Y shines when..."
- Break down complex problems into bite-sized pieces using analogies
- Suggest resources, tutorials, or references when relevant
- Ask probing questions to deepen understanding — don't just agree with everything
- Challenge assumptions kindly: "That could work! Though I wonder — have you considered..."
- Help think about edge cases, user experience, and scalability
- Use the Six Thinking Hats concept: sometimes be the optimist, sometimes the devil's advocate

CONVERSATION STYLE:
- Start responses with an engaging hook, not just "That's a great idea"
- Mix short punchy observations with deeper analysis
- When listing options, give each a memorable one-line pitch
- End responses with a thought-provoking question or a "next step nudge" to keep momentum
- Keep responses focused and readable — use whitespace and formatting well

IMPORTANT RULES:
- NEVER include action tags like [ACTION:GENERATE_PLAN], [ACTION:MODIFY_PLAN], or [ACTION:DELETE_PLAN]. This is brainstorm mode — no plan actions.
- Keep the conversation exploratory and open-ended
- If the intern wants to create a formal plan, suggest they switch to Plan mode
- Be a creative catalyst, not just an answer machine`;
  } else {
    systemMessage = `You are an experienced AI project mentor for InternOps — think of yourself as a senior developer who's guided hundreds of interns through successful projects. You combine practical wisdom with genuine care for the intern's growth.

${contextBlock}

You are the intern's AI mentor. You are the PRIMARY way the intern creates and manages their project plan. The intern works with you on the left panel, and the right panel displays the results as a read-only view.

YOUR MENTOR PERSONALITY:
- Speak from experience: "In my experience...", "I've seen projects like this succeed when..."
- Be honest and direct — sugar-coating doesn't help anyone
- Celebrate good thinking, but flag risks early
- Teach the WHY behind planning decisions, not just the WHAT
- Use occasional emojis for warmth (1-2 per response max)

YOUR CAPABILITIES:
- DURATION PLANNING: Help the intern decide how to spread their project over time. This is the first step. Ask about their availability and preferences.
- PLAN GENERATION: Create detailed execution plans with weekly milestones, deliverables, success criteria, and hour allocations
- PLAN MODIFICATION: Edit any aspect of the plan — change milestones, deliverables, hours, add/remove weeks, restructure
- PLAN DELETION: Clear the plan so the intern can start over
- RISK ASSESSMENT: Proactively flag risks per week ("Week 3 looks heavy — I'd add a buffer day")
- DEPENDENCY AWARENESS: Point out task dependencies ("You'll need the API done before frontend integration in Week 4")
- SCOPE MANAGEMENT: Warn about scope creep, suggest MVP cuts when hours are tight
- BEST PRACTICES: Share real-world patterns ("In production teams, we usually allocate 20% of time to testing")
- TIME ESTIMATION COACHING: Teach realistic estimation ("Add 30% buffer — things always take longer than expected, especially auth and integrations")
- MILESTONE VALIDATION: Question unrealistic milestones ("4 hours for a full auth system is tight — here's what's realistic...")
- PROGRESS COACHING: When the plan is active, analyze work logs vs plan and give honest pacing feedback
- REVISION GUIDANCE: When manager sends back revisions, explain WHY and help strategize fixes

PROACTIVE MENTORING:
- If manager comments/revisions exist, address them FIRST — acknowledge the feedback, explain what needs to change, and suggest specific plan modifications
- If the plan status is "revision_requested", immediately help the intern understand the manager's concerns and propose solutions
- Flag any week where deliverables seem too ambitious for the allocated hours
- Point out missing dependencies between weeks
- Suggest where to add buffer time for unexpected issues

DURATION PLANNING FLOW (when no plan exists):
1. Ask the intern about their availability: hours per day, days per week
2. Help them figure out how many weeks to spread the project over
3. Make sure the total hours meet the minimum requirement
4. Discuss realistic pacing — front-load learning, back-load polish
5. Once they agree on a schedule, generate the plan

When the intern asks you to take an action on the plan, respond with helpful guidance AND include a special action tag. The system detects these tags and executes automatically:
- To generate a plan with specific time params: Include [ACTION:GENERATE_PLAN:hoursPerDay,daysPerWeek,numberOfWeeks] (e.g., [ACTION:GENERATE_PLAN:4,5,8])
- To generate a plan with defaults: Include [ACTION:GENERATE_PLAN]
- To modify the plan: Include [ACTION:MODIFY_PLAN] followed by the modification instruction
- To delete/restart the plan: Include [ACTION:DELETE_PLAN]

IMPORTANT RULES:
- DO NOT include action tags unless the intern clearly wants to take action. For discussion, advice, or questions, respond normally.
- When generating a plan, ALWAYS try to extract time parameters from the conversation. Use [ACTION:GENERATE_PLAN:H,D,W] format with their preferences.
- When the intern says things like "I can work 3 hours a day, 4 days a week for 10 weeks", extract those numbers and use [ACTION:GENERATE_PLAN:3,4,10]
- If no time preferences are stated and the intern just says "generate a plan", use [ACTION:GENERATE_PLAN] with defaults
- After generating, remind the intern they can ask you to modify anything

Be the mentor every intern deserves — experienced, honest, supportive, and invested in their success.`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        ...messages,
      ],
      max_completion_tokens: 3072,
    });
    return response.choices[0]?.message?.content || "I couldn't generate a response. Please try again.";
  } catch (error: any) {
    console.error("AI chat failed:", error.message);
    return "I'm having trouble connecting right now. Please try again in a moment.";
  }
}

export async function summarizeLog(logText: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Summarize this weekly work log into 2-3 concise bullet points:\n\n"${logText}"\n\nRespond with just the bullet points, no extra text.`
      }],
      max_completion_tokens: 256,
    });
    return response.choices[0]?.message?.content || logText;
  } catch {
    return logText;
  }
}

export async function modifyPlan(
  currentPlan: any,
  instruction: string,
  projectIdea: string
): Promise<any> {
  const prompt = `You are an AI plan editor for InternOps. You must modify the current execution plan based on the intern's instruction.

Project: "${projectIdea}"

Current Plan:
${JSON.stringify(currentPlan, null, 2)}

Instruction from intern: "${instruction}"

Modify the plan according to the instruction. Keep the same JSON structure. You can:
- Change milestones, deliverables, success criteria
- Adjust hours per week
- Add or remove weeks
- Reorder tasks
- Update any field

IMPORTANT: Maintain the same JSON structure with these fields:
- hoursPerDay, daysPerWeek, numberOfWeeks, totalPlannedHours
- weeks array with: weekNumber, milestone, deliverables (array), successCriteria, hours

Recalculate totalPlannedHours as the sum of all week hours.
Update numberOfWeeks to match the actual number of weeks.

Respond with ONLY the modified JSON, no explanation.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 4096,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    const parsed = JSON.parse(content);
    if (!parsed.weeks || !Array.isArray(parsed.weeks)) {
      throw new Error("Invalid plan structure");
    }

    parsed.weeks = parsed.weeks.map((w: any, idx: number) => ({
      weekNumber: w.weekNumber || idx + 1,
      milestone: w.milestone || "",
      deliverables: Array.isArray(w.deliverables) ? w.deliverables : [],
      successCriteria: w.successCriteria || "",
      hours: w.hours || 0,
    }));

    parsed.numberOfWeeks = parsed.weeks.length;
    parsed.totalPlannedHours = parsed.weeks.reduce((sum: number, w: any) => sum + (w.hours || 0), 0);
    parsed.hoursPerDay = parsed.hoursPerDay || currentPlan.hoursPerDay;
    parsed.daysPerWeek = parsed.daysPerWeek || currentPlan.daysPerWeek;

    return parsed;
  } catch (error: any) {
    console.error("AI plan modification failed:", error.message);
    return currentPlan;
  }
}

export interface OrgDigestTask {
  title: string;
  internName: string;
  status: string;
  priority: string;
  dueDate: string | null;
  blockedReason: string | null;
}

export interface OrgDigestIntern {
  name: string;
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  currentTask: string | null;
  tasksCompletedToday: string[];
  tasksCompletedYesterday: string[];
  hoursThisWeek: number;
  nextStep: string | null;
}

export interface OrgDigest {
  companyName: string;
  interns: OrgDigestIntern[];
  blockedTasks: OrgDigestTask[];
  overdueTasks: OrgDigestTask[];
  inReviewTasks: OrgDigestTask[];
  totalTasks: number;
  completedTasks: number;
  noWorkInterns: string[];
  pendingProposals: { title: string; internName: string }[];
  workingNowNames: string[];
  attentionSignals: { headline: string; description: string }[];
}

function hasOpenAiKey(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY);
}

function buildDigestBlock(digest: OrgDigest): string {
  const lines: string[] = [];
  lines.push(`Organization: ${digest.companyName}`);
  lines.push(`Total tasks: ${digest.totalTasks} (${digest.completedTasks} completed)`);
  lines.push("");
  lines.push("Per-intern task summary:");
  digest.interns.forEach((i) => {
    lines.push(`  - ${i.name}: ${i.completedTasks}/${i.totalTasks} completed, ${i.blockedTasks} blocked, ${i.overdueTasks} overdue`);
  });
  if (digest.blockedTasks.length > 0) {
    lines.push("");
    lines.push("Blocked tasks:");
    digest.blockedTasks.forEach((t) => lines.push(`  - "${t.title}" (${t.internName}): ${t.blockedReason || "no reason given"}`));
  }
  if (digest.overdueTasks.length > 0) {
    lines.push("");
    lines.push("Overdue tasks:");
    digest.overdueTasks.forEach((t) => lines.push(`  - "${t.title}" (${t.internName}), due ${t.dueDate}`));
  }
  if (digest.inReviewTasks.length > 0) {
    lines.push("");
    lines.push("Awaiting manager review:");
    digest.inReviewTasks.forEach((t) => lines.push(`  - "${t.title}" (${t.internName})`));
  }
  return lines.join("\n");
}

const FALLBACK_FOOTER = "\n_This is a data lookup, not an AI-generated answer — set OPENAI_API_KEY to enable free-form conversational Q&A._";

// Finds an intern the question is asking about, by name. Matches on
// first-name-or-full-name whole-word occurrences (word-boundary, not plain
// substring — otherwise a name part like "Intern" would false-match inside
// an unrelated word like "interns"), longest match wins (so "Sarah Chen"
// beats a coincidental "Sarah" in a two-Sarah org). Returns null rather
// than guessing when nothing matches.
function findMentionedIntern(digest: OrgDigest, q: string): OrgDigestIntern | null {
  let best: OrgDigestIntern | null = null;
  let bestLen = 0;
  for (const intern of digest.interns) {
    const nameParts = [intern.name.toLowerCase(), ...intern.name.toLowerCase().split(" ")];
    for (const part of nameParts) {
      if (part.length < 3) continue;
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`\\b${escaped}\\b`).test(q) && part.length > bestLen) {
        best = intern;
        bestLen = part.length;
      }
    }
  }
  return best;
}

// Deterministic, non-AI answers built only from real digest data — used
// whenever no OpenAI key is configured, or the AI call fails. Rather than
// always returning the same generic briefing regardless of what was asked
// (which technically avoids inventing facts, but isn't actually answering
// the question), this routes on simple keyword matches in the latest
// message to a targeted, real answer. Falls back to the full briefing only
// when nothing recognizable was asked — and says plainly what it *can*
// answer, rather than guessing.

function personQuestionAnswer(intern: OrgDigestIntern, q: string): string | null {
  if (/yesterday/.test(q)) {
    if (intern.tasksCompletedYesterday.length === 0) return `${intern.name} didn't complete any tasks yesterday.${FALLBACK_FOOTER}`;
    return `**${intern.name} completed yesterday:**\n` + intern.tasksCompletedYesterday.map((t) => `- "${t}"`).join("\n") + FALLBACK_FOOTER;
  }
  if (/hour|how long|how much time/.test(q)) {
    return `${intern.name} has worked ~${intern.hoursThisWeek}h this week (from real shift records).${FALLBACK_FOOTER}`;
  }
  if (/next|should.*do|what.*next/.test(q)) {
    if (!intern.nextStep) return `${intern.name} has no clear next task recommended right now — check if they have open work assigned.${FALLBACK_FOOTER}`;
    return `**Recommended next for ${intern.name}:** ${intern.nextStep}${FALLBACK_FOOTER}`;
  }
  if (/working on|currently|right now|today|complete|doing/.test(q)) {
    const parts: string[] = [];
    parts.push(intern.currentTask ? `${intern.name} is currently working on "${intern.currentTask}".` : `${intern.name} has no task in progress right now.`);
    if (intern.tasksCompletedToday.length > 0) {
      parts.push(`Completed today: ` + intern.tasksCompletedToday.map((t) => `"${t}"`).join(", ") + ".");
    }
    return parts.join(" ") + FALLBACK_FOOTER;
  }
  // Name was mentioned but the specific angle wasn't recognized — give a
  // general per-intern summary rather than falling through to the org-wide
  // briefing, which would ignore that a specific person was asked about.
  return `**${intern.name}:** ${intern.completedTasks}/${intern.totalTasks} tasks completed, ${intern.blockedTasks} blocked, ${intern.overdueTasks} overdue. ` +
    (intern.currentTask ? `Currently working on "${intern.currentTask}".` : `No task currently in progress.`) + FALLBACK_FOOTER;
}

function fallbackOrgAnswer(digest: OrgDigest, question: string): string {
  const q = question.toLowerCase();

  const mentioned = findMentionedIntern(digest, q);
  if (mentioned) {
    const answer = personQuestionAnswer(mentioned, q);
    if (answer) return answer;
  }

  if (/no (assigned |open )?work|unassigned|nothing assigned|no open task/.test(q)) {
    if (digest.noWorkInterns.length === 0) return `Everyone currently has at least one open task assigned.${FALLBACK_FOOTER}`;
    return `**${digest.noWorkInterns.length} intern${digest.noWorkInterns.length === 1 ? "" : "s"} with no open tasks:**\n` + digest.noWorkInterns.map((n) => `- ${n}`).join("\n") + FALLBACK_FOOTER;
  }

  if (/needs? attention|falling behind|who.?s behind|overloaded|too much work|inactive/.test(q)) {
    if (digest.attentionSignals.length === 0) return `Nothing needs attention right now — no overdue, blocked, overloaded, or inactive interns.${FALLBACK_FOOTER}`;
    return `**${digest.attentionSignals.length} thing${digest.attentionSignals.length === 1 ? "" : "s"} needing attention:**\n` + digest.attentionSignals.map((s) => `- ${s.description}`).join("\n") + FALLBACK_FOOTER;
  }

  // Checked before the more general "most tasks" pattern below, since
  // "who completed the most tasks" would otherwise match that one first.
  if (/completed the most|most completed|top perform/.test(q)) {
    const ranked = [...digest.interns].sort((a, b) => b.completedTasks - a.completedTasks).filter((i) => i.completedTasks > 0);
    if (ranked.length === 0) return `No tasks have been completed yet.${FALLBACK_FOOTER}`;
    const top = ranked[0];
    return `**${top.name}** has completed the most tasks: ${top.completedTasks}.${FALLBACK_FOOTER}`;
  }

  if (/most tasks|highest workload|who has the (most|highest)/.test(q)) {
    const ranked = [...digest.interns].sort((a, b) => b.totalTasks - a.totalTasks).filter((i) => i.totalTasks > 0);
    if (ranked.length === 0) return `No one has any tasks assigned yet.${FALLBACK_FOOTER}`;
    const top = ranked[0];
    return `**${top.name}** has the most tasks: ${top.totalTasks} total (${top.completedTasks} completed).${FALLBACK_FOOTER}`;
  }

  if (/overdue/.test(q)) {
    if (digest.overdueTasks.length === 0) return `No overdue tasks right now.${FALLBACK_FOOTER}`;
    return `**${digest.overdueTasks.length} overdue task${digest.overdueTasks.length === 1 ? "" : "s"}:**\n` + digest.overdueTasks.map((t) => `- "${t.title}" — ${t.internName}, due ${t.dueDate}`).join("\n") + FALLBACK_FOOTER;
  }

  if (/blocked/.test(q)) {
    if (digest.blockedTasks.length === 0) return `Nothing is blocked right now.${FALLBACK_FOOTER}`;
    return `**${digest.blockedTasks.length} blocked task${digest.blockedTasks.length === 1 ? "" : "s"}:**\n` + digest.blockedTasks.map((t) => `- "${t.title}" — ${t.internName}: ${t.blockedReason || "no reason given"}`).join("\n") + FALLBACK_FOOTER;
  }

  if (/pending|proposal|approval/.test(q)) {
    if (digest.pendingProposals.length === 0) return `No project proposals are waiting on a decision.${FALLBACK_FOOTER}`;
    return `**${digest.pendingProposals.length} proposal${digest.pendingProposals.length === 1 ? "" : "s"} awaiting review:**\n` + digest.pendingProposals.map((p) => `- "${p.title}" — ${p.internName}`).join("\n") + FALLBACK_FOOTER;
  }

  if ((/\bworking\b/.test(q) && /\bnow\b|\bcurrently\b/.test(q)) || /active (shift|now)/.test(q) || /who'?s working/.test(q)) {
    if (digest.workingNowNames.length === 0) return `No one is currently working a shift.${FALLBACK_FOOTER}`;
    return `**${digest.workingNowNames.length} intern${digest.workingNowNames.length === 1 ? "" : "s"} currently working:**\n` + digest.workingNowNames.map((n) => `- ${n}`).join("\n") + FALLBACK_FOOTER;
  }

  if (/review/.test(q)) {
    if (digest.inReviewTasks.length === 0) return `Nothing is waiting on your review right now.${FALLBACK_FOOTER}`;
    return `**${digest.inReviewTasks.length} task${digest.inReviewTasks.length === 1 ? "" : "s"} awaiting your review:**\n` + digest.inReviewTasks.map((t) => `- "${t.title}" — ${t.internName}`).join("\n") + FALLBACK_FOOTER;
  }

  return fallbackOrgBriefing(digest) +
    `\n\n_I can answer specific questions about: who has no work, overdue tasks, blocked tasks, pending review, project proposals, who's currently working, who needs attention, who has the most tasks or completed the most, or ask about a specific intern by name (what they're working on, completed today/yesterday, hours this week, or what's next for them)._` +
    FALLBACK_FOOTER;
}

function fallbackOrgBriefing(digest: OrgDigest): string {
  if (digest.totalTasks === 0) {
    return `No tasks exist yet for ${digest.companyName}. Once tasks are assigned, I can summarize progress, flag blockers, and highlight who needs attention.`;
  }

  const parts: string[] = [];
  parts.push(`**${digest.companyName} briefing** (${digest.completedTasks}/${digest.totalTasks} tasks completed)`);

  if (digest.blockedTasks.length > 0) {
    parts.push(`\n**Blocked (${digest.blockedTasks.length}):**\n` + digest.blockedTasks.map((t) => `- "${t.title}" — ${t.internName}: ${t.blockedReason || "no reason given"}`).join("\n"));
  }
  if (digest.overdueTasks.length > 0) {
    parts.push(`\n**Overdue (${digest.overdueTasks.length}):**\n` + digest.overdueTasks.map((t) => `- "${t.title}" — ${t.internName}`).join("\n"));
  }
  if (digest.inReviewTasks.length > 0) {
    parts.push(`\n**Awaiting your review (${digest.inReviewTasks.length}):**\n` + digest.inReviewTasks.map((t) => `- "${t.title}" — ${t.internName}`).join("\n"));
  }
  if (digest.blockedTasks.length === 0 && digest.overdueTasks.length === 0 && digest.inReviewTasks.length === 0) {
    parts.push("\nNothing blocked, overdue, or waiting on review right now.");
  }

  const behind = digest.interns.filter((i) => i.totalTasks > 0 && i.completedTasks / i.totalTasks < 0.5);
  if (behind.length > 0) {
    parts.push(`\n**Below 50% completion:** ` + behind.map((i) => `${i.name} (${i.completedTasks}/${i.totalTasks})`).join(", "));
  }

  return parts.join("\n");
}

export async function orgAssistantChat(
  digest: OrgDigest,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ reply: string; aiGenerated: boolean }> {
  if (!hasOpenAiKey()) {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    return { reply: fallbackOrgAnswer(digest, lastUserMessage), aiGenerated: false };
  }

  const contextBlock = buildDigestBlock(digest);
  const systemMessage = `You are an AI assistant for a manager on InternOps, an intern management platform. You help the manager understand what's happening across their organization — who's on track, who's blocked, what needs review.

Real, current data for ${digest.companyName}:
${contextBlock}

RULES:
- Only reference the data provided above. Never invent interns, tasks, or numbers that aren't in the data.
- If asked about something not covered by the data (e.g. hours worked, sentiment), say you don't have that information rather than guessing.
- Be concise and direct — this is a busy manager, not a chat companion.
- When listing tasks or interns, use their real names/titles from the data.
- If nothing is blocked/overdue, say so plainly rather than padding the response.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemMessage }, ...messages],
      max_completion_tokens: 1024,
    });
    const reply = response.choices[0]?.message?.content;
    if (!reply) throw new Error("No response from AI");
    return { reply, aiGenerated: true };
  } catch (error: any) {
    console.error("Org assistant AI call failed:", error.message);
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content || "";
    return { reply: fallbackOrgAnswer(digest, lastUserMessage), aiGenerated: false };
  }
}

export interface PerformanceDigestTask {
  title: string;
  completedAt: string;
  priority: string;
  skillTags: string[];
}

export interface PerformanceDigest {
  internName: string;
  companyName: string;
  completedTasks: PerformanceDigestTask[];
  skillCounts: { tag: string; count: number }[];
  totalCompleted: number;
}

function buildPerformanceDigestBlock(digest: PerformanceDigest): string {
  const lines: string[] = [];
  lines.push(`Intern: ${digest.internName} (${digest.companyName})`);
  lines.push(`Completed tasks: ${digest.totalCompleted}`);
  if (digest.completedTasks.length > 0) {
    lines.push("");
    lines.push("Completed task list:");
    digest.completedTasks.forEach((t) => {
      const tags = t.skillTags.length > 0 ? ` [${t.skillTags.join(", ")}]` : "";
      lines.push(`  - "${t.title}" (${t.priority} priority), completed ${t.completedAt}${tags}`);
    });
  }
  if (digest.skillCounts.length > 0) {
    lines.push("");
    lines.push("Skill frequency across completed tasks:");
    digest.skillCounts.forEach((s) => lines.push(`  - ${s.tag}: ${s.count}`));
  }
  return lines.join("\n");
}

// Deterministic, non-AI narrative built only from real digest data — used
// whenever no OpenAI key is configured, or the AI call fails. Never
// fabricates data; if there are no completed tasks, it says so plainly.
function fallbackPerformanceNarrative(digest: PerformanceDigest): string {
  if (digest.totalCompleted === 0) {
    return `${digest.internName} hasn't completed any tasks yet, so there isn't enough history to summarize.\n\n_This is a data summary, not an AI-generated answer — set OPENAI_API_KEY to enable narrative summaries._`;
  }

  const parts: string[] = [];
  parts.push(`${digest.internName} has completed ${digest.totalCompleted} task${digest.totalCompleted === 1 ? "" : "s"}.`);

  if (digest.skillCounts.length > 0) {
    const top = digest.skillCounts.slice(0, 5).map((s) => s.tag).join(", ");
    parts.push(`Most frequent skills involved: ${top}.`);
  }

  const recent = digest.completedTasks.slice(0, 5).map((t) => `"${t.title}"`).join(", ");
  if (recent) parts.push(`Recently completed: ${recent}.`);

  parts.push(`\n_This is a data summary, not an AI-generated answer — set OPENAI_API_KEY to enable narrative summaries._`);
  return parts.join(" ").replace(" \n_", "\n\n_");
}

export async function generatePerformanceNarrative(
  digest: PerformanceDigest,
): Promise<{ content: string; aiGenerated: boolean }> {
  if (!hasOpenAiKey()) {
    return { content: fallbackPerformanceNarrative(digest), aiGenerated: false };
  }

  const contextBlock = buildPerformanceDigestBlock(digest);
  const systemMessage = `You are writing a short performance summary paragraph for an intern on InternOps, an intern management platform. The manager may use this text directly in a performance review or a recommendation, so it should read naturally and professionally.

Real, current data for ${digest.internName}:
${contextBlock}

RULES:
- Only reference the tasks and skills listed above. Never invent metrics, hours worked (not tracked by this system), outcomes, or dates that aren't present in the data.
- Write 2-4 sentences in a professional, factual tone — no filler praise not backed by the data.
- If there are no completed tasks, say so plainly rather than inventing accomplishments.
- Do not use markdown formatting; return plain prose.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: "Write the performance summary now." },
      ],
      max_completion_tokens: 400,
    });
    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("No response from AI");
    return { content, aiGenerated: true };
  } catch (error: any) {
    console.error("Performance narrative AI call failed:", error.message);
    return { content: fallbackPerformanceNarrative(digest), aiGenerated: false };
  }
}

export async function generateRevisionGuidance(
  managerComment: string,
  currentPlan: any,
  projectIdea: string
): Promise<string> {
  const prompt = `You are an AI assistant helping an intern understand and implement their manager's revision feedback.

Project: "${projectIdea}"

Manager's revision comment: "${managerComment}"

Current plan summary:
${currentPlan?.weeks?.map((w: any) => `Week ${w.weekNumber}: ${w.milestone} (${w.hours}h)`).join('\n') || 'No plan available'}

Based on the manager's comment, provide:
1. A clear explanation of what changes the manager wants
2. 3-5 specific, actionable steps the intern should take to address the feedback
3. Any suggestions for improving the plan beyond what the manager mentioned

Keep your response concise and actionable. Use bullet points.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1024,
    });
    return response.choices[0]?.message?.content || "Unable to generate guidance. Please review the manager's comments manually.";
  } catch (error: any) {
    console.error("AI revision guidance failed:", error.message);
    return "Unable to generate guidance right now. Please review the manager's comments and make the requested changes to your plan.";
  }
}

// "Ask InternOps" — intern-scoped assistant. This is deliberately a
// separate digest type from OrgDigest, not a filtered view of it: the
// route that calls this only ever fetches this one intern's own tasks and
// projects from storage in the first place, so there is no org-wide data
// in scope to leak even if the model were adversarially prompted. The
// system prompt below is a second layer, not the only one.
export interface InternDigestTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  blockedReason: string | null;
}

export interface InternDigest {
  internName: string;
  tasks: InternDigestTask[];
  projectTitles: string[];
}

function buildInternDigestBlock(digest: InternDigest): string {
  const lines: string[] = [];
  lines.push(`Intern: ${digest.internName}`);
  if (digest.projectTitles.length > 0) {
    lines.push(`Projects: ${digest.projectTitles.join(", ")}`);
  }
  lines.push("");
  lines.push("Your tasks:");
  if (digest.tasks.length === 0) {
    lines.push("  (no tasks assigned yet)");
  } else {
    digest.tasks.forEach((t) => {
      const parts = [t.status, `priority: ${t.priority}`];
      if (t.dueDate) parts.push(`due ${t.dueDate}`);
      if (t.blockedReason) parts.push(`blocked: ${t.blockedReason}`);
      lines.push(`  - "${t.title}" (${parts.join(", ")})`);
    });
  }
  return lines.join("\n");
}

function fallbackInternSummary(digest: InternDigest): string {
  if (digest.tasks.length === 0) {
    return `You don't have any tasks assigned yet, ${digest.internName}. Once you do, I can help you keep track of deadlines and what's next.`;
  }
  const overdue = digest.tasks.filter((t) => t.status !== "completed" && t.dueDate && new Date(t.dueDate).getTime() < Date.now());
  const blocked = digest.tasks.filter((t) => t.status === "blocked");
  const inReview = digest.tasks.filter((t) => t.status === "in_review");
  const open = digest.tasks.filter((t) => t.status === "todo" || t.status === "in_progress");
  const parts: string[] = [`You have ${digest.tasks.length} task${digest.tasks.length === 1 ? "" : "s"}, ${open.length} still open.`];
  if (overdue.length > 0) parts.push(`**Overdue (${overdue.length}):** ` + overdue.map((t) => `"${t.title}"`).join(", "));
  if (blocked.length > 0) parts.push(`**Blocked (${blocked.length}):** ` + blocked.map((t) => `"${t.title}"`).join(", "));
  if (inReview.length > 0) parts.push(`**Awaiting review (${inReview.length}):** ` + inReview.map((t) => `"${t.title}"`).join(", "));
  parts.push(`_This is a data summary, not an AI-generated answer — set OPENAI_API_KEY to enable conversational Q&A._`);
  return parts.join("\n\n");
}

export async function internAssistantChat(
  digest: InternDigest,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<{ reply: string; aiGenerated: boolean }> {
  if (!hasOpenAiKey()) {
    return { reply: fallbackInternSummary(digest), aiGenerated: false };
  }

  const contextBlock = buildInternDigestBlock(digest);
  const systemMessage = `You are "Ask InternOps", an AI assistant for an intern on InternOps. You help them understand their own work — what's due, what's blocked, what to focus on.

Real, current data for ${digest.internName} (this intern only — you have no visibility into any other intern, manager-only data, or organization-wide information):
${contextBlock}

RULES:
- Only reference the data provided above. Never invent tasks, deadlines, or numbers not in the data.
- You have no information about other interns, managers, or the organization as a whole — if asked, say you don't have access to that, don't guess.
- If asked something not covered by the data, say: "I don't have enough information to answer that."
- Be concise and direct.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: systemMessage }, ...messages],
      max_completion_tokens: 1024,
    });
    const reply = response.choices[0]?.message?.content;
    if (!reply) throw new Error("No response from AI");
    return { reply, aiGenerated: true };
  } catch (error: any) {
    console.error("Intern assistant AI call failed:", error.message);
    return { reply: fallbackInternSummary(digest), aiGenerated: false };
  }
}
