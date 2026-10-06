import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, ExternalLink, FileText, History, Radar, Sparkles, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { dayLabel, dueLabel, formatDateTime, formatDuration, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Dot, EmptyState, ErrorState, LiveClock, Pill, PriorityMark, PulseMarkdown, Section, SkeletonBlock, SkeletonRows, StatusBadge } from "@/components/kit";
import type { SkillCount } from "@shared/skills";
import { type Narrative, type PersonSignal, type Task, type WorkSession, type WorkSummary, endReasonLabel, invalidatePeople } from "./types";

// ---------- Tasks ----------

export function TaskRows({ tasks, emptyText }: { tasks: Task[]; emptyText?: string }) {
  if (tasks.length === 0) return emptyText ? <p className="px-4 py-3 text-[13px] text-ink-3">{emptyText}</p> : null;
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const due = dueLabel(t.dueDate, t.status);
        return (
          <li key={t.id} className="relative row-hover">
            <div className="flex items-center gap-3 px-4 py-2">
              <StatusBadge status={t.status} iconOnly className="shrink-0" />
              <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 truncate text-[13px] text-ink before:absolute before:inset-0 hover:underline underline-offset-2">{t.title}</Link>
              {t.status === "blocked" && t.blockedReason && <span className="hidden max-w-[200px] truncate text-xs text-ink-3 lg:block" title={t.blockedReason}>{t.blockedReason}</span>}
              {due && <span className={cn("shrink-0 text-xs t-num", due.tone === "danger" ? "text-danger font-medium" : due.tone === "warn" ? "text-warn" : "text-ink-3")}>{due.text}</span>}
              <PriorityMark priority={t.priority} className="shrink-0" />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Sessions ----------

export function SessionsPanel({ sessions, summaries, isLoading, error, onRetry }: { sessions: WorkSession[]; summaries: Map<string, WorkSummary>; isLoading: boolean; error: unknown; onRetry: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? sessions : sessions.slice(0, 8);
  return (
    <Section title="Recent sessions" description="Work Mode shifts. Each opens its replay." flush
      actions={sessions.length > 8 && <Button variant="ghost" size="xs" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `All ${sessions.length}`}</Button>}>
      {isLoading ? <div className="p-4"><SkeletonRows rows={4} /></div> :
        error ? <ErrorState compact message={(error as Error).message} onRetry={onRetry} /> :
        sessions.length === 0 ? <EmptyState compact icon={<History />} title="No sessions yet" description="Shifts appear here once they start Work Mode." /> : (
          <ul className="divide-y divide-line">
            {list.map((s) => {
              const report = summaries.get(s.id);
              const reason = endReasonLabel(s.endReason);
              const active = s.status === "active";
              return (
                <li key={s.id} className="relative row-hover">
                  <div className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <Link href={`/work/replay/${s.id}`} className="min-w-0 truncate text-[13px] font-medium text-ink before:absolute before:inset-0 hover:underline underline-offset-2">
                        {dayLabel(s.startedAt)} <span className="font-normal text-ink-3">· {formatTime(s.startedAt)}{s.endedAt && ` – ${formatTime(s.endedAt)}`}</span>
                      </Link>
                      {active
                        ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-work"><Dot tone="work" pulse /><LiveClock since={s.startedAt} /></span>
                        : <span className="t-num shrink-0 text-[13px] text-ink">{formatDuration(s.durationSeconds ?? 0)}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-3">
                      {reason && <Pill tone={s.endReason === "auto_timeout" ? "warn" : "neutral"}>{reason}</Pill>}
                      {!active && (report
                        ? (report.submittedAt ? <Pill tone="ok" icon={<FileText className="h-3 w-3" />}>Report submitted</Pill> : <Pill tone="warn" icon={<FileText className="h-3 w-3" />}>Report not submitted</Pill>)
                        : <span>No report</span>)}
                      {report && (report.tasksCompleted > 0 || report.tasksSubmitted > 0) && (
                        <span className="t-num">{report.tasksCompleted > 0 && `${report.tasksCompleted} completed`}{report.tasksCompleted > 0 && report.tasksSubmitted > 0 && " · "}{report.tasksSubmitted > 0 && `${report.tasksSubmitted} submitted`}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
    </Section>
  );
}

// ---------- Signals ----------

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;
function evidenceValue(v: string): string {
  if (ISO_RE.test(v)) return formatDateTime(v);
  return v;
}

export function SignalsPanel({ signals, isLoading, error, onRetry }: { signals: PersonSignal[]; isLoading: boolean; error: unknown; onRetry: () => void }) {
  return (
    <Section title="Signals" description="Derived from tasks and sessions. Evidence is listed, not inferred." flush
      actions={signals.length > 0 && <Button asChild variant="ghost" size="xs"><Link href="/signals">All signals</Link></Button>}>
      {isLoading ? <div className="p-4"><SkeletonRows rows={2} /></div> :
        error ? <ErrorState compact message={(error as Error).message} onRetry={onRetry} /> :
        signals.length === 0 ? <EmptyState compact icon={<Radar />} title="No open signals" description="Nothing overdue, blocked, stale, or unusual for this person right now." /> : (
          <ul className="divide-y divide-line">
            {signals.map((s) => (
              <li key={s.key} className="px-4 py-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", s.severity === "high" ? "text-danger" : "text-warn")} aria-label={`${s.severity} severity`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{s.headline}</p>
                    <p className="mt-0.5 text-xs text-ink-2">{s.description}</p>
                    {s.evidence.length > 0 && (
                      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        {s.evidence.map((e, i) => <div key={i} className="contents"><dt className="text-ink-3">{e.label}</dt><dd className="min-w-0 truncate text-ink-2">{evidenceValue(e.value)}</dd></div>)}
                      </dl>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      <Link href={s.href} className="inline-flex items-center gap-1 font-medium text-accent hover:underline underline-offset-2">{s.taskTitle ? "Open task" : s.projectTitle ? "Open project" : "Open"}<ExternalLink className="h-3 w-3" /></Link>
                      <span className="text-ink-4">Source: {s.source}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
    </Section>
  );
}

// ---------- Skills ----------

export function SkillsPanel({ skills, note }: { skills: SkillCount[]; note?: string }) {
  const max = skills[0]?.count ?? 1;
  return (
    <Section title="Skills" description={note ?? "Aggregated from skill tags on approved tasks."}>
      {skills.length === 0 ? (
        <EmptyState compact icon={<Wrench />} title="No skills recorded" description="Skills appear as approved tasks carry skill tags. Add tags when creating or reviewing tasks." />
      ) : (
        <ul className="space-y-1.5">
          {skills.slice(0, 12).map((s) => (
            <li key={s.tag} className="flex items-center gap-3 text-[13px]">
              <span className="w-32 shrink-0 truncate text-ink" title={s.tag}>{s.tag}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg-sunken"><span className="block h-full rounded-full bg-accent/70" style={{ width: `${Math.max(8, (s.count / max) * 100)}%` }} /></span>
              <span className="t-num w-6 text-right text-xs text-ink-3">{s.count}</span>
            </li>
          ))}
          {skills.length > 12 && <li className="text-xs text-ink-3">+{skills.length - 12} more</li>}
        </ul>
      )}
    </Section>
  );
}

// ---------- Performance narrative ----------

export function NarrativePanel({ internId, frozen }: { internId: string; frozen?: { content: string | null } }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const key = `/api/interns/${internId}/performance-narrative`;
  const narrative = useQuery<Narrative | null>({ queryKey: [key], enabled: !frozen });

  const generate = useMutation({
    mutationFn: () => api<Narrative>("POST", key, {}),
    onSuccess: (n) => {
      qc.setQueryData([key], n);
      invalidatePeople(qc);
      toast({ title: n.aiGenerated ? "Narrative written" : "Narrative generated from task data", description: n.aiGenerated ? "Read it before sharing: it is AI-written from the task record." : "No AI key is configured, so this is a factual summary of the approved tasks." });
    },
    onError: (err: Error) => toast({ title: "Couldn't generate", description: err.message, variant: "destructive" }),
  });

  if (frozen) {
    return (
      <Section title="Performance narrative" description="Frozen when the internship ended.">
        {frozen.content ? <PulseMarkdown text={frozen.content} /> : <p className="text-[13px] text-ink-3">No narrative was generated before the internship ended.</p>}
      </Section>
    );
  }

  const n = narrative.data ?? null;
  return (
    <Section title="Performance narrative" description="A written summary of their approved tasks. Regenerate as the record grows."
      actions={!narrative.isLoading && !narrative.error && (
        <Button variant="outline" size="xs" disabled={generate.isPending} onClick={() => generate.mutate()}><Sparkles className="h-3.5 w-3.5" />{generate.isPending ? "Generating…" : n ? "Regenerate" : "Generate"}</Button>
      )}>
      {narrative.isLoading ? <SkeletonBlock lines={4} /> :
        narrative.error ? <ErrorState compact message={(narrative.error as Error).message} onRetry={() => void narrative.refetch()} /> :
        !n ? <EmptyState compact icon={<Sparkles />} title="Nothing written yet" description="Generates a summary from approved tasks and their skill tags. Nothing is sent anywhere." action={<Button size="sm" disabled={generate.isPending} onClick={() => generate.mutate()}>{generate.isPending ? "Generating…" : "Generate"}</Button>} /> : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              {n.aiGenerated ? <Pill tone="pulse" icon={<Sparkles className="h-3 w-3" />}>AI-written</Pill> : <Pill tone="neutral">Generated from task data</Pill>}
              <span>{formatDateTime(n.createdAt)}</span>
              <span>· from <span className="t-num">{n.taskSnapshotCount}</span> approved {n.taskSnapshotCount === 1 ? "task" : "tasks"}</span>
            </div>
            <PulseMarkdown text={n.content} />
          </div>
        )}
    </Section>
  );
}

// ---------- Expected end date ----------

export function ExpectedEndDateDialog({ open, onOpenChange, internId, value }: { open: boolean; onOpenChange: (o: boolean) => void; internId: string; value: string | null }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const saved = value ? value.slice(0, 10) : "";
  const [date, setDate] = useState(saved);
  // The dialog stays mounted, so re-sync the input with the stored value
  // each time it opens (and after a save changes `value`).
  useEffect(() => { if (open) setDate(saved); }, [open, saved]);
  const save = useMutation({
    mutationFn: (expectedEndDate: string | null) => api("PUT", `/api/interns/${internId}/expected-end-date`, { expectedEndDate }),
    onSuccess: (_d, v) => { invalidatePeople(qc); onOpenChange(false); toast({ title: v ? "Expected end date saved" : "End date cleared", description: v ? "They'll be moved to alumni automatically when it passes." : "Marked as undecided." }); },
    onError: (err: Error) => toast({ title: "Couldn't save", description: err.message, variant: "destructive" }),
  });
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setDate(saved); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Expected end date</DialogTitle>
          <DialogDescription>Only a plan. Nothing changes until the date passes, when the internship is closed automatically and moved to alumni.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="expected-end" className="text-[13px] text-ink-2">Date</Label>
          <Input id="expected-end" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {saved ? <Button variant="ghost" size="sm" disabled={save.isPending} onClick={() => save.mutate(null)}>Mark undecided</Button> : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={!date || date === saved || save.isPending} onClick={() => save.mutate(date)}>{save.isPending ? "Saving…" : "Save"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
