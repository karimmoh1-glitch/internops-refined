import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, GitCommit, MessageSquare, Pencil, Plus, Target } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateTime, pluralize } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProgressBar, RelativeTime, Pill } from "@/components/kit";
import { PROJECT_KEYS, type LogComment, type PlanContent, type Role, type WeekPlan, type WeeklyLog } from "./types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const dayLabel = (n: number | null) => (n ? `Day ${n} · ${DAY_LABELS[(n - 1) % 7]}` : "No day");

// ---- One log entry ------------------------------------------------------------

function LogEntry({ log, comments, role, projectId }: { log: WeeklyLog; comments: LogComment[]; role: Role; projectId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(log.logText);
  const [feedback, setFeedback] = useState("");

  const edit = useMutation({
    mutationFn: () => api("PUT", `/api/weekly-logs/${log.id}`, { logText: text.trim() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: PROJECT_KEYS.logs(projectId) }); void qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) }); setEditing(false); toast({ title: "Log updated" }); },
    onError: (e: Error) => toast({ title: "Couldn't update log", description: e.message, variant: "destructive" }),
  });
  const comment = useMutation({
    mutationFn: () => api("POST", "/api/log-comments", { logId: log.id, content: feedback.trim() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: PROJECT_KEYS.logComments(projectId) }); setFeedback(""); toast({ title: "Feedback sent", description: "The intern is notified." }); },
    onError: (e: Error) => toast({ title: "Couldn't send feedback", description: e.message, variant: "destructive" }),
  });

  return (
    <li className="rounded-md border border-line bg-surface px-3 py-2">
      {editing ? (
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (text.trim()) edit.mutate(); }}>
          <Textarea aria-label="Edit log" value={text} onChange={(e) => setText(e.target.value)} rows={2} autoFocus />
          <div className="flex gap-2">
            <Button type="submit" size="xs" disabled={!text.trim() || edit.isPending}>{edit.isPending ? "Saving…" : "Save"}</Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => { setEditing(false); setText(log.logText); }}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] text-ink">{log.logText}</p>
          {role === "intern" && <Button variant="ghost" size="icon-xs" aria-label="Edit log" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></Button>}
        </div>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
        <span className="t-num">{dayLabel(log.dayNumber)}</span>
        <span aria-hidden>·</span>
        <time dateTime={new Date(log.createdAt).toISOString()} title={formatDateTime(log.createdAt)}><RelativeTime value={log.createdAt} live={false} /></time>
        {log.commitRef && <span className="inline-flex items-center gap-1 t-num"><GitCommit className="h-3 w-3" />{log.commitRef}</span>}
      </div>
      {comments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-md border border-info/20 bg-info-soft/60 px-2.5 py-1.5">
              <MessageSquare className="mt-0.5 h-3 w-3 shrink-0 text-info" />
              <div className="min-w-0">
                <p className="text-[13px] text-ink whitespace-pre-wrap">{c.content}</p>
                <p className="text-xs text-ink-3">{c.managerName ?? "Manager"} · <RelativeTime value={c.createdAt} live={false} /></p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {role === "admin" && (
        <form className="mt-2 flex gap-1.5" onSubmit={(e) => { e.preventDefault(); if (feedback.trim()) comment.mutate(); }}>
          <Input aria-label="Feedback on this log" value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Leave feedback on this entry" className="h-8 text-[13px]" />
          <Button type="submit" size="sm" variant="outline" disabled={!feedback.trim() || comment.isPending} className="shrink-0">{comment.isPending ? "Sending…" : "Send"}</Button>
        </form>
      )}
    </li>
  );
}

// ---- Add log (intern) ------------------------------------------------------

function AddLogForm({ projectId, weekNumber, subtaskIndex, daysPerWeek, canLog }: { projectId: string; weekNumber: number; subtaskIndex: number | null; daysPerWeek: number; canLog: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [day, setDay] = useState("1");
  const add = useMutation({
    mutationFn: () => api("POST", "/api/weekly-logs", { projectId, weekNumber, subtaskIndex: subtaskIndex ?? undefined, dayNumber: Number(day), logText: text.trim() }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: PROJECT_KEYS.logs(projectId) }); void qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) }); setText(""); toast({ title: "Log added" }); },
    onError: (e: Error) => toast({ title: "Couldn't add log", description: e.message, variant: "destructive" }),
  });
  if (!canLog) return null;
  return (
    <form className="flex flex-col gap-1.5 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !add.isPending) add.mutate(); }}>
      <Select value={day} onValueChange={setDay}>
        <SelectTrigger aria-label="Day of the week" className="h-8 sm:w-[132px] text-[13px]"><SelectValue /></SelectTrigger>
        <SelectContent>{Array.from({ length: daysPerWeek }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{dayLabel(d)}</SelectItem>)}</SelectContent>
      </Select>
      <Input aria-label="What did you do?" value={text} onChange={(e) => setText(e.target.value)} placeholder="What did you do on this?" className="h-8 text-[13px] flex-1" />
      <Button type="submit" size="sm" disabled={!text.trim() || add.isPending} className="shrink-0"><Plus className="h-3.5 w-3.5" />{add.isPending ? "Adding…" : "Log"}</Button>
    </form>
  );
}

// ---- Week card ------------------------------------------------------------

