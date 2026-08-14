import { useEffect, useRef, useState } from "react";
import { Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface PulseScoreProps {
  completionRates: { internName: string; completionRate: number }[];
  taskCompletionByIntern: { internName: string; completed: number; total: number }[];
  activeProjects: number;
  totalProjects: number;
  pendingReview: number;
}

interface ScoreBreakdown {
  score: number;
  avgCompletion: number | null;
  taskRate: number | null;
  activeRate: number | null;
}

function computeScore({
  completionRates,
  taskCompletionByIntern,
  activeProjects,
  totalProjects,
  pendingReview,
}: PulseScoreProps): ScoreBreakdown | null {
  if (totalProjects === 0 && taskCompletionByIntern.length === 0) return null;

  const avgCompletion = completionRates.length
    ? completionRates.reduce((sum, c) => sum + c.completionRate, 0) / completionRates.length
    : null;

  const taskTotals = taskCompletionByIntern.reduce(
    (acc, t) => ({ completed: acc.completed + t.completed, total: acc.total + t.total }),
    { completed: 0, total: 0 }
  );
  const taskRate = taskTotals.total > 0 ? (taskTotals.completed / taskTotals.total) * 100 : null;

  const activeRate = totalProjects > 0 ? (activeProjects / totalProjects) * 100 : null;

  // Backlog drags the score down the more it piles up relative to team size,
  // capped so a couple of pending reviews doesn't tank an otherwise healthy team.
  const backlogPenalty = Math.min(pendingReview * 6, 30);

  const signals = [avgCompletion, taskRate, activeRate].filter((v): v is number => v !== null);
  if (signals.length === 0) return null;

  const base = signals.reduce((a, b) => a + b, 0) / signals.length;
  const score = Math.max(0, Math.min(100, Math.round(base - backlogPenalty)));
  return { score, avgCompletion, taskRate, activeRate };
}

function scoreCopy(score: number): { label: string; tone: string; ring: string; icon: typeof TrendingUp } {
  if (score >= 80) return { label: "Team is crushing it", tone: "text-emerald-600", ring: "#10B981", icon: TrendingUp };
  if (score >= 55) return { label: "Steady progress", tone: "text-[#6D5EF5]", ring: "#6D5EF5", icon: Minus };
  return { label: "Needs attention", tone: "text-amber-600", ring: "#F59E0B", icon: TrendingDown };
}

function useCountUp(target: number, durationMs = 900) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    let raf: number;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function BreakdownBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="min-w-[112px]">
      <div className="flex items-center justify-between mb-1">
        <span className="text-label text-zinc-500">{label}</span>
        <span className="text-xs font-semibold text-white/70 tabular-nums">{value === null ? "—" : `${Math.round(value)}%`}</span>
      </div>
      <div className="w-full bg-white/[0.08] rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.max(value ?? 0, value === null ? 0 : 3)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PulseScoreCard(props: PulseScoreProps) {
  const breakdown = computeScore(props);
  // Hooks must run unconditionally, so useCountUp always runs with a
  // fallback of 0 — the null-score branch below never reads its output.
  const animated = useCountUp(breakdown?.score ?? 0);

  if (breakdown === null) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-surface-accent p-6" data-testid="card-pulse-score">
        <div className="relative flex items-center gap-3">
          <Activity className="w-5 h-5 text-[#8B7FF7]" />
          <p className="text-sm text-zinc-400">Pulse Score appears once your team has active projects.</p>
        </div>
      </div>
    );
  }

  const { score, avgCompletion, taskRate, activeRate } = breakdown;
  const { label, tone, ring, icon: TrendIcon } = scoreCopy(score);

  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div
      className="relative overflow-hidden rounded-2xl bg-surface-accent p-6 shadow-lg"
      data-testid="card-pulse-score"
    >
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-64 h-64 rounded-full opacity-20 blur-3xl"
        style={{ background: `radial-gradient(circle, ${ring}, transparent 70%)` }}
      />
      <div className="relative flex items-center justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-5">
          <div className="relative w-24 h-24 shrink-0">
            <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
              <circle
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={ring}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-metric text-2xl text-white" data-testid="text-pulse-score-value">
                {animated}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-[#8B7FF7]" />
              <span className="text-label text-zinc-400">Pulse Score</span>
            </div>
            <p className="text-lg font-heading font-semibold text-white" data-testid="text-pulse-score-label">
              {label}
            </p>
            <p className={`text-xs mt-0.5 flex items-center gap-1 ${tone}`}>
              <TrendIcon className="w-3 h-3" />
              Based on completion rate, task velocity, and review backlog
            </p>
          </div>
        </div>
        <div className="flex items-center gap-5 flex-wrap" data-testid="pulse-score-breakdown">
          <BreakdownBar label="Completion" value={avgCompletion} color="#10B981" />
          <BreakdownBar label="Task velocity" value={taskRate} color="#6D5EF5" />
          <BreakdownBar label="Active rate" value={activeRate} color="#F59E0B" />
        </div>
      </div>
    </div>
  );
}
