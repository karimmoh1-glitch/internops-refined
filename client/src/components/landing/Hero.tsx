import { Link } from "wouter";
import { ArrowRight, ListTodo, FolderKanban, Users, Timer, Laptop, History, Radar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "./SectionHeading";
import { HomeMock, WorkModeCard } from "./mocks";
import { useParallax } from "./scroll";

export const HEADLINE = "Tasks, shifts and reviews for intern teams.";
export const SUBHEAD = "InternOps is one workspace where managers assign and review tasks, interns run Work Mode shifts, and any shift can be replayed. Signals flag what needs attention and Pulse answers questions from the same record.";

/** The nouns a visitor should have within five seconds. Each is a real screen or feature. */
const CAPABILITIES = [
  { icon: ListTodo, label: "Tasks" },
  { icon: FolderKanban, label: "Projects" },
  { icon: Users, label: "People" },
  { icon: Timer, label: "Work Mode" },
  { icon: Laptop, label: "Companion" },
  { icon: History, label: "Workday Replay" },
  { icon: Radar, label: "Signals" },
  { icon: Sparkles, label: "Pulse" },
] as const;

export function Hero() {
  // Two layers, two speeds: the Home screen drifts a little, the Work Mode
  // card floating above it drifts more. Both stop within the hero.
  const screenRef = useParallax<HTMLDivElement>(0.04, 16);
  const cardRef = useParallax<HTMLDivElement>(0.08, 24);

  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-dots mask-fade-b opacity-70" aria-hidden />

      <Container className="relative pt-14 pb-10 text-center md:pt-24 md:pb-12">
        <div className="anim-stagger mx-auto flex max-w-3xl flex-col items-center">
          <p className="t-label mb-5 text-accent">For managers and interns</p>
          <h1 id="hero-title" className="t-display max-w-[20ch] text-balance text-ink">
            Tasks, shifts and reviews for <span className="text-accent">intern teams</span>.
          </h1>
          <p className="mt-5 max-w-[58ch] text-balance text-[16px] leading-[1.6] text-ink-2 md:text-[17.5px]">{SUBHEAD}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/signup">Request access<ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
          </div>
          <p className="t-meta mt-4 max-w-[48ch] text-balance">Access requests are approved by a manager in your workspace. The desktop Companion is optional and observes only during Work Mode.</p>
          <ul className="mt-10 flex max-w-[640px] flex-wrap items-center justify-center gap-x-5 gap-y-2.5 text-[13px] font-medium text-ink-2" aria-label="What is in the workspace">
            {CAPABILITIES.map((c) => (
              <li key={c.label} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <c.icon className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                {c.label}
              </li>
            ))}
          </ul>
        </div>
      </Container>

      <Container wide className="relative pb-16 md:pb-24">
        <div className="relative mx-auto max-w-[1080px]">
          {/* Parallax writes a transform on the outer div; the entrance animation owns the inner one. */}
          <div ref={screenRef}>
            <div className="anim-fade-up [animation-delay:160ms]">
              <HomeMock />
            </div>
          </div>
          <div ref={cardRef} className="hidden lg:block absolute -bottom-12 -right-3 w-[288px]">
            <div className="anim-pop [animation-delay:420ms]">
              <WorkModeCard />
            </div>
          </div>
          <div className="mt-4 lg:hidden mx-auto w-full max-w-[340px] anim-fade-up [animation-delay:300ms]">
            <WorkModeCard />
          </div>
          <p className="t-meta mx-auto mt-4 max-w-[60ch] text-center lg:mx-0 lg:mt-6 lg:text-left">Sample workspace. Names, tasks and timers are illustrative and not connected to real data.</p>
        </div>
      </Container>
    </section>
  );
}
