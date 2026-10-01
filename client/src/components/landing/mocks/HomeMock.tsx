import { Radar, Timer, Eye, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Dot, Stat } from "@/components/kit";
import { AppFrame, MockButton, Row } from "./primitives";
import { SAMPLE_SIGNALS, SAMPLE_WORKING_NOW } from "./sample-data";

/** The manager's Home screen: today's numbers, what needs attention, who is working. */
export function HomeMock({ className }: { className?: string }) {
  return (
    <AppFrame active="Home" label="Sample InternOps Home screen for a manager: four stats, a list of signals that need attention, and the people working right now with their live timers." className={className}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Good morning, Dana</div>
          <div className="text-xs text-ink-3">Tuesday · 3 people working · 4 submissions waiting on you</div>
        </div>
        <MockButton variant="outline" size="xs">Start a review</MockButton>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 @2xl:grid-cols-4">
        <Stat label="Working now" value={3} hint="2 with Companion" tone="work" icon={<Timer />} className="px-3 py-2.5" />
        <Stat label="Waiting on review" value={4} hint="oldest 2d" tone="info" icon={<Eye />} className="px-3 py-2.5" />
        <Stat label="Overdue" value={1} hint="Ship onboarding email" tone="danger" icon={<AlertTriangle />} className="px-3 py-2.5" />
        <Stat label="Sessions today" value={7} hint="9h 12m total" icon={<Radar />} className="px-3 py-2.5" />
      </div>

      <div className="mt-3 grid gap-3 @2xl:grid-cols-[1.35fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 hairline-b">
            <span className="t-section">Needs your attention</span>
            <span className="text-[11px] text-ink-3">4 signals</span>
          </div>
          {SAMPLE_SIGNALS.slice(0, 3).map((s) => (
            <Row key={s.headline}>
              <Dot tone={s.severity === "high" ? "danger" : "warn"} className="mt-0.5 self-start" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-ink">{s.headline}</div>
                <div className="truncate text-[11px] text-ink-3">{s.evidence}</div>
              </div>
              <MockButton variant="outline" size="xs" className="hidden @xl:inline-flex">{s.actions[0]}</MockButton>
            </Row>
          ))}
        </section>

        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 hairline-b">
            <span className="t-section">Working now</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-work"><Dot tone="work" pulse />Live</span>
          </div>
          {SAMPLE_WORKING_NOW.map((w) => (
            <Row key={w.name}>
              <Avatar name={w.name} size="sm" working />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] font-medium text-ink">{w.name}</div>
                <div className={cn("truncate text-[11px]", w.observed ? "text-ink-3" : "text-ink-4")}>{w.observed ?? "No Companion observation"}</div>
              </div>
              <span className="t-num text-[11px] text-ink-2">{w.since}</span>
            </Row>
          ))}
        </section>
      </div>
    </AppFrame>
  );
}
