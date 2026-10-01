import { Check } from "lucide-react";
import { Avatar, Dot, Pill, StatusBadge } from "@/components/kit";
import { AppFrame, MockButton, Row } from "./primitives";
import { SAMPLE_PEOPLE, SAMPLE_SIGNALS } from "./sample-data";

const APPROVALS = [
  { title: "Ship onboarding email", by: SAMPLE_PEOPLE.maya, meta: "v2 · submitted 11:31" },
  { title: "Draft Q4 docs refresh plan", by: SAMPLE_PEOPLE.priya, meta: "v1 · submitted yesterday" },
];

/** Manager Signals with their evidence, and the approvals queue beside them. */
export function SignalsMock({ className }: { className?: string }) {
  return (
    <AppFrame active="Signals" label="Sample Signals screen: four signals, each with a severity, a headline, the evidence behind it and actions; beside it, two submissions waiting on review with approve and request-changes buttons." caption="Sample signals. Each one is a condition the data can show, with its evidence attached." className={className}>
      <div className="grid gap-3 @3xl:grid-cols-[1.5fr_1fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 hairline-b">
            <span className="t-section">Signals</span>
            <span className="flex items-center gap-2 text-[11px] text-ink-3"><span className="inline-flex items-center gap-1"><Dot tone="danger" />2 high</span><span className="inline-flex items-center gap-1"><Dot tone="warn" />2 medium</span></span>
          </div>
          {SAMPLE_SIGNALS.map((s) => (
            <Row key={s.headline} className="items-start py-3">
              <Dot tone={s.severity === "high" ? "danger" : "warn"} className="mt-1.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-ink">{s.headline}</div>
                <div className="mt-0.5 text-[11.5px] text-ink-3">{s.evidence}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-2"><Avatar name={s.person} size="xs" />{s.person}</span>
                  <span className="mx-1 h-3 w-px bg-line" />
                  {s.actions.map((a) => <MockButton key={a} variant="outline" size="xs">{a}</MockButton>)}
                  <MockButton variant="ghost" size="xs" className="text-ink-3">Snooze</MockButton>
                </div>
              </div>
            </Row>
          ))}
        </section>

        <section className="panel overflow-hidden self-start">
          <div className="flex items-center justify-between px-3 py-2 hairline-b">
            <span className="t-section">Waiting on your review</span>
            <Pill tone="info">2</Pill>
          </div>
          {APPROVALS.map((a) => (
            <div key={a.title} className="px-3 py-3 border-b border-line last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-medium text-ink">{a.title}</div>
                  <div className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] text-ink-3"><Avatar name={a.by} size="xs" />{a.by} · {a.meta}</div>
                </div>
                <StatusBadge status="in_review" iconOnly className="mt-1" />
              </div>
              <div className="mt-2.5 flex items-center gap-1.5">
                <MockButton size="xs"><Check />Approve</MockButton>
                <MockButton variant="outline" size="xs">Request changes</MockButton>
              </div>
            </div>
          ))}
        </section>
      </div>
    </AppFrame>
  );
}
