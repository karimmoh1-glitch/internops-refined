import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Play, Square, Loader2, CheckCircle2, Send } from "lucide-react";

interface WorkSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  status: "active" | "completed";
}

interface EndShiftSummary {
  durationSeconds: number;
  tasksCompleted: number;
  tasksSubmitted: number;
}

export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export default function ShiftControl() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [endSummary, setEndSummary] = useState<EndShiftSummary | null>(null);

  const { data: active, isLoading } = useQuery<WorkSession | null>({
    queryKey: ["/api/work-sessions/active"],
    refetchInterval: 30000,
  });
  const { data: tasks = [] } = useQuery<any[]>({ queryKey: ["/api/tasks/mine"], refetchInterval: 15000 });

  // Live elapsed-time tick — purely client-side display, the server's
  // startedAt timestamp is the actual source of truth used at end-shift.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);

  const elapsedSeconds = active ? Math.max(0, Math.floor((now - new Date(active.startedAt).getTime()) / 1000)) : 0;
  const currentTask = useMemo(() => tasks.find((t) => t.status === "in_progress"), [tasks]);

  const startMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/work-sessions/start"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-sessions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-sessions/summary"] });
      setNow(Date.now());
      toast({ title: "Shift started", description: "Have a good session." });
    },
    onError: (err: any) => toast({ title: "Couldn't start shift", description: err.message, variant: "destructive" }),
  });

  const endMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/work-sessions/end");
      return res.json();
    },
    onSuccess: (data: { session: WorkSession; summary: EndShiftSummary }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/work-sessions/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/work-sessions/summary"] });
      setEndSummary(data.summary);
    },
    onError: (err: any) => toast({ title: "Couldn't end shift", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="h-[76px] bg-card border border-white/[0.08] rounded-xl animate-pulse mb-6" />;
  }

  return (
    <>
      <div
        className={`rounded-xl border p-4 mb-6 flex items-center justify-between gap-4 ${
          active ? "bg-emerald-500/[0.06] border-emerald-500/20" : "bg-card border-white/[0.08]"
        }`}
        data-testid="shift-control"
      >
        {active ? (
          <>
            <div className="flex items-center gap-4 min-w-0">
              <div className="flex items-center gap-2 shrink-0">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                </span>
                <span className="text-sm font-semibold text-emerald-400">Shift Active</span>
              </div>
              <div className="text-sm text-white/70 min-w-0">
                <span className="font-mono font-semibold text-white" data-testid="text-shift-elapsed">{formatDuration(elapsedSeconds)}</span>
                <span className="text-white/40"> &middot; started {new Date(active.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                {currentTask && <span className="text-white/40 truncate"> &middot; working on "{currentTask.title}"</span>}
              </div>
            </div>
            <Button
              variant="outline"
              className="border-red-500/20 text-red-400 hover:bg-red-500/10 shrink-0"
              onClick={() => endMutation.mutate()}
              disabled={endMutation.isPending}
              data-testid="button-end-shift"
            >
              {endMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Square className="w-4 h-4 mr-1.5" />}
              End Shift
            </Button>
          </>
        ) : (
          <>
            <div className="text-sm text-white/60">Not currently working</div>
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              data-testid="button-start-shift"
            >
              {startMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />}
              Start Shift
            </Button>
          </>
        )}
      </div>

      <Dialog open={!!endSummary} onOpenChange={(v) => { if (!v) setEndSummary(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-shift-summary">
          <DialogHeader>
            <DialogTitle>Shift complete</DialogTitle>
          </DialogHeader>
          {endSummary && (
            <div className="space-y-3">
              <p className="text-2xl font-bold text-white">{formatDuration(endSummary.durationSeconds)} worked</p>
              <div className="space-y-2 text-sm text-white/70">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {endSummary.tasksCompleted} task{endSummary.tasksCompleted !== 1 ? "s" : ""} completed
                </div>
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400 shrink-0" />
                  {endSummary.tasksSubmitted} item{endSummary.tasksSubmitted !== 1 ? "s" : ""} submitted for review
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setEndSummary(null)} data-testid="button-close-shift-summary">Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
