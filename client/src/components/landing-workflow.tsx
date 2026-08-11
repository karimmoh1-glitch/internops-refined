import { FileText, Cpu, LayoutDashboard, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

const steps = [
  {
    step: "01",
    title: "Intern Logs Work",
    description: "Interns spend 2 minutes daily logging their tasks via a simple, engaging interface.",
    icon: FileText,
    color: "from-blue-500 to-blue-600",
    iconBg: "bg-blue-100 text-blue-600",
    features: ["Quick daily entries", "Tags & categories", "Time tracking"]
  },
  {
    step: "02",
    title: "AI Processes Data",
    description: "Our engine analyzes entries, tags skills, and compiles weekly progress summaries automatically.",
    icon: Cpu,
    color: "from-purple-500 to-purple-600",
    iconBg: "bg-purple-100 text-purple-600",
    features: ["Skill detection", "Progress analysis", "Next-step suggestions"]
  },
  {
    step: "03",
    title: "Manager Reviews",
    description: "Managers get a clear, concise dashboard view to identify blockers and celebrate wins.",
    icon: LayoutDashboard,
    color: "from-emerald-500 to-emerald-600",
    iconBg: "bg-emerald-100 text-emerald-600",
    features: ["Team overview", "Rate & feedback", "Engagement metrics"]
  }
];

export default function LandingWorkflow() {
  return (
    <section id="workflow" className="py-24 bg-slate-50">
      <div className="container mx-auto px-6">
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-slate-900 mb-4">
            A seamless feedback loop
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            From daily updates to weekly growth reviews, ForgeFlow automates the friction points.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 relative">
          <div className="hidden md:block absolute top-16 left-[20%] right-[20%] h-0.5 bg-gradient-to-r from-blue-200 via-purple-200 to-emerald-200 z-0" />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative bg-white p-8 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center text-center group hover:shadow-lg transition-all z-10"
            >
              <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-lg`}>
                <step.icon className="w-9 h-9 text-white" />
              </div>

              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Step {step.step}</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
              <p className="text-slate-600 leading-relaxed mb-5">{step.description}</p>
              
              <div className="w-full space-y-2">
                {step.features.map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {feat}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
