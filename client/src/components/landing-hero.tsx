import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ClipboardList, Sparkles, BarChart3, Star, TrendingUp, CheckCircle2 } from "lucide-react";

function DashboardMockup() {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200/50 p-4 w-full">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-amber-400" />
        <div className="w-3 h-3 rounded-full bg-emerald-400" />
        <span className="ml-2 text-xs text-slate-400 font-medium">ForgeFlow Dashboard</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: "Logs", value: "127", icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
          { label: "Summaries", value: "18", icon: Sparkles, color: "text-emerald-600 bg-emerald-50" },
          { label: "Avg Rating", value: "4.8", icon: Star, color: "text-amber-600 bg-amber-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-50 rounded-lg p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-5 h-5 rounded flex items-center justify-center ${stat.color}`}>
                <stat.icon className="w-3 h-3" />
              </div>
              <span className="text-[10px] text-slate-500">{stat.label}</span>
            </div>
            <span className="text-lg font-bold text-slate-900">{stat.value}</span>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs font-semibold text-slate-700">AI Weekly Summary</span>
        </div>
        <p className="text-[11px] text-slate-600 leading-relaxed">
          Strong progress on React components and API integration. Completed 3 major features ahead of schedule...
        </p>
        <div className="flex gap-1.5 mt-2">
          {["React", "API", "TypeScript"].map((tag) => (
            <span key={tag} className="text-[9px] bg-white/80 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">{tag}</span>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        {[
          { text: "Implemented auth flow", time: "2h ago", done: true },
          { text: "Fixed dashboard layout", time: "5h ago", done: true },
          { text: "Started API testing", time: "1d ago", done: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50">
            <CheckCircle2 className={`w-3.5 h-3.5 ${item.done ? "text-emerald-500" : "text-slate-300"}`} />
            <span className="text-[11px] text-slate-700 flex-1">{item.text}</span>
            <span className="text-[9px] text-slate-400">{item.time}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-[10px] text-emerald-600 font-medium">+23% productivity this week</span>
      </div>
    </div>
  );
}

export default function LandingHero() {
  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden relative bg-gradient-to-b from-blue-50/50 to-white">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-2xl"
          >
            <div className="inline-block px-3 py-1 mb-6 text-sm font-semibold text-primary bg-blue-100/50 rounded-full border border-blue-100">
              Now in Private Beta
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 leading-[1.15] tracking-tight mb-6">
              AI-Powered <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Intern Management</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 mb-8 leading-relaxed max-w-lg">
              Save hours every week. Let AI handle daily logging, summaries, and performance tracking so you can focus on mentorship.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="#cta">
                <Button size="lg" className="h-14 px-8 text-lg font-semibold bg-primary hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all hover:-translate-y-1" data-testid="button-join-pilot">
                  Join the Pilot
                </Button>
              </a>
              <a href="/api/login">
                <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold border-slate-200 hover:bg-slate-50 text-slate-700" data-testid="button-view-demo">
                  Try It Free
                </Button>
              </a>
            </div>

            <div className="mt-10 flex items-center gap-4 text-sm text-slate-500">
              <div className="flex -space-x-3">
                {["bg-blue-400", "bg-emerald-400", "bg-purple-400", "bg-amber-400"].map((bg, i) => (
                  <div key={i} className={`w-10 h-10 rounded-full border-2 border-white ${bg} flex items-center justify-center text-white text-xs font-bold`}>
                    {["JM", "SK", "AL", "TR"][i]}
                  </div>
                ))}
              </div>
              <p>Trusted by <span className="font-semibold text-slate-700">50+ managers</span> in early access</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute -inset-4 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-[2rem] opacity-20 blur-3xl" />
            <div className="relative">
              <DashboardMockup />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
