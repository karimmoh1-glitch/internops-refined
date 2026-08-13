import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LogoMark from "@/components/logo-mark";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

const STEPS = [
  {
    n: "01",
    title: "Sign up & invite",
    desc: "Create your workspace and send secure invite links. Interns set their own password — nobody shares a login.",
  },
  {
    n: "02",
    title: "Assign real work",
    desc: "Give interns an actual project with a clear goal. AI helps them turn it into a week-by-week execution plan you approve.",
  },
  {
    n: "03",
    title: "Track & mentor",
    desc: "Weekly logs, hour tracking, and direct feedback on their plan — so nothing falls through the cracks by week six.",
  },
];

export default function Landing() {
  useScrollReveal();

  return (
    <div className="min-h-screen bg-[#0B0A09] flex flex-col">
      {/* Nav */}
      <nav className="bg-[#0B0A09]/90 backdrop-blur-xl border-b border-white/[0.08] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xl font-bold font-heading text-white" data-testid="link-logo">
            <LogoMark size={32} />
            InternOps
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-white/60 hover:text-white hover:bg-white/5" data-testid="button-login">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-white hover:bg-white/85 text-[#0B0A09]" data-testid="button-signup">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(109,94,245,0.16),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-white/60 uppercase tracking-wider" data-reveal>
                Internship management, done right
              </div>
              <h1
                className="font-serif font-medium text-white text-5xl md:text-6xl leading-[1.08] mb-6"
                data-testid="text-hero-title"
                data-reveal
                style={{ transitionDelay: "60ms" }}
              >
                Give your interns
                <br />
                a program worth{" "}
                <span className="italic font-light text-[#8B7FF7]" style={{ fontStyle: "italic" }}>bragging about</span>.
              </h1>
              <p
                className="text-lg text-white/55 mb-9 leading-relaxed max-w-md"
                data-testid="text-hero-subtitle"
                data-reveal
                style={{ transitionDelay: "120ms" }}
              >
                Onboard, assign real projects, and track progress — without the spreadsheet chaos. Built for teams who actually mentor.
              </p>
              <div className="flex items-center gap-4" data-reveal style={{ transitionDelay: "180ms" }}>
                <Link href="/signup">
                  <Button size="lg" className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white rounded-full py-6 px-8 text-base shadow-lg shadow-[#6D5EF5]/30 hover:shadow-xl hover:shadow-[#6D5EF5]/40 hover:scale-[1.02] transition-all duration-300" data-testid="button-get-started">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-5 mt-8 text-sm text-white/40" data-reveal style={{ transitionDelay: "220ms" }}>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#8B7FF7]" />Free to start</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#8B7FF7]" />No credit card</span>
              </div>
            </div>

            <div className="relative" data-reveal style={{ transitionDelay: "100ms" }}>
              <div className="relative rounded-[28px] overflow-hidden shadow-2xl shadow-black/40 ring-1 ring-white/10 aspect-[4/5]">
                <img
                  src="https://images.unsplash.com/photo-1757744705465-ea08b0ddc38a?auto=format&fit=crop&w=1600&q=90"
                  alt="Soliman K., a software intern, smiling"
                  className="w-full h-full object-cover"
                  data-testid="img-hero-intern"
                />
              </div>
              <div className="absolute -bottom-5 -left-5 bg-[#171412] rounded-2xl border border-white/10 shadow-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#6D5EF5]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#8B7FF7]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white leading-tight">Soliman K.</p>
                  <p className="text-xs text-white/40 leading-tight">Software Intern · Week 6</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — editorial list, not icon cards */}
      <section className="bg-[#111010] border-t border-white/[0.08]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <h2 className="font-serif font-medium text-3xl md:text-4xl text-white mb-16 max-w-lg" data-reveal>
            Three steps. No spreadsheets, no guesswork.
          </h2>
          <div className="space-y-14">
            {STEPS.map((step, i) => (
              <div key={step.n} className="grid md:grid-cols-[100px_1fr] gap-4 md:gap-10 items-start" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="font-serif text-5xl text-white/15">{step.n}</span>
                <div className="border-t border-white/[0.08] pt-5 md:border-t-0 md:pt-0">
                  <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                  <p className="text-white/50 leading-relaxed max-w-lg">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative bg-[#0B0A09] border-t border-white/[0.08] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(109,94,245,0.14),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-6 py-24 text-center" data-reveal>
          <h2 className="font-serif font-medium text-4xl md:text-5xl text-white mb-6 leading-tight">
            Your next great hire might already be your intern.
          </h2>
          <p className="text-white/45 mb-10 max-w-lg mx-auto">
            Give them a real program to prove it.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white rounded-full py-6 px-10 text-base shadow-lg shadow-[#6D5EF5]/30 hover:scale-[1.02] transition-all duration-300" data-testid="button-get-started-footer">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B0A09] border-t border-white/[0.08] py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-base font-bold text-white font-heading">
            <LogoMark size={24} rounded="md" />
            InternOps
          </div>
          <div className="flex items-center gap-5 text-xs text-white/40">
            <Link href="/privacy" className="hover:text-white/70 transition-colors no-underline" data-testid="link-privacy">Privacy</Link>
            <Link href="/terms" className="hover:text-white/70 transition-colors no-underline" data-testid="link-terms">Terms</Link>
            <Link href="/contact" className="hover:text-white/70 transition-colors no-underline" data-testid="link-contact">Contact</Link>
          </div>
          <p className="text-xs text-white/30">&copy; 2026 InternOps. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
