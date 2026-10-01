import { Link } from "wouter";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Container, Eyebrow, Lede, SectionTitle } from "./SectionHeading";
import { Reveal } from "./Reveal";

const PHASES = [
  { label: "Before Work Mode", body: "Nothing. The Companion sits idle and sends nothing.", active: false },
  { label: "During Work Mode", body: "Four fields, reported while the shift is on: foreground app, window title, document name, browser hostname.", active: true },
  { label: "After End Shift", body: "Collection stops. A report that arrives after the shift ended is rejected by the server.", active: false },
];

const COLLECTED = ["Foreground app", "Window title", "Document name", "Browser hostname"];
const NEVER = ["Keystrokes", "Clipboard", "Screenshots", "Full URLs"];

/** What the Companion observes, and exactly when. */
export function PrivacyBoundary() {
  return (
    <section className="border-t border-line bg-surface py-20 md:py-28" aria-labelledby="privacy-title">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
          <Reveal className="max-w-[46ch]">
            <Eyebrow>The boundary</Eyebrow>
            <SectionTitle className="mt-3"><span id="privacy-title">Observation starts and ends with the shift.</span></SectionTitle>
            <Lede className="mt-4">
              The Companion is a Work Mode tool, not a monitor. It reports a short list of fields while a shift is running and nothing otherwise, and the server holds the line on both ends.
            </Lede>
            <Link href="/privacy" className="mt-5 inline-flex items-center text-[14px] font-medium text-accent underline-offset-4 hover:underline">Read the privacy notice</Link>
          </Reveal>

          <Reveal delay={60}>
            <div className="panel-sunken overflow-hidden" role="img" aria-label="A shift drawn as a bar: nothing is collected before Start shift, four fields are observed between Start shift and End shift, and nothing is collected after.">
              <div aria-hidden className="px-5 pt-5">
                <div className="relative h-8">
                  <div className="absolute inset-y-[14px] left-0 right-0 border-t border-dashed border-line-strong" />
                  <div className="absolute inset-y-[11px] left-[26%] right-[26%] rounded-full bg-work/90" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <span key={i} className="absolute top-[9px] h-[10px] w-px bg-work-ink/60" style={{ left: `calc(26% + ${(i + 0.5) * (48 / 8)}%)` }} />
                  ))}
                  <span className="absolute left-[26%] top-[11px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-bg-sunken" />
                  <span className="absolute right-[26%] top-[11px] h-2.5 w-2.5 translate-x-1/2 rounded-full bg-ink ring-2 ring-bg-sunken" />
                </div>
                <div className="relative mb-4 h-4 text-[11px] font-medium text-ink">
                  <span className="absolute left-[26%] -translate-x-1/2 whitespace-nowrap">Start shift</span>
                  <span className="absolute right-[26%] translate-x-1/2 whitespace-nowrap">End shift</span>
                </div>
              </div>

              <div className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
                {PHASES.map((p) => (
                  <div key={p.label} className={cn("p-4", p.active ? "bg-work-soft" : "bg-surface")}>
                    <div className={cn("t-label", p.active && "text-work")}>{p.label}</div>
                    <p className="mt-2 text-[13px] leading-[1.55] text-ink-2">{p.body}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
                <div className="bg-surface p-4">
                  <div className="t-label mb-2.5">Collected during a shift</div>
                  <ul className="space-y-1.5 text-[13px] text-ink">
                    {COLLECTED.map((c) => <li key={c} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-work" aria-hidden />{c}</li>)}
                  </ul>
                </div>
                <div className="bg-surface p-4">
                  <div className="t-label mb-2.5">Never, at any time</div>
                  <ul className="space-y-1.5 text-[13px] text-ink-2">
                    {NEVER.map((c) => <li key={c} className="flex items-center gap-2"><Minus className="h-3.5 w-3.5 text-ink-4" aria-hidden />{c}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
