import {
  Sparkles, BarChart3, Brain,
  Shield, Users, UserPlus, ArrowRight,
  Zap, TrendingUp, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LogoMark from "@/components/logo-mark";
import { useScrollReveal } from "@/hooks/use-scroll-reveal";

export default function Landing() {
  useScrollReveal();

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col overflow-hidden">
      {/* Nav */}
      <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xl font-bold font-heading text-white" data-testid="link-logo">
            <LogoMark size={32} />
            InternOps
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5" data-testid="button-login">
                Log In
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-signup">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex-1">
        {/* Glow effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(109,94,245,0.16),transparent)]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#6D5EF5]/10 via-purple-500/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/5 via-indigo-500/5 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-16 md:pt-36 md:pb-24">
          {/* Badge */}
          <div className="flex justify-center mb-8" data-reveal>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-zinc-300 font-medium" data-testid="text-hero-badge">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#6D5EF5] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#8B7FF7]" />
              </span>
              AI-Powered Intern Management
            </div>
          </div>

          {/* Heading */}
          <h1
            className="text-center text-6xl md:text-8xl font-bold font-heading text-white mb-7 leading-[1.05] tracking-tight"
            data-testid="text-hero-title"
            data-reveal
            style={{ transitionDelay: "80ms" }}
          >
            Supercharge Your
            <br />
            <span className="bg-gradient-to-r from-[#8B7FF7] via-[#6D5EF5] to-[#8B7FF7] bg-clip-text text-transparent">
              Internship Program
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-center text-xl md:text-2xl text-zinc-400 mb-12 leading-relaxed max-w-2xl mx-auto font-light"
            data-testid="text-hero-subtitle"
            data-reveal
            style={{ transitionDelay: "160ms" }}
          >
            The modern platform where admins onboard interns, assign projects, and track progress — all enhanced with AI.
          </p>

          {/* Single CTA */}
          <div className="flex justify-center mb-24" data-reveal style={{ transitionDelay: "220ms" }}>
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-[#6D5EF5] to-[#5142D6] hover:from-[#8B7FF7] hover:to-[#4335B0] text-white rounded-full py-7 px-12 text-lg shadow-lg shadow-[#6D5EF5]/25 hover:shadow-xl hover:shadow-[#6D5EF5]/40 hover:scale-[1.03] transition-all duration-300" data-testid="button-get-started">
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-24">
            {[
              { icon: Brain, title: "AI Planning Assistant", desc: "Interns build smart execution plans with AI guidance. Admins review and approve with one click.", color: "from-blue-500 to-blue-600", glow: "shadow-blue-500/20" },
              { icon: Shield, title: "Secure Onboarding", desc: "Token-based invite links with 48h expiry. Interns set their own password — no shared credentials.", color: "from-emerald-500 to-emerald-600", glow: "shadow-emerald-500/20" },
              { icon: TrendingUp, title: "Progress Tracking", desc: "Weekly logs, hour tracking, and targeted feedback keep everyone aligned and accountable.", color: "from-amber-500 to-amber-600", glow: "shadow-amber-500/20" },
            ].map((card, i) => (
              <div
                key={card.title}
                className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 hover:-translate-y-1 transition-all duration-500"
                data-testid={`card-benefit-${i}`}
                data-reveal
                style={{ transitionDelay: `${i * 90}ms` }}
              >
                <div className={`w-10 h-10 bg-gradient-to-br ${card.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg ${card.glow}`}>
                  <card.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-base font-semibold text-white mb-1.5">{card.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white font-heading mb-3" data-testid="text-how-it-works" data-reveal>How It Works</h2>
            <p className="text-center text-zinc-500 mb-10 text-sm" data-reveal style={{ transitionDelay: "60ms" }}>Four simple steps to a better internship program</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: "01", title: "Sign Up", desc: "Create your account in seconds.", icon: UserPlus, color: "from-blue-500 to-blue-600", glow: "shadow-blue-500/20" },
                { step: "02", title: "Invite Interns", desc: "Send secure invite links via email.", icon: Users, color: "from-indigo-500 to-indigo-600", glow: "shadow-indigo-500/20" },
                { step: "03", title: "Assign Projects", desc: "Set goals. AI helps interns plan.", icon: Zap, color: "from-violet-500 to-violet-600", glow: "shadow-violet-500/20" },
                { step: "04", title: "Track & Review", desc: "Monitor progress. Give feedback.", icon: BarChart3, color: "from-purple-500 to-purple-600", glow: "shadow-purple-500/20" },
              ].map((item, i) => (
                <div
                  key={item.step}
                  className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 hover:-translate-y-1 transition-all duration-300"
                  data-reveal
                  style={{ transitionDelay: `${i * 90}ms` }}
                >
                  <div className={`w-11 h-11 bg-gradient-to-br ${item.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg ${item.glow}`}>
                    <item.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Step {item.step}</span>
                  <h3 className="text-sm font-semibold text-white mt-1 mb-1">{item.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Social proof strip */}
          <div className="mt-24 max-w-2xl mx-auto" data-reveal>
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Free to get started</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Set up in under 2 minutes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#09090b] border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-base font-bold text-white font-heading">
            <LogoMark size={24} rounded="md" />
            InternOps
          </div>
          <div className="flex items-center gap-5 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors no-underline" data-testid="link-privacy">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors no-underline" data-testid="link-terms">Terms</Link>
            <Link href="/contact" className="hover:text-zinc-300 transition-colors no-underline" data-testid="link-contact">Contact</Link>
          </div>
          <p className="text-xs text-zinc-600">&copy; 2026 InternOps. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
