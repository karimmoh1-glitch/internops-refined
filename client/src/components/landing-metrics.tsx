import { motion } from "framer-motion";

const metrics = [
  { value: "70%+", label: "Logging Compliance", sub: "Consistently maintained" },
  { value: "4.8/5", label: "AI Usefulness", sub: "Rated by managers" },
  { value: "80%", label: "Weekly Engagement", sub: "Active user rate" },
  { value: "1hr+", label: "Time Saved", sub: "Per manager / week" }
];

export default function LandingMetrics() {
  return (
    <section id="metrics" className="py-20 bg-slate-900 text-white relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute -top-[50%] -left-[20%] w-[800px] h-[800px] rounded-full bg-blue-600/20 blur-[100px]" />
        <div className="absolute top-[50%] -right-[20%] w-[600px] h-[600px] rounded-full bg-emerald-500/10 blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-heading mb-4">Proven Results in our Pilot</h2>
          <p className="text-slate-400 text-lg">We didn't just build it, we measured it.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {metrics.map((metric, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <div className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">
                {metric.value}
              </div>
              <div className="font-semibold text-white text-lg mb-1">{metric.label}</div>
              <div className="text-slate-400 text-sm">{metric.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
