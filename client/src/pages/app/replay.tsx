import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Flag, Monitor, Send, CheckCircle2, CircleDot, FileText, MoonStar, EyeOff, HelpCircle, ChevronDown, ChevronRight, Database, Timer, Activity } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDuration, formatTime, formatDate, formatDateTime, pluralize } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Page, PageHeader, Section, EmptyState, ErrorState, Skeleton, SkeletonRows, Avatar, Pill, LiveClock, ProgressBar, Metric, type Tone } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface Event { ts: string; type: string; label: string; detail?: string; durationSeconds?: number; taskId?: string | null; taskCorrelation?: string | null; evidenceIds?: string[]; interpretation?: { observed: string; inferred: string | null } }
interface TimelineData {
  session: { id: string; internId: string; startedAt: string; endedAt: string | null; durationSeconds: number | null; status: string; endReason?: string | null };
  intern: { id: string; name: string } | null;
  summary: { id: string; durationSeconds: number; activityBreakdown: { category: string; label: string; seconds: number }[]; tasksCompleted: number; tasksSubmitted: number; nextStep: string | null; internNote: string | null; submittedAt: string | null } | null;
  observedSeconds: number;
  events: Event[];
}
interface RawActivity { id: string; application: string; category: string; windowTitle: string | null; documentName: string | null; browserDomain: string | null; idleSeconds: number | null; contextSource: string | null; startedAt: string; endedAt: string; durationSeconds: number; taskCorrelation: string | null }

type Kind = "observed" | "system" | "unknown";
const META: Record<string, { kind: Kind; tone: Tone; Icon: typeof Play }> = {
  shift_started: { kind: "system", tone: "work", Icon: Play },
  shift_ended: { kind: "system", tone: "neutral", Icon: Flag },
  report_generated: { kind: "system", tone: "neutral", Icon: FileText },
  task_started: { kind: "system", tone: "accent", Icon: CircleDot },
  task_submitted: { kind: "system", tone: "info", Icon: Send },
  task_approved: { kind: "system", tone: "ok", Icon: CheckCircle2 },
  task_completed: { kind: "system", tone: "ok", Icon: CheckCircle2 },
  app_active: { kind: "observed", tone: "work", Icon: Monitor },
  idle_observed: { kind: "observed", tone: "warn", Icon: MoonStar },
  no_observation: { kind: "unknown", tone: "neutral", Icon: EyeOff },
  no_companion: { kind: "unknown", tone: "neutral", Icon: HelpCircle },
};
const KIND_LABEL: Record<Kind, string> = { observed: "Observed", system: "System event", unknown: "Unknown" };

