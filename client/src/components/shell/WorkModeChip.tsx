import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LiveClock } from "@/components/kit";
import { Timer } from "lucide-react";

// Global indicator: when an intern is in Work Mode, every screen says so.
export function WorkModeChip({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { user } = useAuth();
  const { data: active } = useQuery<{ id: string; startedAt: string } | null>({
    queryKey: ["/api/work-sessions/active"],
    enabled: user?.role === "intern",
    refetchInterval: 15_000,
  });
  if (user?.role !== "intern" || !active) return null;
  return (
    <Link href="/work" className={cn("inline-flex items-center gap-2 rounded-md border border-work/30 bg-work-soft px-2.5 h-8 text-work font-medium transition-colors hover:bg-work/15", className)} aria-label="Work Mode active — open Work">
      <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full rounded-full bg-work work-ring" /><span className="relative inline-flex h-2 w-2 rounded-full bg-work" /></span>
      {!compact && <span className="text-xs">Working</span>}
      <LiveClock since={active.startedAt} className="text-xs" />
      {compact && <Timer className="h-3.5 w-3.5" />}
    </Link>
  );
}
