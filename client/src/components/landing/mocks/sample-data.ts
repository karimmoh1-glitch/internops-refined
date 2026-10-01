/**
 * SAMPLE DATA — marketing only.
 *
 * Every name, task, time and reading in this file is invented for the public
 * landing page. Nothing here is read from, or written to, the product's data.
 * The mocks under components/landing/mocks render these constants statically
 * so the hero can show the real UI composition without a signed-in workspace.
 */

export const SAMPLE_MANAGER = "Dana M.";

export const SAMPLE_PEOPLE = {
  maya: "Maya R.",
  jonah: "Jonah K.",
  priya: "Priya S.",
  theo: "Theo L.",
} as const;

export type SampleTaskStatus = "todo" | "in_progress" | "in_review" | "blocked" | "completed";

export interface SampleTask {
  id: string;
  title: string;
  project: string;
  assignee: string;
  status: SampleTaskStatus;
  priority: "high" | "medium" | "low";
  due: string;
}

export const SAMPLE_TASKS: SampleTask[] = [
  { id: "t-1", title: "Ship onboarding email", project: "Onboarding", assignee: SAMPLE_PEOPLE.maya, status: "in_review", priority: "high", due: "Sep 26" },
  { id: "t-2", title: "Migrate auth routes to v2", project: "Platform", assignee: SAMPLE_PEOPLE.jonah, status: "in_progress", priority: "medium", due: "Oct 2" },
  { id: "t-3", title: "Fix empty state on Projects", project: "Platform", assignee: SAMPLE_PEOPLE.priya, status: "blocked", priority: "medium", due: "Sep 30" },
  { id: "t-4", title: "Write alumni certificate copy", project: "Alumni", assignee: SAMPLE_PEOPLE.theo, status: "todo", priority: "low", due: "Oct 7" },
  { id: "t-5", title: "Draft Q4 docs refresh plan", project: "Docs", assignee: SAMPLE_PEOPLE.priya, status: "completed", priority: "medium", due: "Sep 24" },
];

// The shift shown by every timer on the page "started" 1h 23m 41s before the
// page loaded, so the live clocks tick from a plausible value. One constant
// so the web Work Mode card and the Companion window agree to the second.
export const SAMPLE_SESSION_STARTED_AT = new Date(Date.now() - (1 * 3600 + 23 * 60 + 41) * 1000);

export interface SampleWorker {
  name: string;
  task: string;
  observed: string | null; // null = Companion not connected
  since: string;
}

export const SAMPLE_WORKING_NOW: SampleWorker[] = [
  { name: SAMPLE_PEOPLE.maya, task: "Ship onboarding email", observed: "VS Code — routes.ts", since: "1h 23m" },
  { name: SAMPLE_PEOPLE.jonah, task: "Migrate auth routes to v2", observed: "Chrome — github.com", since: "42m" },
  { name: SAMPLE_PEOPLE.theo, task: "Write alumni certificate copy", observed: null, since: "11m" },
];

export interface SampleSignal {
  severity: "high" | "medium";
  headline: string;
  evidence: string;
  person: string;
  actions: string[];
}

export const SAMPLE_SIGNALS: SampleSignal[] = [
  { severity: "high", headline: "Ship onboarding email is overdue", evidence: "Due Sep 26 · 2 days overdue · in review since 11:31", person: SAMPLE_PEOPLE.maya, actions: ["Review", "View task"] },
  { severity: "high", headline: "Fix empty state on Projects is blocked", evidence: "Waiting on Migrate auth routes to v2 · due Sep 30", person: SAMPLE_PEOPLE.priya, actions: ["View task", "View dependency"] },
  { severity: "medium", headline: "No recent session for Theo L.", evidence: "Last Work Mode session Thu · 3 open tasks", person: SAMPLE_PEOPLE.theo, actions: ["Message Theo"] },
  { severity: "medium", headline: "Q4 docs refresh plan awaits approval", evidence: "AI-drafted plan submitted 2d ago · 3 weeks, 9 tasks", person: SAMPLE_PEOPLE.priya, actions: ["Review proposal"] },
];

export type ReplayMarker = "OBSERVED" | "SYSTEM" | "UNKNOWN";

export interface SampleReplayEvent {
  time: string;
  marker: ReplayMarker;
  title: string;
  detail?: string;
  duration?: string;
}

export const SAMPLE_REPLAY: SampleReplayEvent[] = [
  { time: "09:02", marker: "SYSTEM", title: "Shift started", detail: "Started from the Companion" },
  { time: "09:04", marker: "SYSTEM", title: "Task started", detail: "Ship onboarding email" },
  { time: "09:05", marker: "OBSERVED", title: "VS Code — routes.ts, email.ts", detail: "Development", duration: "1h 07m" },
  { time: "10:12", marker: "OBSERVED", title: "Idle reading", detail: "No input for 6m 10s", duration: "6m" },
  { time: "10:19", marker: "UNKNOWN", title: "No Companion observation", detail: "Companion disconnected", duration: "22m" },
  { time: "10:41", marker: "OBSERVED", title: "Chrome — github.com", detail: "Development", duration: "49m" },
  { time: "11:31", marker: "SYSTEM", title: "Task submitted for review", detail: "Ship onboarding email · v2" },
  { time: "11:45", marker: "SYSTEM", title: "Shift ended", detail: "Ended by Maya R." },
];

export interface SampleSubmission {
  version: string;
  kind: "submitted" | "changes_requested";
  by: string;
  when: string;
  note: string;
}

export const SAMPLE_SUBMISSIONS: SampleSubmission[] = [
  { version: "v1", kind: "submitted", by: SAMPLE_PEOPLE.maya, when: "Sep 24 · 16:02", note: "First pass: copy and template wired to the welcome flow." },
  { version: "v1", kind: "changes_requested", by: SAMPLE_MANAGER, when: "Sep 25 · 09:14", note: "Subject line wraps on mobile. Trim it to 45 characters and add preview text." },
  { version: "v2", kind: "submitted", by: SAMPLE_PEOPLE.maya, when: "Today · 11:31", note: "Trimmed the subject to 41 characters and added preview text." },
];

export const SAMPLE_PLAN_WEEKS = [
  { week: "Week 1", title: "Audit current docs", tasks: 3 },
  { week: "Week 2", title: "Rewrite getting-started", tasks: 4 },
  { week: "Week 3", title: "Review and publish", tasks: 2 },
];

// Pulse Chat sample. Segments stream in order; chips render as linked references
// in the product (here they are inert, since there is nothing to link to).
export type PulseSegment = { kind: "text"; text: string } | { kind: "chip"; ref: "task" | "person" | "project"; label: string };

export const SAMPLE_PULSE_QUESTION = "What needs my attention?";

export const SAMPLE_PULSE_REPLY: PulseSegment[] = [
  { kind: "text", text: "Three things.\n\n" },
  { kind: "text", text: "•  " },
  { kind: "chip", ref: "task", label: "Ship onboarding email" },
  { kind: "text", text: " is 2 days overdue and has been waiting on your review since 11:31.\n" },
  { kind: "text", text: "•  " },
  { kind: "chip", ref: "task", label: "Fix empty state on Projects" },
  { kind: "text", text: " is blocked behind Jonah's auth migration, due Sep 30.\n" },
  { kind: "text", text: "•  " },
  { kind: "chip", ref: "person", label: "Theo L." },
  { kind: "text", text: " has not started a Work Mode session since Thursday and has 3 open tasks." },
];

export const SAMPLE_PULSE_SUGGESTIONS = ["Who is working right now?", "What changed today?", "What needs my attention?"];
