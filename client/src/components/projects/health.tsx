import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { Dot, Section, toneClasses, type Tone } from "@/components/kit";
import { deliverableCoverage, pickCurrentVersion, type Criterion, type PlanVersion, type Project, type TaskStats, type WeeklyLog } from "./types";

interface Signal { tone: Tone; text: string; href?: string }

// Health is a list of observed facts, not a score. Every line below is
// derived from a real field: task statuses and due dates, plan version
// status, criteria completion, and log coverage. Nothing is weighted.
export function computeHealth(project: Project, stats: TaskStats | undefined, versions: PlanVersion[], criteria: Criterion[], logs: WeeklyLog[]): { headline: string; tone: Tone; signals: Signal[] } {
  const signals: Signal[] = [];
  const taskHref = `/projects/${project.id}?tab=tasks`;

  if (stats) {
    if (stats.overdue > 0) signals.push({ tone: "danger", text: `${pluralize(stats.overdue, "task")} past due`, href: taskHref });
    if (stats.blocked > 0) signals.push({ tone: "danger", text: `${pluralize(stats.blocked, "task")} blocked`, href: taskHref });
    if (stats.inReview > 0) signals.push({ tone: "info", text: `${pluralize(stats.inReview, "task")} waiting for review`, href: taskHref });
    if (stats.total === 0) signals.push({ tone: "neutral", text: "No tasks linked to this project" });
    else signals.push({ tone: stats.done === stats.total ? "ok" : "neutral", text: `${stats.done} of ${pluralize(stats.total, "task")} approved`, href: taskHref });
  } else {
    signals.push({ tone: "neutral", text: "Task list unavailable" });
  }

  const current = pickCurrentVersion(versions);
  const planHref = `/projects/${project.id}?tab=plan`;
  switch (project.status) {
    case "pending_approval": signals.push({ tone: "warn", text: "Proposal awaiting a manager's decision" }); break;
    case "rejected": signals.push({ tone: "danger", text: "Proposal was declined" }); break;
    case "submitted": signals.push({ tone: "info", text: `Plan v${current?.versionNumber ?? "?"} submitted, awaiting review`, href: planHref }); break;
    case "active": case "approved": {
      const approved = versions.find((v) => v.status === "approved");
      signals.push({ tone: "ok", text: `Plan v${approved?.versionNumber ?? current?.versionNumber ?? "?"} approved`, href: planHref });
      const cov = deliverableCoverage(approved?.contentJson ?? current?.contentJson, logs);
      if (cov.total > 0) signals.push({ tone: cov.logged === cov.total ? "ok" : "neutral", text: `${cov.logged} of ${cov.total} deliverables have logs`, href: `/projects/${project.id}?tab=execution` });
      else signals.push({ tone: "neutral", text: "No work logged yet", href: `/projects/${project.id}?tab=execution` });
      break;
    }
    case "planning": signals.push({ tone: "neutral", text: current ? `Plan v${current.versionNumber} is a draft, not submitted` : "Planning, no draft yet", href: planHref }); break;
    default: signals.push({ tone: "neutral", text: current ? `Plan v${current.versionNumber} is a draft, not submitted` : "No plan drafted yet", href: planHref });
  }

  const required = criteria.filter((c) => !c.optional);
  if (criteria.length === 0) signals.push({ tone: "neutral", text: "Definition of done not written yet" });
  else {
    const met = required.filter((c) => c.completed).length;
    signals.push({ tone: required.length > 0 && met === required.length ? "ok" : "neutral", text: `${met} of ${pluralize(required.length, "required criterion", "required criteria")} met` });
  }

  let headline = "Nothing needs attention"; let tone: Tone = "ok";
  if ((stats?.overdue ?? 0) > 0 || (stats?.blocked ?? 0) > 0) { headline = "Needs attention"; tone = "danger"; }
  else if (project.status === "pending_approval") { headline = "Waiting on a decision"; tone = "warn"; }
  else if (project.status === "rejected") { headline = "Not going ahead"; tone = "danger"; }
  else if (project.status === "submitted") { headline = "Waiting on plan review"; tone = "info"; }
  else if (project.status === "assigned" || project.status === "planning") { headline = current ? "Still planning" : "Not started"; tone = "neutral"; }
  else if (!stats) { headline = "Partly known"; tone = "neutral"; }

  return { headline, tone, signals };
}

export function ProjectHealth({ project, stats, versions, criteria, logs }: { project: Project; stats: TaskStats | undefined; versions: PlanVersion[]; criteria: Criterion[]; logs: WeeklyLog[] }) {
  const h = computeHealth(project, stats, versions, criteria, logs);
  return (
    <Section title="Health" description="Read from tasks, plan status, criteria and logs. Not a score.">
      <div className="flex items-center gap-2">
        <Dot tone={h.tone} />
        <p className={cn("text-[13px] font-medium", h.tone === "neutral" ? "text-ink" : toneClasses[h.tone].text)}>{h.headline}</p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {h.signals.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-[13px] text-ink-2">
            <Dot tone={s.tone} className="mt-[7px]" />
            {s.href ? <Link href={s.href} className="hover:text-ink hover:underline underline-offset-2">{s.text}</Link> : <span>{s.text}</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
