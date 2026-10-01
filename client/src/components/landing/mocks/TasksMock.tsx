import { Check, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Pill, PriorityMark, StatusBadge, Timeline, TimelineItem } from "@/components/kit";
import { AppFrame, MockButton } from "./primitives";
import { SAMPLE_PEOPLE, SAMPLE_PLAN_WEEKS, SAMPLE_SUBMISSIONS } from "./sample-data";

const LIFECYCLE: { label: string; state: "done" | "current" | "next" }[] = [
  { label: "To do", state: "done" },
  { label: "In progress", state: "done" },
  { label: "In review", state: "current" },
  { label: "Changes requested", state: "next" },
  { label: "Approved", state: "next" },
];

/** Task detail with the review lifecycle and submission history; a project plan beside it. */
export function TasksMock({ className }: { className?: string }) {
  return (
    <AppFrame active="Tasks" label="Sample task detail: Ship onboarding email is in review, with a lifecycle stepper, three submission entries including one round of requested changes, and approve or request-changes actions. Beside it, a project plan awaiting review." caption="Sample task and plan. Names and dates are illustrative." className={className}>
      <div className="grid gap-3 @3xl:grid-cols-[1.5fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="px-4 pt-3 pb-3 hairline-b">
            <div className="text-[11px] text-ink-3">Tasks / Onboarding</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Ship onboarding email</h3>
              <StatusBadge status="in_review" />
              <PriorityMark priority="high" withLabel />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
              <span className="inline-flex items-center gap-1.5"><Avatar name={SAMPLE_PEOPLE.maya} size="xs" />{SAMPLE_PEOPLE.maya}</span>
              <span>Due Sep 26</span>
              <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />5 comments</span>
            </div>
          </div>

          <div className="px-4 py-3 hairline-b">
            <ol className="grid grid-cols-5 gap-1" aria-label="Review lifecycle">
              {LIFECYCLE.map((s) => (
                <li key={s.label} className="min-w-0">
                  <div className={cn("h-1 rounded-full", s.state === "done" ? "bg-ink-3" : s.state === "current" ? "bg-accent" : "bg-line")} />
                  <div className={cn("mt-1.5 truncate text-[10.5px] leading-tight", s.state === "current" ? "font-medium text-ink" : s.state === "done" ? "text-ink-2" : "text-ink-4")}>{s.label}</div>
                </li>
              ))}
            </ol>
          </div>

          <div className="px-4 py-3">
            <div className="t-label mb-3">Submissions</div>
            <Timeline className="space-y-3.5">
              {SAMPLE_SUBMISSIONS.map((s, i) => (
                <TimelineItem
                  key={i}
                  tone={s.kind === "submitted" ? "info" : "warn"}
                  icon={s.kind === "submitted" ? <Check /> : <MessageSquare />}
                  title={<span className="text-[12.5px]"><span className="font-medium">{s.kind === "submitted" ? `Submitted ${s.version}` : "Changes requested"}</span><span className="text-ink-3"> · {s.by}</span></span>}
                  meta={s.when}
                >
                  <span className="text-[12px] text-ink-2">{s.note}</span>
                </TimelineItem>
              ))}
            </Timeline>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2 px-4 py-2.5">
            <span className="flex-1 min-w-[140px] truncate rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-4">Leave a comment…</span>
            <MockButton variant="outline" size="sm">Request changes</MockButton>
            <MockButton size="sm"><Check />Approve</MockButton>
          </div>
        </section>

        <section className="panel overflow-hidden self-start">
          <div className="px-3 py-2.5 hairline-b">
            <div className="flex items-center justify-between gap-2">
              <span className="t-section truncate">Q4 docs refresh</span>
              <Pill tone="info">Plan in review</Pill>
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-pulse"><Sparkles className="h-3 w-3" />AI-drafted · awaiting Dana's review</div>
          </div>
          <ol>
            {SAMPLE_PLAN_WEEKS.map((w) => (
              <li key={w.week} className="flex items-center gap-3 px-3 py-2 border-b border-line last:border-b-0">
                <span className="t-num w-12 shrink-0 text-[10.5px] text-ink-3">{w.week}</span>
                <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{w.title}</span>
                <span className="t-num text-[10.5px] text-ink-3">{w.tasks} tasks</span>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 bg-surface-2 px-3 py-2">
            <MockButton variant="outline" size="xs">Edit plan</MockButton>
            <MockButton size="xs">Approve plan</MockButton>
          </div>
        </section>
      </div>
    </AppFrame>
  );
}
