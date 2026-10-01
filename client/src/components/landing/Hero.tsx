import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "./SectionHeading";
import { HomeMock, WorkModeCard } from "./mocks";

export const HEADLINE = "The operating system for intern teams.";
export const SUBHEAD = "Assign work and review it, see who is working right now, replay any shift, and ask one question to find out what needs you. One workspace, built on what actually happened.";

export function Hero() {
  return (
    <section className="relative overflow-hidden" aria-labelledby="hero-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] grid-dots mask-fade-b opacity-70" aria-hidden />

      <Container className="relative pt-14 pb-10 text-center md:pt-24 md:pb-14">
        <div className="anim-stagger mx-auto flex max-w-3xl flex-col items-center">
          <p className="t-label mb-5 text-accent">Tasks · Work Mode · Replay · Signals · Pulse</p>
          <h1 id="hero-title" className="t-display max-w-[16ch] text-balance text-ink">
            The operating system for <span className="t-serif italic">intern teams</span>.
          </h1>
          <p className="mt-5 max-w-[58ch] text-balance text-[16px] leading-[1.6] text-ink-2 md:text-[17.5px]">{SUBHEAD}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/signup">Request access<ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
          </div>
          <p className="t-meta mt-4 max-w-[48ch] text-balance">Access requests are approved by a manager in your workspace. The desktop Companion is optional and observes only during Work Mode.</p>
        </div>
      </Container>

      <Container wide className="relative pb-16 md:pb-24">
        <div className="relative mx-auto max-w-[1080px]">
          <div className="anim-fade-up [animation-delay:160ms]">
            <HomeMock />
          </div>
          <div className="anim-pop hidden lg:block absolute -bottom-12 -right-3 w-[288px] [animation-delay:420ms]">
            <WorkModeCard />
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
