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
    <div className="min-h-screen bg-[#FAF7F2] flex flex-col">
      {/* Nav */}
      <nav className="bg-[#FAF7F2]/90 backdrop-blur-xl border-b border-black/[0.06] sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xl font-bold font-heading text-[#141110]" data-testid="link-logo">
            <LogoMark size={32} />
            InternOps
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[#141110]/70 hover:text-[#141110] hover:bg-black/5" data-testid="button-login">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-[#141110] hover:bg-[#2A2624] text-white" data-testid="button-signup">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{ backgroundImage: "radial-gradient(circle, rgba(20,17,16,0.08) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
        />
        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid md:grid-cols-2 gap-14 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 bg-white border border-black/[0.08] rounded-full text-xs font-semibold text-[#141110]/70 uppercase tracking-wider" data-reveal>
                Internship management, done right
              </div>
              <h1
                className="font-serif font-medium text-[#141110] text-5xl md:text-6xl leading-[1.08] mb-6"
                data-testid="text-hero-title"
                data-reveal
                style={{ transitionDelay: "60ms" }}
              >
                Give your interns
                <br />
                a program worth{" "}
                <span className="italic font-light" style={{ fontStyle: "italic" }}>bragging about</span>.
              </h1>
              <p
                className="text-lg text-[#141110]/60 mb-9 leading-relaxed max-w-md"
                data-testid="text-hero-subtitle"
                data-reveal
                style={{ transitionDelay: "120ms" }}
              >
                Onboard, assign real projects, and track progress — without the spreadsheet chaos. Built for teams who actually mentor.
              </p>
              <div className="flex items-center gap-4" data-reveal style={{ transitionDelay: "180ms" }}>
                <Link href="/signup">
                  <Button size="lg" className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white rounded-full py-6 px-8 text-base shadow-lg shadow-[#6D5EF5]/20 hover:shadow-xl hover:shadow-[#6D5EF5]/30 hover:scale-[1.02] transition-all duration-300" data-testid="button-get-started">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
              <div className="flex items-center gap-5 mt-8 text-sm text-[#141110]/50" data-reveal style={{ transitionDelay: "220ms" }}>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#6D5EF5]" />Free to start</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#6D5EF5]" />No credit card</span>
              </div>
            </div>

            <div className="relative" data-reveal style={{ transitionDelay: "100ms" }}>
              <div className="relative rounded-[28px] overflow-hidden shadow-2xl shadow-black/10 aspect-[4/5]">
                <img
                  src="https://images.unsplash.com/photo-1612299273045-362a39972259?auto=format&fit=crop&w=900&q=80"
                  alt="Jordan, a software intern, laughing while working on a laptop"
                  className="w-full h-full object-cover"
                  data-testid="img-hero-intern"
                />
              </div>
              <div className="absolute -bottom-5 -left-5 bg-white rounded-2xl border border-black/[0.06] shadow-xl px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#6D5EF5]/15 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-[#6D5EF5]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#141110] leading-tight">Jordan</p>
                  <p className="text-xs text-[#141110]/50 leading-tight">Software Intern · Week 6</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — editorial list, not icon cards */}
      <section className="bg-white border-t border-black/[0.06]">
        <div className="max-w-4xl mx-auto px-6 py-24">
          <h2 className="font-serif font-medium text-3xl md:text-4xl text-[#141110] mb-16 max-w-lg" data-reveal>
            Three steps. No spreadsheets, no guesswork.
          </h2>
          <div className="space-y-14">
            {STEPS.map((step, i) => (
              <div key={step.n} className="grid md:grid-cols-[100px_1fr] gap-4 md:gap-10 items-start" data-reveal style={{ transitionDelay: `${i * 90}ms` }}>
                <span className="font-serif text-5xl text-[#141110]/15">{step.n}</span>
                <div className="border-t border-black/[0.08] pt-5 md:border-t-0 md:pt-0">
                  <h3 className="text-xl font-semibold text-[#141110] mb-2">{step.title}</h3>
                  <p className="text-[#141110]/55 leading-relaxed max-w-lg">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA — dark band for contrast */}
      <section className="bg-[#141110]">
        <div className="max-w-4xl mx-auto px-6 py-24 text-center" data-reveal>
          <h2 className="font-serif font-medium text-4xl md:text-5xl text-white mb-6 leading-tight">
            Your next great hire might already be your intern.
          </h2>
          <p className="text-white/50 mb-10 max-w-lg mx-auto">
            Give them a real program to prove it.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white rounded-full py-6 px-10 text-base shadow-lg shadow-[#6D5EF5]/20 hover:scale-[1.02] transition-all duration-300" data-testid="button-get-started-footer">
              Get Started Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#141110] border-t border-white/10 py-8">
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