export default function ReplayPage({ sessionId }: { sessionId: string }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const q = useQuery<TimelineData>({ queryKey: [`/api/work-sessions/${sessionId}/timeline`], refetchInterval: (data) => ((data.state.data as TimelineData | undefined)?.session.status === "active" ? 15_000 : false) });
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [rawOpen, setRawOpen] = useState(false);
  const d = q.data;

  const events = useMemo(() => (d?.events ?? []).filter((e) => filter === "all" || (META[e.type]?.kind ?? "system") === filter), [d, filter]);
  const counts = useMemo(() => { const c = { observed: 0, system: 0, unknown: 0 }; for (const e of d?.events ?? []) c[META[e.type]?.kind ?? "system"]++; return c; }, [d]);
  const total = d ? (d.session.endedAt ? d.session.durationSeconds ?? 0 : Math.round((Date.now() - new Date(d.session.startedAt).getTime()) / 1000)) : 0;
  const coverage = total > 0 ? Math.min(100, Math.round((d!.observedSeconds / total) * 100)) : 0;

  if (q.isLoading) return <Page><div className="pt-8 space-y-4"><Skeleton className="h-4 w-32" /><Skeleton className="h-7 w-72" /><div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] pt-4"><div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14" />)}</div><Skeleton className="h-64" /></div></div></Page>;
  if (q.error || !d) return <Page><div className="pt-8"><ErrorState title="Replay unavailable" message={(q.error as Error)?.message ?? "This session may not exist or you don't have access."} onRetry={() => q.refetch()} /></div></Page>;

  const s = d.session;
  const endReason = s.endReason === "auto_timeout" ? "Closed automatically" : s.endReason === "admin" ? "Ended by a manager" : s.endReason === "account" ? "Ended by account change" : null;

  return (
    <Page width="wide">
      <PageHeader crumbs={[{ label: "Work", href: "/work" }, { label: "Replay" }]} eyebrow="Workday Replay"
        title={<span className="flex flex-wrap items-center gap-3">{d.intern && (isAdmin ? <Link href={`/people/${d.intern.id}`} className="inline-flex items-center gap-2 hover:text-accent"><Avatar name={d.intern.name} size="md" working={s.status === "active"} />{d.intern.name}</Link> : <span className="inline-flex items-center gap-2"><Avatar name={d.intern.name} size="md" working={s.status === "active"} />{d.intern.name}</span>)}<span className="text-ink-3 font-normal text-base">{formatDate(s.startedAt, { weekday: "long", month: "long", day: "numeric" })}</span></span>}
        description={<span className="t-num">{formatTime(s.startedAt)}{s.endedAt ? ` – ${formatTime(s.endedAt)}` : " – now"}</span>}
        actions={<><Button variant="outline" size="sm" onClick={() => setRawOpen(true)}><Database className="h-4 w-4" />Raw evidence</Button>{s.status === "active" && <Pill tone="work" className="h-8 px-2.5 text-xs">Live · <LiveClock since={s.startedAt} /></Pill>}</>} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* Legend + filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {([["all", "Everything", counts.observed + counts.system + counts.unknown], ["observed", "Observed", counts.observed], ["system", "System events", counts.system], ["unknown", "Unknown", counts.unknown]] as const).map(([k, label, n]) => (
              <button key={k} onClick={() => setFilter(k as Kind | "all")} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 h-7 text-xs font-medium transition-colors", filter === k ? "border-line-strong bg-surface text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
                {k === "observed" && <span className="h-2 w-2 rounded-full bg-work" />}{k === "system" && <span className="h-2 w-2 rounded-full bg-accent" />}{k === "unknown" && <span className="h-2 w-2 rounded-sm border border-dashed border-ink-3" />}
                {label}<span className="t-num text-ink-4">{n}</span>
              </button>
            ))}
            <p className="ml-auto text-[11px] text-ink-4 hidden md:block">Observed = the Companion saw it · System = a recorded action · Unknown = nothing was recorded</p>
          </div>

          {events.length === 0 ? <div className="panel"><EmptyState icon={<Activity />} title="Nothing in this view" description="Switch the filter to see the rest of the session." /></div> : (
            <ol className="relative">
              {events.map((e, i) => {
                const meta = META[e.type] ?? { kind: "system" as Kind, tone: "neutral" as Tone, Icon: CircleDot };
                const isOpen = expanded.has(i);
                const expandable = e.type === "app_active" || e.type === "idle_observed";
                const first = i === 0, last = i === events.length - 1;
                return (
                  <li key={`${e.ts}-${e.type}-${i}`} className="relative flex gap-3 md:gap-4">
                    {/* time column */}
                    <div className="w-[52px] md:w-[64px] shrink-0 pt-3 text-right"><span className="t-num text-xs text-ink-3">{formatTime(e.ts)}</span></div>
                    {/* rail */}
                    <div className="relative flex w-6 shrink-0 justify-center">
                      <span className={cn("absolute top-0 bottom-0 w-px", first && "top-5", last && "bottom-auto h-5", meta.kind === "unknown" ? "border-l border-dashed border-line-strong" : "bg-line")} />
                      <span className={cn("relative mt-3 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-bg", meta.kind === "observed" ? "bg-work-soft text-work" : meta.kind === "unknown" ? "bg-surface-2 text-ink-3 border border-dashed border-ink-4" : meta.tone === "ok" ? "bg-ok-soft text-ok" : meta.tone === "info" ? "bg-info-soft text-info" : meta.tone === "work" ? "bg-work-soft text-work" : "bg-accent-soft text-accent")}><meta.Icon className="h-3 w-3" /></span>
                    </div>
                    {/* card */}
                    <div className={cn("mb-2 min-w-0 flex-1 rounded-lg border p-3 anim-fade-up", meta.kind === "observed" ? "border-line bg-surface" : meta.kind === "unknown" ? "border-dashed border-line-strong bg-transparent" : "border-transparent bg-transparent py-2")}>
                      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {e.taskId && (e.type === "task_started" || e.type === "task_submitted" || e.type === "task_approved") ? <Link href={`/tasks/${e.taskId}`} className="text-[13px] font-medium text-ink hover:text-accent">{e.label}</Link> : <span className={cn("text-[13px]", meta.kind === "observed" ? "font-medium text-ink" : meta.kind === "unknown" ? "text-ink-2" : "text-ink")}>{e.label}</span>}
                            <Pill tone={meta.kind === "observed" ? "work" : meta.kind === "unknown" ? "neutral" : "accent"} className="text-[11px]">{KIND_LABEL[meta.kind]}</Pill>
                          </div>
                          {e.detail && <p className="mt-0.5 text-xs text-ink-3">{e.detail}</p>}
                        </div>
                        {e.durationSeconds !== undefined && <span className="t-num text-xs text-ink-3">{formatDuration(e.durationSeconds)}</span>}
                      </div>
                      {e.type === "app_active" && e.interpretation?.inferred && <p className="mt-1.5 text-xs text-ink-3"><span className="t-label mr-1.5">Likely</span>{e.taskId ? <Link href={`/tasks/${e.taskId}`} className="hover:text-ink">{e.interpretation.inferred}</Link> : e.interpretation.inferred}</p>}
                      {expandable && (
                        <button onClick={() => setExpanded((set) => { const n = new Set(set); if (n.has(i)) n.delete(i); else n.add(i); return n; })} className="mt-2 inline-flex items-center gap-1 text-[11px] text-ink-3 hover:text-ink" aria-expanded={isOpen}>
                          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{pluralize(e.evidenceIds?.length ?? 0, "sample")} · {formatTime(e.ts)} to {formatTime(new Date(new Date(e.ts).getTime() + (e.durationSeconds ?? 0) * 1000))}
                        </button>
                      )}
                      {isOpen && <EvidenceRows sessionId={s.id} ids={e.evidenceIds ?? []} />}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <aside className="space-y-4 min-w-0">
          <Section title="Session">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-line bg-surface-2 p-3"><div className="t-label mb-1">Duration</div>{s.status === "active" ? <LiveClock since={s.startedAt} className="text-lg font-semibold" /> : <Metric value={formatDuration(s.durationSeconds ?? 0)} className="text-lg" />}</div>
              <div className="rounded-md border border-line bg-surface-2 p-3"><div className="t-label mb-1">Observed</div><Metric value={formatDuration(d.observedSeconds)} className="text-lg" /></div>
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs text-ink-3 mb-1"><span>Companion coverage</span><span className="t-num">{coverage}%</span></div>
              <ProgressBar value={coverage} tone="work" />
              <p className="mt-1.5 text-[11px] text-ink-4">{d.observedSeconds === 0 ? "No Companion activity. Only time and task events are recorded." : coverage < 100 ? "Gaps are shown as Unknown — never filled in." : "The whole session was observed."}</p>
            </div>
            {endReason && <div className="mt-3 rounded-md border border-warn/25 bg-warn-soft/50 px-3 py-2 text-xs text-ink-2"><strong className="text-ink">{endReason}.</strong> {s.endReason === "auto_timeout" ? "Nobody ended this shift, so the server closed it after 16 hours. Its duration may overstate real work." : "The intern didn't end this session themselves."}</div>}
          </Section>

          <ReportPanel d={d} isAdmin={isAdmin} canEdit={!isAdmin && user?.id === s.internId} />
        </aside>
      </div>

      <Dialog open={rawOpen} onOpenChange={setRawOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Raw evidence</DialogTitle><DialogDescription>Every activity sample the Companion sent for this session, exactly as stored. Nothing is summarized here.</DialogDescription></DialogHeader>
          <EvidenceRows sessionId={s.id} ids={null} />
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function EvidenceRows({ sessionId, ids }: { sessionId: string; ids: string[] | null }) {
  const q = useQuery<RawActivity[]>({ queryKey: [`/api/work-sessions/${sessionId}/activities`] });
  if (q.isLoading) return <div className="mt-2"><SkeletonRows rows={3} /></div>;
  if (q.error) return <p className="mt-2 text-xs text-danger">Couldn't load evidence: {(q.error as Error).message}</p>;
  const rows = (q.data ?? []).filter((r) => !ids || ids.includes(r.id));
  if (rows.length === 0) return <p className="mt-2 text-xs text-ink-3">No samples.</p>;
  return (
    <div className="mt-2 max-h-[60vh] overflow-auto scroll-thin rounded-md border border-line">
      <table className="w-full text-[12px]">
        <thead className="bg-surface-2 text-left text-ink-3 sticky top-0"><tr><th className="px-2 py-1.5 font-medium">From</th><th className="px-2 py-1.5 font-medium">Dur.</th><th className="px-2 py-1.5 font-medium">Application</th><th className="px-2 py-1.5 font-medium hidden md:table-cell">Window title</th><th className="px-2 py-1.5 font-medium">Document / domain</th><th className="px-2 py-1.5 font-medium">Idle</th></tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => <tr key={r.id} className="align-top"><td className="px-2 py-1.5 t-num text-ink-3 whitespace-nowrap">{formatTime(r.startedAt)}</td><td className="px-2 py-1.5 t-num text-ink-3 whitespace-nowrap">{formatDuration(r.durationSeconds)}</td><td className="px-2 py-1.5 text-ink">{r.application}</td><td className="px-2 py-1.5 text-ink-2 hidden md:table-cell max-w-[260px] truncate" title={r.windowTitle ?? ""}>{r.windowTitle ?? <span className="text-ink-4">—</span>}</td><td className="px-2 py-1.5 text-ink-2">{r.documentName ?? r.browserDomain ?? <span className="text-ink-4">unknown</span>}</td><td className="px-2 py-1.5 t-num text-ink-3">{r.idleSeconds != null ? `${Math.round(r.idleSeconds / 60)}m` : "—"}</td></tr>)}
        </tbody>
      </table>
    </div>
  );
}

function ReportPanel({ d, isAdmin, canEdit }: { d: TimelineData; isAdmin: boolean; canEdit: boolean }) {
  const r = d.summary;
  const qc = useQueryClient();
  const { toast } = useToast();
  const [note, setNote] = useState(r?.internNote ?? "");
  const submit = useMutation({
    mutationFn: async () => { if (note.trim() !== (r?.internNote ?? "")) await api("PATCH", `/api/work-sessions/${d.session.id}/summary`, { internNote: note.trim() }); await api("POST", `/api/work-sessions/${d.session.id}/summary/submit`); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [`/api/work-sessions/${d.session.id}/timeline`] }); toast({ title: "Report submitted" }); },
    onError: (e: Error) => toast({ title: "Couldn't submit", description: e.message, variant: "destructive" }),
  });
  if (d.session.status === "active") return <Section title="Shift report"><p className="text-[13px] text-ink-3">Generated when the shift ends.</p></Section>;
  if (!r) return <Section title="Shift report"><p className="text-[13px] text-ink-3">No report was generated for this session.</p></Section>;
  const observed = r.activityBreakdown.reduce((s, a) => s + a.seconds, 0);
  return (
    <Section title="Shift report" description={r.submittedAt ? `Submitted ${formatDateTime(r.submittedAt)}` : "Not submitted"}>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-md border border-line bg-surface-2 p-2.5"><div className="t-label mb-0.5">Submitted</div><Metric value={r.tasksSubmitted} /></div>
        <div className="rounded-md border border-line bg-surface-2 p-2.5"><div className="t-label mb-0.5">Approved</div><Metric value={r.tasksCompleted} /></div>
      </div>
      {r.activityBreakdown.length > 0 ? (
        <ul className="space-y-2">{r.activityBreakdown.map((a) => <li key={a.category}><div className="flex items-center justify-between text-xs"><span className="text-ink">{a.label}</span><span className="t-num text-ink-3">{formatDuration(a.seconds)}</span></div><ProgressBar value={a.seconds} max={Math.max(observed, 1)} tone="work" size="xs" className="mt-1" /></li>)}</ul>
      ) : <p className="text-xs text-ink-3">No Companion activity in this session.</p>}
      {r.nextStep && <p className="mt-3 text-xs text-ink-2"><span className="t-label mr-1.5">Next</span>{r.nextStep}</p>}
      {r.internNote && r.submittedAt && <div className="mt-3 rounded-md border border-line bg-surface-2 p-2.5 text-[13px] text-ink-2"><div className="t-label mb-1">Intern note</div>“{r.internNote}”</div>}
      {canEdit && !r.submittedAt && (
        <div className="mt-3 space-y-2">
          <label htmlFor="replay-note" className="t-label block">Add context (optional)</label>
          <Textarea id="replay-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="Anything your manager should know." />
          <Button size="sm" className="w-full" onClick={() => submit.mutate()} disabled={submit.isPending}>{submit.isPending ? "Submitting…" : "Submit report"}</Button>
        </div>
      )}
      {isAdmin && !r.submittedAt && <p className="mt-3 text-[11px] text-ink-4">The intern hasn't submitted this report yet.</p>}
      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-4"><Timer className="h-3 w-3" />Every number here is computed from stored records.</div>
    </Section>
  );
}
