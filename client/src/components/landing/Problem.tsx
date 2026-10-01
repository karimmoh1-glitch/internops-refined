import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, StatusBadge } from "@/components/kit";
import { Container, Eyebrow, Lede, SectionTitle } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { WorkingChip } from "./mocks/primitives";
import { SAMPLE_PEOPLE } from "./mocks/sample-data";

function Scrap({ className, children, rotate }: { className?: string; children: React.ReactNode; rotate: string }) {
  return (
    <div className={cn("panel-sunken w-full max-w-[260px] p-3 text-[11.5px] leading-snug text-ink-2 md:absolute", rotate, className)} aria-hidden>
      {children}
    </div>
  );
}

/** Where status lives today, and the one row it collapses into. */
export function Problem() {
  return (
    <section className="border-t border-line py-20 md:py-28" aria-labelledby="problem-title">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal>
            <Eyebrow>The problem</Eyebrow>
            <SectionTitle className="mt-3"><span id="problem-title">Status lives everywhere except where the work is.</span></SectionTitle>
            <Lede className="mt-4">
              A manager with six interns reads a chat thread, a tracker spreadsheet, a calendar of check-ins and a timesheet to answer one question: what is actually happening? Each source is a claim about the work. None of them is the work.
            </Lede>
            <Lede className="mt-3">
              InternOps keeps the task, its status, its owner, the shift it was worked in and the evidence in one record. The question answers itself.
            </Lede>
          </Reveal>

          <Reveal delay={80}>
            <div className="relative flex flex-col items-center gap-3 md:block md:h-[420px]">
              <Scrap rotate="md:-rotate-3" className="md:left-0 md:top-2">
                <div className="mb-1.5 flex items-center justify-between text-[10.5px] text-ink-3"><span>#interns</span><span className="t-num">9:41</span></div>
                <p><span className="font-medium text-ink">Dana M.</span> any update on the onboarding email?</p>
                <p className="mt-1"><span className="font-medium text-ink">Jonah K.</span> I think Maya had it? or Theo</p>
              </Scrap>

              <Scrap rotate="md:rotate-2" className="md:left-[200px] md:top-[88px] md:max-w-[300px]">
                <div className="mb-1.5 truncate text-[10.5px] text-ink-3">intern_tracker_FINAL_v3.xlsx</div>
                <div className="grid grid-cols-[1fr_1.4fr_1fr] overflow-hidden rounded-sm border border-line text-[10.5px]">
                  {["Name", "Task", "Status", "Maya", "Onboarding email", "done??", "Jonah", "Auth routes", "in prog", "Theo", "?", ""].map((c, i) => (
                    <span key={i} className={cn("truncate border-b border-r border-line px-1.5 py-1", i < 3 ? "bg-surface-2 font-medium text-ink-3" : "bg-surface text-ink-2")}>{c || " "}</span>
                  ))}
                </div>
              </Scrap>

              <Scrap rotate="md:-rotate-1" className="md:left-[24px] md:top-[176px] md:max-w-[230px]">
                <div className="flex gap-2">
                  <span className="w-1 shrink-0 rounded-full bg-info" />
                  <div>
                    <div className="font-medium text-ink">Weekly status sync</div>
                    <div className="text-[10.5px] text-ink-3">Mon 10:00 · 30 min · 7 attendees</div>
                  </div>
                </div>
              </Scrap>

              <Scrap rotate="md:rotate-3" className="md:left-[260px] md:top-[246px] md:max-w-[250px]">
                <div className="text-[10.5px] text-ink-3">Jonah K. → Dana M.</div>
                <div className="truncate font-medium text-ink">Re: Re: Re: timesheet (Sept)</div>
                <div className="truncate text-ink-3">hours for last week attached, sorry it's late</div>
              </Scrap>

              <Scrap rotate="md:-rotate-6" className="bg-warn-soft border-warn/20 text-warn md:left-[8px] md:top-[300px] md:max-w-[150px]">
                ask Priya about the blocker
              </Scrap>

              <div className="flex items-center justify-center py-1 text-ink-4 md:hidden" aria-hidden>
                <ArrowDown className="h-5 w-5" />
              </div>

              <div role="img" aria-label="The same status as one InternOps row: Ship onboarding email, in review, owned by Maya R., version 2 submitted at 11:31, with a live Working timer." className="panel pop w-full max-w-[360px] p-3 text-left md:absolute md:bottom-6 md:right-0">
                <div aria-hidden>
                  <div className="flex items-center gap-2">
                    <StatusBadge status="in_review" />
                    <span className="truncate text-[13px] font-medium text-ink">Ship onboarding email</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2"><Avatar name={SAMPLE_PEOPLE.maya} size="xs" working />{SAMPLE_PEOPLE.maya}</span>
                    <span className="t-num text-[11px] text-ink-3">v2 · submitted 11:31</span>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                    <WorkingChip />
                    <span className="text-[11px] text-ink-3">Observed · VS Code</span>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