function WeekCard({ week, logs, comments, role, projectId, daysPerWeek, canLog }: { week: WeekPlan; logs: WeeklyLog[]; comments: LogComment[]; role: Role; projectId: string; daysPerWeek: number; canLog: boolean }) {
  const deliverables = week.deliverables ?? [];
  const loggedIdx = new Set(logs.filter((l) => l.subtaskIndex !== null && l.subtaskIndex !== undefined).map((l) => l.subtaskIndex as number));
  const general = logs.filter((l) => l.subtaskIndex === null || l.subtaskIndex === undefined);
  const byLog = useMemo(() => { const m = new Map<string, LogComment[]>(); for (const c of comments) m.set(c.logId, [...(m.get(c.logId) ?? []), c]); return m; }, [comments]);
  const sortLogs = (ls: WeeklyLog[]) => [...ls].sort((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0) || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-3 hairline-b">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="t-label">Week {week.weekNumber}</p>
            <h3 className="mt-0.5 text-[15px] font-semibold text-ink">{week.milestone}</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-3">
            <span className="t-num">{week.hours}h planned</span>
            <Pill tone="neutral">{pluralize(logs.length, "log")}</Pill>
          </div>
        </div>
        {week.successCriteria && <p className="mt-2 flex items-start gap-1.5 text-[13px] text-ink-2"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" />{week.successCriteria}</p>}
        {deliverables.length > 0 && (
          <div className="mt-3 flex items-center gap-3">
            <ProgressBar value={loggedIdx.size} max={deliverables.length} tone={loggedIdx.size === deliverables.length ? "ok" : "accent"} className="max-w-[200px]" />
            <span className="t-num text-xs text-ink-3">{loggedIdx.size}/{deliverables.length} deliverables have logs</span>
          </div>
        )}
      </div>

      <ol className="divide-y divide-line">
        {deliverables.map((d, idx) => {
          const mine = sortLogs(logs.filter((l) => l.subtaskIndex === idx));
          const has = mine.length > 0;
          return (
            <li key={idx} className="px-4 py-3">
              <div className="flex items-start gap-2.5">
                {has ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="Has logs" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-label="No logs yet" />}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[13px]", has ? "text-ink" : "text-ink-2")}>{d}</p>
                  {mine.length > 0 && <ul className="mt-2 space-y-1.5">{mine.map((l) => <LogEntry key={l.id} log={l} comments={byLog.get(l.id) ?? []} role={role} projectId={projectId} />)}</ul>}
                  <div className="mt-2"><AddLogForm projectId={projectId} weekNumber={week.weekNumber} subtaskIndex={idx} daysPerWeek={daysPerWeek} canLog={canLog} /></div>
                </div>
              </div>
            </li>
          );
        })}
        {(general.length > 0 || deliverables.length === 0) && (
          <li className="px-4 py-3">
            <p className="t-label mb-2">General notes</p>
            {general.length > 0 ? <ul className="space-y-1.5">{sortLogs(general).map((l) => <LogEntry key={l.id} log={l} comments={byLog.get(l.id) ?? []} role={role} projectId={projectId} />)}</ul> : <p className="text-[13px] text-ink-3">This week has no deliverables listed. Log general notes here.</p>}
            {deliverables.length === 0 && <div className="mt-2"><AddLogForm projectId={projectId} weekNumber={week.weekNumber} subtaskIndex={null} daysPerWeek={daysPerWeek} canLog={canLog} /></div>}
          </li>
        )}
      </ol>
    </div>
  );
}

// ---- Execution display -------------------------------------------------------

export function ExecutionDisplay({ projectId, plan, logs, logComments, role, canLog }: { projectId: string; plan: PlanContent; logs: WeeklyLog[]; logComments: LogComment[]; role: Role; canLog: boolean }) {
  const weeks = plan.weeks ?? [];
  // Open on the first week that still has an unlogged deliverable.
  const initial = useMemo(() => {
    for (const w of weeks) {
      const logged = new Set(logs.filter((l) => l.weekNumber === w.weekNumber && l.subtaskIndex !== null).map((l) => l.subtaskIndex));
      if ((w.deliverables ?? []).some((_, i) => !logged.has(i))) return w.weekNumber;
    }
    return weeks[0]?.weekNumber ?? 1;
  }, [weeks, logs]);
  const [active, setActive] = useState<number>(initial);
  const week = weeks.find((w) => w.weekNumber === active) ?? weeks[0];
  if (!week) return <p className="text-[13px] text-ink-3">The approved plan has no weeks to track.</p>;
  const weekLogs = logs.filter((l) => l.weekNumber === week.weekNumber);
  const ids = new Set(weekLogs.map((l) => l.id));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Weeks">
        {weeks.map((w) => {
          const wl = logs.filter((l) => l.weekNumber === w.weekNumber);
          const logged = new Set(wl.filter((l) => l.subtaskIndex !== null).map((l) => l.subtaskIndex)).size;
          const total = (w.deliverables ?? []).length;
          const complete = total > 0 && logged >= total;
          const sel = w.weekNumber === week.weekNumber;
          return (
            <button key={w.weekNumber} role="tab" aria-selected={sel} title={`Week ${w.weekNumber}: ${w.milestone}`} onClick={() => setActive(w.weekNumber)}
              className={cn("relative inline-flex h-8 min-w-[36px] items-center justify-center rounded-md border px-2 t-num text-xs font-medium transition-colors", sel ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2 hover:bg-surface-2")}>
              {w.weekNumber}
              {!sel && (complete || wl.length > 0) && <span className={cn("absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full", complete ? "bg-ok" : "bg-accent")} aria-hidden />}
            </button>
          );
        })}
      </div>
      <WeekCard week={week} logs={weekLogs} comments={logComments.filter((c) => ids.has(c.logId))} role={role} projectId={projectId} daysPerWeek={plan.daysPerWeek || 5} canLog={canLog} />
    </div>
  );
}
