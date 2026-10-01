import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Metric, ProgressBar } from "@/components/kit";
import { History } from "lucide-react";

export interface ShiftReport {
  id: string; sessionId: string; durationSeconds: number;
  activityBreakdown: { category: string; label: string; seconds: number }[];
  tasksCompleted: number; tasksSubmitted: number; nextStep: string | null; internNote: string | null; submittedAt: string | null;
}

// Shown right after End Shift. Every number is computed by the server
// from stored records; the note is the only thing the intern writes.
export function ShiftReportDialog({ report, onClose }: { report: ShiftReport; onClose: () => void }) {
  const [note, setNote] = useState(report.internNote ?? "");
  const [submitted, setSubmitted] = useState(!!report.submittedAt);
  const qc = useQueryClient();
  const { toast } = useToast();
  const observed = report.activityBreakdown.reduce((s, a) => s + a.seconds, 0);

  const submit = useMutation({
    mutationFn: async () => {
      if (note.trim() !== (report.internNote ?? "")) await api("PATCH", `/api/work-sessions/${report.sessionId}/summary`, { internNote: note.trim() });
      await api("POST", `/api/work-sessions/${report.sessionId}/summary/submit`);
    },
    onSuccess: () => { setSubmitted(true); qc.invalidateQueries({ queryKey: ["/api/work-sessions/mine"] }); toast({ title: "Report submitted", description: "Your manager has been notified." }); },
    onError: (e: Error) => toast({ title: "Couldn't submit the report", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Shift report</DialogTitle>
          <DialogDescription>Generated from what was recorded during this session. Nothing here is inferred.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-line bg-surface-2 p-3"><div className="t-label mb-1">Duration</div><Metric value={formatDuration(report.durationSeconds)} className="text-lg" /></div>
          <div className="rounded-md border border-line bg-surface-2 p-3"><div className="t-label mb-1">Submitted</div><Metric value={report.tasksSubmitted} className="text-lg" /></div>
          <div className="rounded-md border border-line bg-surface-2 p-3"><div className="t-label mb-1">Approved</div><Metric value={report.tasksCompleted} className="text-lg" /></div>
        </div>
        <div>
          <div className="t-label mb-2">Observed activity{observed > 0 && <span className="ml-1 text-ink-4 normal-case tracking-normal font-normal">· {formatDuration(observed)} of {formatDuration(report.durationSeconds)}</span>}</div>
          {report.activityBreakdown.length === 0 ? (
            <p className="text-[13px] text-ink-3">No Companion activity was recorded for this session — only time.</p>
          ) : (
            <ul className="space-y-2">
              {report.activityBreakdown.map((a) => (
                <li key={a.category}>
                  <div className="flex items-center justify-between text-[13px]"><span className="text-ink">{a.label}</span><span className="t-num text-ink-3">{formatDuration(a.seconds)}</span></div>
                  <ProgressBar value={a.seconds} max={Math.max(observed, 1)} tone="work" size="xs" className="mt-1" />
                </li>
              ))}
            </ul>
          )}
        </div>
        {report.nextStep && <p className="text-[13px] text-ink-2"><span className="t-label mr-2">Next</span>{report.nextStep}</p>}
        {!submitted ? (
          <div>
            <label htmlFor="shift-note" className="t-label block mb-1.5">Add context (optional)</label>
            <Textarea id="shift-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything your manager should know — blockers, what you'd pick up next…" rows={3} maxLength={1000} />
          </div>
        ) : (
          <p className="text-[13px] text-ok">Submitted to your manager.</p>
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" asChild><Link href={`/work/replay/${report.sessionId}`}><History className="h-4 w-4" />View replay</Link></Button>
          {!submitted ? <Button onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit report"}</Button> : <Button onClick={onClose}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
