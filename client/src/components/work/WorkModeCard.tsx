import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Play, Square, Monitor, Download, History, ListTodo } from "lucide-react";
import { api, tzOffset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { LiveClock, ConfirmDialog, Skeleton, ErrorState, Pill, RelativeTime } from "@/components/kit";
import { ShiftReportDialog, type ShiftReport } from "./ShiftReportDialog";

export interface ActiveSession { id: string; startedAt: string }
interface MeOverview {
  workMode: { sessionId: string; startedAt: string; elapsedSeconds: number; companion: "connected" | "stale" | "none"; lastObserved: { application: string; context: string | null; at: string } | null } | null;
  priority: { task: { id: string; title: string; status: string }; reason: string } | null;
  today: { id: string; title: string; status: string }[];
}

// The one Work Mode control. Lives on Home and on /work for interns.
// Start is immediate; End is deliberate (confirmation, then the report).
export function WorkModeCard({ className, autoEnd = false }: { className?: string; autoEnd?: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [report, setReport] = useState<ShiftReport | null>(null);

  const active = useQuery<ActiveSession | null>({ queryKey: ["/api/work-sessions/active"], refetchInterval: 15_000 });
  const me = useQuery<MeOverview>({ queryKey: [`/api/me/overview?tzOffsetMinutes=${tzOffset()}`], refetchInterval: 30_000 });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["/api/work-sessions/active"] });
    qc.invalidateQueries({ queryKey: [`/api/me/overview?tzOffsetMinutes=${tzOffset()}`] });
    qc.invalidateQueries({ queryKey: [`/api/work-sessions/summary?tzOffsetMinutes=${tzOffset()}`] });
    qc.invalidateQueries({ queryKey: ["/api/work-sessions/mine"] });
  };

  const start = useMutation({
    mutationFn: () => api<ActiveSession>("POST", "/api/work-sessions/start"),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["/api/work-sessions/active"] });
      const prev = qc.getQueryData<ActiveSession | null>(["/api/work-sessions/active"]);
      qc.setQueryData(["/api/work-sessions/active"], { id: "pending", startedAt: new Date().toISOString() });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => { qc.setQueryData(["/api/work-sessions/active"], ctx?.prev ?? null); toast({ title: "Couldn't start Work Mode", description: e.message, variant: "destructive" }); },
    onSuccess: (s) => { qc.setQueryData(["/api/work-sessions/active"], s); invalidate(); },
  });
  const end = useMutation({
    mutationFn: () => api<{ session: any; report: ShiftReport }>("POST", "/api/work-sessions/end"),
    onSuccess: (data) => { setConfirmEnd(false); qc.setQueryData(["/api/work-sessions/active"], null); invalidate(); setReport(data.report); },
    onError: (e: Error) => { setConfirmEnd(false); invalidate(); toast({ title: "Couldn't end your shift", description: e.message, variant: "destructive" }); },
  });

  useEffect(() => { if (autoEnd && active.data) setConfirmEnd(true); }, [autoEnd, active.data]);

  if (active.isLoading) return <div className={cn("panel p-5", className)}><Skeleton className="h-5 w-40 mb-3" /><Skeleton className="h-10 w-full" /></div>;
  if (active.error) return <div className={cn("panel", className)}><ErrorState compact title="Work Mode status unavailable" message="We couldn't check whether a session is running. Nothing has changed on the server." onRetry={() => active.refetch()} /></div>;

  const session = active.data;
  const wm = me.data?.workMode;
  const current = me.data?.priority?.task.status === "in_progress" ? me.data.priority.task : me.data?.today.find((t) => t.status === "in_progress") ?? null;

  if (!session) {
    return (
      <div className={cn("panel p-5 relative overflow-hidden", className)}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="t-label mb-1">Work Mode</div>
            <p className="text-[15px] font-semibold text-ink">Ready for Work Mode</p>
            <p className="text-[13px] text-ink-3 mt-0.5">Start a session to track your time. With the Companion open, your activity is observed only while the session runs.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="work" size="lg" onClick={() => start.mutate()} disabled={start.isPending} className="min-w-[160px]">
              <Play className="h-4 w-4" fill="currentColor" />{start.isPending ? "Starting…" : "Start Work Mode"}
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-3">
          <Link href="/download" className="inline-flex items-center gap-1.5 hover:text-ink"><Download className="h-3.5 w-3.5" />Get the Companion</Link>
          <Link href="/work" className="inline-flex items-center gap-1.5 hover:text-ink"><History className="h-3.5 w-3.5" />Past sessions</Link>
        </div>
        {report && <ShiftReportDialog report={report} onClose={() => setReport(null)} />}
      </div>
    );
  }

  const companion = wm?.companion ?? "none";
  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-work/30 bg-work-soft/60 p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5"><span className="absolute inline-flex h-full w-full rounded-full bg-work work-ring" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-work" /></span>
            <span className="t-label text-work">Work Mode active</span>
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <LiveClock since={session.startedAt} className="text-[40px] leading-none font-semibold text-ink tracking-tight" />
            <span className="text-xs text-ink-3">since {formatTime(session.startedAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setConfirmEnd(true)} disabled={end.isPending} className="border-work/40 text-ink hover:bg-surface"><Square className="h-3.5 w-3.5" fill="currentColor" />{end.isPending ? "Ending…" : "End shift"}</Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-work/20 bg-surface/70 p-3">
          <div className="t-label mb-1.5 flex items-center gap-1.5"><ListTodo className="h-3 w-3" />Current task</div>
          {current ? (
            <Link href={`/tasks/${current.id}`} className="block text-[13px] font-medium text-ink hover:text-accent truncate">{current.title}</Link>
          ) : (
            <p className="text-[13px] text-ink-3">No task in progress. <Link href="/tasks" className="text-accent hover:underline">Pick one</Link> so your activity can be linked to it.</p>
          )}
        </div>
        <div className="rounded-md border border-work/20 bg-surface/70 p-3">
          <div className="t-label mb-1.5 flex items-center gap-1.5"><Monitor className="h-3 w-3" />Companion</div>
          {companion === "connected" && wm?.lastObserved ? (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5"><Pill tone="work">Connected</Pill><span className="text-[11px] text-ink-3">observed <RelativeTime value={wm.lastObserved.at} /></span></div>
              <p className="mt-1 text-[13px] text-ink truncate">{wm.lastObserved.application}{wm.lastObserved.context ? <span className="text-ink-3"> — {wm.lastObserved.context}</span> : null}</p>
            </div>
          ) : companion === "stale" && wm?.lastObserved ? (
            <div><div className="flex items-center gap-1.5"><Pill tone="warn">Not reporting</Pill><span className="text-[11px] text-ink-3">last <RelativeTime value={wm.lastObserved.at} /></span></div><p className="mt-1 text-[12.5px] text-ink-3">The Companion stopped sending activity. Time is still recorded.</p></div>
          ) : (
            <div><Pill tone="neutral">Not connected</Pill><p className="mt-1 text-[12.5px] text-ink-3">Time only. <Link href="/download" className="text-accent hover:underline">Open the Companion</Link> to record observed activity.</p></div>
          )}
        </div>
      </div>

      <ConfirmDialog open={confirmEnd} onOpenChange={setConfirmEnd} title="End this shift?" description={<span>You've been in Work Mode for <strong className="t-num text-ink">{formatDuration(Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000))}</strong>. Ending stops time tracking and activity observation immediately, then generates your shift report.</span>} confirmLabel="End shift" pending={end.isPending} onConfirm={() => end.mutate()} />
      {report && <ShiftReportDialog report={report} onClose={() => { setReport(null); setLocation("/work"); }} />}
    </div>
  );
}
