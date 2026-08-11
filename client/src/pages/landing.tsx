import {
  Sparkles, BarChart3, Brain,
  Shield, Users, UserPlus, ArrowRight,
  Zap, TrendingUp, CheckCircle2, Briefcase, GraduationCap
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col overflow-hidden">
      {/* Nav */}
      <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-xl font-bold font-heading text-white" data-testid="link-logo">
            <div className="w-8 h-8 bg-gradient-to-br from-[#EF7878] to-[#e05555] rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-[#EF7878]/20">I</div>
            InternOps
          </div>
          <div className="flex items-center gap-3">
            <Link href="/manager-login">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5" data-testid="button-manager-login">
                <Briefcase className="w-4 h-4 mr-1.5" />
                Manager Login
              </Button>
            </Link>
            <Link href="/intern-login">
              <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-white hover:bg-white/5" data-testid="button-intern-login">
                <GraduationCap className="w-4 h-4 mr-1.5" />
                Intern Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex-1">
        {/* Glow effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(239,120,120,0.12),transparent)]" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[#EF7878]/8 via-purple-500/5 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-gradient-to-tr from-blue-500/5 via-indigo-500/5 to-transparent rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-16 md:pt-28 md:pb-24">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-zinc-300 font-medium" data-testid="text-hero-badge">
              <Sparkles className="w-3.5 h-3.5 text-[#EF7878]" />
              AI-Powered Intern Management
            </div>
          </div>

          {/* Heading */}
          <h1 className="text-center text-5xl md:text-7xl font-bold font-heading text-white mb-6 leading-[1.1] tracking-tight" data-testid="text-hero-title">
            Supercharge Your
            <br />
            <span className="bg-gradient-to-r from-[#EF7878] via-[#f0a0a0] to-[#EF7878] bg-clip-text text-transparent">
              Internship Program
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-center text-lg md:text-xl text-zinc-400 mb-12 leading-relaxed max-w-2xl mx-auto" data-testid="text-hero-subtitle">
            The modern platform where managers onboard interns, assign projects, and track progress — all enhanced with AI.
          </p>

          {/* Single CTA */}
          <div className="flex justify-center mb-20">
            <Link href="/signup">
              <Button size="lg" className="bg-gradient-to-r from-[#EF7878] to-[#e05555] hover:from-[#e86868] hover:to-[#d54545] text-white rounded-full py-6 px-10 text-base shadow-lg shadow-[#EF7878]/20 hover:shadow-xl hover:shadow-[#EF7878]/30 transition-all duration-300" data-testid="button-get-started">
                Get Started Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto mb-20">
            <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500" data-testid="card-benefit-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/20">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">AI Planning Assistant</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">Interns build smart execution plans with AI guidance. Managers review and approve with one click.</p>
            </div>
            <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500" data-testid="card-benefit-1">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-emerald-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Secure Onboarding</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">Token-based invite links with 48h expiry. Interns set their own password — no shared credentials.</p>
            </div>
            <div className="group bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-500" data-testid="card-benefit-2">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-amber-500/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-semibold text-white mb-1.5">Progress Tracking</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">Weekly logs, hour tracking, and targeted feedback keep everyone aligned and accountable.</p>
            </div>
          </div>

          {/* How it works */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-white font-heading mb-3" data-testid="text-how-it-works">How It Works</h2>
            <p className="text-center text-zinc-500 mb-10 text-sm">Four simple steps to a better internship program</p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { step: "01", title: "Sign Up", desc: "Create your company account in seconds.", icon: UserPlus, color: "from-blue-500 to-blue-600", glow: "shadow-blue-500/20" },
                { step: "02", title: "Invite Interns", desc: "Send secure invite links via email.", icon: Users, color: "from-indigo-500 to-indigo-600", glow: "shadow-indigo-500/20" },
                { step: "03", title: "Assign Projects", desc: "Set goals. AI helps interns plan.", icon: Zap, color: "from-violet-500 to-violet-600", glow: "shadow-violet-500/20" },
                { step: "04", title: "Track & Review", desc: "Monitor progress. Give feedback.", icon: BarChart3, color: "from-purple-500 to-purple-600", glow: "shadow-purple-500/20" },
              ].map((item) => (
                <div key={item.step} className="group relative bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 text-center hover:bg-white/[0.05] hover:border-white/10 transition-all duration-300">
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
          <div className="mt-20 max-w-2xl mx-auto">
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
            <div className="w-6 h-6 bg-gradient-to-br from-[#EF7878] to-[#e05555] rounded flex items-center justify-center text-white font-bold text-xs">I</div>
            InternOps
          </div>
          <p className="text-xs text-zinc-600">&copy; 2026 InternOps. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
