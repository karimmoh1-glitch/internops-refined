import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Timer, History, Monitor, Users, Download, ChevronRight, Square, Send } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, tzOffset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDuration, formatDate, formatTime, dayLabel, pluralize, relativeTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Page, PageHeader, Section, Stat, EmptyState, ErrorState, SkeletonRows, Avatar, Pill, LiveClock, Segmented, ConfirmDialog, ProgressBar } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { WorkModeCard } from "@/components/work/WorkModeCard";

export default function WorkPage() {
  const { user } = useAuth();
  return user?.role === "admin" ? <TeamWork /> : <MyWork />;
}

/* ---------------- Intern ---------------- */
interface SessionRow { id: string; startedAt: string; endedAt: string | null; durationSeconds: number | null; status: string; endReason?: string | null }
interface Summary { today: { totalSeconds: number; sessionCount: number; tasksCompleted: number }; week: { totalSeconds: number; sessionCount: number; tasksCompleted: number }; overall: { totalSeconds: number; sessionCount: number; avgSessionSeconds: number; tasksCompleted: number } }

function endReasonLabel(reason?: string | null): { label: string; tone: "neutral" | "warn" | "info" } | null {
  if (reason === "auto_timeout") return { label: "Closed automatically", tone: "warn" };
  if (reason === "admin") return { label: "Ended by manager", tone: "info" };
  if (reason === "account") return { label: "Ended by account change", tone: "info" };
  return null;
}

function MyWork() {
  const params = new URLSearchParams(useSearch());
  const summary = useQuery<Summary>({ queryKey: [`/api/work-sessions/summary?tzOffsetMinutes=${tzOffset()}`], refetchInterval: 30_000 });
  const sessions = useQuery<SessionRow[]>({ queryKey: ["/api/work-sessions/mine"] });
  const grouped = useMemo(() => {
    const map = new Map<string, SessionRow[]>();
    for (const s of sessions.data ?? []) { const k = dayLabel(s.startedAt); if (!map.has(k)) map.set(k, []); map.get(k)!.push(s); }
    return Array.from(map.entries());
  }, [sessions.data]);

  return (
    <Page>
      <PageHeader title="Work" description="Your Work Mode sessions, time, and shift reports." actions={<Button variant="outline" size="sm" asChild><Link href="/download"><Download className="h-4 w-4" />Companion</Link></Button>} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <WorkModeCard autoEnd={params.get("end") === "1"} />
          <Section title="Sessions" description={sessions.data ? pluralize(sessions.data.length, "session") : undefined} flush>
            {sessions.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div> : sessions.error ? <ErrorState compact message={(sessions.error as Error).message} onRetry={() => sessions.refetch()} /> : (sessions.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<Timer />} title="No sessions yet" description="Start Work Mode above. Each session gets a report and a Workday Replay you can open any time." />
            ) : (
              <div>
                {grouped.map(([day, items]) => (
                  <div key={day}>
                    <div className="px-4 py-1.5 t-label bg-surface-2/60 border-y border-line first:border-t-0">{day}</div>
                    <ul className="divide-y divide-line">
                      {items.map((s) => { const er = endReasonLabel(s.endReason); return (
                        <li key={s.id}>
                          <Link href={`/work/replay/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 row-hover">
                            <History className={cn("h-4 w-4 shrink-0", s.status === "active" ? "text-work" : "text-ink-3")} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 text-[13px] text-ink"><span className="t-num">{formatTime(s.startedAt)}{s.endedAt ? ` – ${formatTime(s.endedAt)}` : ""}</span>{s.status === "active" && <Pill tone="work">Active</Pill>}{er && <Pill tone={er.tone}>{er.label}</Pill>}</div>
                            </div>
                            <span className="t-num text-[13px] text-ink-2">{s.status === "active" ? <LiveClock since={s.startedAt} /> : formatDuration(s.durationSeconds ?? 0)}</span>
                            <ChevronRight className="h-4 w-4 text-ink-4" />
                          </Link>
                        </li>
                      ); })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
        <aside className="space-y-4 min-w-0">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Today" value={summary.data ? formatDuration(summary.data.today.totalSeconds, { compact: true }) : "–"} hint={summary.data ? pluralize(summary.data.today.sessionCount, "session") : undefined} tone="work" icon={<Timer />} />
            <Stat label="This week" value={summary.data ? formatDuration(summary.data.week.totalSeconds, { compact: true }) : "–"} hint={summary.data ? pluralize(summary.data.week.sessionCount, "session") : undefined} icon={<Timer />} />
            <Stat label="All time" value={summary.data ? formatDuration(summary.data.overall.totalSeconds, { compact: true }) : "–"} hint={summary.data ? `${summary.data.overall.sessionCount} sessions · avg ${formatDuration(summary.data.overall.avgSessionSeconds, { compact: true })}` : undefined} icon={<History />} />
            <Stat label="Approved" value={summary.data?.overall.tasksCompleted ?? "–"} hint="tasks, all time" tone="ok" icon={<Send />} />
          </div>
          <Section title="How Work Mode works">
            <ol className="space-y-2 text-[13px] text-ink-2 list-decimal pl-4 marker:text-ink-4">
              <li>Start a session here or in the Companion. Time is recorded on the server from that moment.</li>
              <li>With the Companion open, it observes which app, document, and site are in front — nothing else — and only while the session runs.</li>
              <li>End the shift. Collection stops immediately and a factual report is generated for you to review and submit.</li>
              <li>Every session has a Workday Replay you and your manager can open.</li>
            </ol>
            <Link href="/settings?section=privacy" className="mt-3 inline-block text-xs text-accent hover:underline">What exactly is recorded</Link>
          </Section>
        </aside>
      </div>
    </Page>
  );
}

/* ---------------- Admin ---------------- */
interface Overview { working: { sessionId: string; personId: string; name: string; startedAt: string; currentTask: { id: string; title: string } | null; companion: string; lastObserved: { application: string; context: string | null; at: string } | null }[]; people: { id: string; name: string; working: boolean; openTasks: number; overdue: number; blocked: number; inReview: number; secondsToday: number; hoursWeek: number }[]; counts: { todaySeconds: number; working: number; interns: number } }
interface CompanySession { id: string; internId: string; internName: string; startedAt: string; endedAt: string | null; durationSeconds: number | null; status: string; endReason: string | null; reportSubmittedAt: string | null; observed: number }

function TeamWork() {
  const key = `/api/overview?tzOffsetMinutes=${tzOffset()}`;
  const ov = useQuery<Overview>({ queryKey: [key], refetchInterval: 30_000 });
  const [range, setRange] = useState<"7" | "30">("7");
  const sessions = useQuery<CompanySession[]>({ queryKey: [`/api/work-sessions/company?days=${range}`], refetchInterval: 60_000 });
  const [endTarget, setEndTarget] = useState<{ id: string; name: string } | null>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const endShift = useMutation({ mutationFn: (id: string) => api("POST", `/api/interns/${id}/end-shift`), onSuccess: () => { setEndTarget(null); qc.invalidateQueries({ queryKey: [key] }); qc.invalidateQueries({ queryKey: [`/api/work-sessions/company?days=${range}`] }); toast({ title: "Shift ended", description: "The intern has been notified and a report was generated." }); }, onError: (e: Error) => toast({ title: "Couldn't end that shift", description: e.message, variant: "destructive" }) });

  const d = ov.data;
  const people = useMemo(() => [...(d?.people ?? [])].sort((a, b) => Number(b.working) - Number(a.working) || b.secondsToday - a.secondsToday), [d]);
  const maxToday = Math.max(1, ...people.map((p) => p.secondsToday));

  return (
    <Page width="wide">
      <PageHeader title="Work" description="Who is in Work Mode, recorded time, and every session's replay." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          <Section title="In Work Mode now" description={d ? `${pluralize(d.counts.working, "person", "people")} · ${formatDuration(d.counts.todaySeconds)} recorded today across the team` : undefined} flush>
            {ov.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> : ov.error ? <ErrorState compact message={(ov.error as Error).message} onRetry={() => ov.refetch()} /> : d!.working.length === 0 ? (
              <EmptyState compact icon={<Timer />} title="No active sessions" description="When someone starts Work Mode they appear here with a live timer, their current task, and what the Companion observes." />
            ) : (
              <ul className="divide-y divide-line">
                {d!.working.map((w) => (
                  <li key={w.sessionId} className="flex items-center gap-3 px-4 py-3">
                    <Avatar name={w.name} working />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><Link href={`/people/${w.personId}`} className="text-[13px] font-medium text-ink hover:text-accent truncate">{w.name}</Link><LiveClock since={w.startedAt} className="text-xs text-work" /></div>
                      <p className="text-xs text-ink-3 truncate">{w.currentTask ? <Link href={`/tasks/${w.currentTask.id}`} className="hover:text-ink">{w.currentTask.title}</Link> : "No task in progress"}{w.lastObserved && <span> · <Monitor className="inline h-3 w-3 -mt-px" /> {w.lastObserved.application}{w.lastObserved.context ? ` — ${w.lastObserved.context}` : ""} ({relativeTime(w.lastObserved.at)})</span>}</p>
                    </div>
                    <Pill tone={w.companion === "connected" ? "work" : w.companion === "stale" ? "warn" : "neutral"}>{w.companion === "connected" ? "Companion" : w.companion === "stale" ? "Not reporting" : "Time only"}</Pill>
                    <Button variant="ghost" size="sm" asChild><Link href={`/work/replay/${w.sessionId}`}>Replay</Link></Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`End ${w.name}'s shift`} onClick={() => setEndTarget({ id: w.personId, name: w.name })}><Square className="h-3.5 w-3.5" /></Button>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Sessions" actions={<Segmented value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }]} />} flush>
            {sessions.isLoading ? <div className="p-4"><SkeletonRows rows={6} /></div> : sessions.error ? <ErrorState compact message={(sessions.error as Error).message} onRetry={() => sessions.refetch()} /> : (sessions.data?.length ?? 0) === 0 ? (
              <EmptyState compact icon={<History />} title="No sessions in this period" description="Sessions appear as interns use Work Mode." />
            ) : (
              <ul className="divide-y divide-line">
                {sessions.data!.map((s) => { const er = endReasonLabel(s.endReason); const coverage = s.durationSeconds ? Math.min(100, Math.round((s.observed / s.durationSeconds) * 100)) : 0; return (
                  <li key={s.id}>
                    <Link href={`/work/replay/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 row-hover">
                      <Avatar name={s.internName} size="sm" working={s.status === "active"} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]"><span className="font-medium text-ink truncate">{s.internName}</span><span className="t-num text-ink-3">{formatDate(s.startedAt)} · {formatTime(s.startedAt)}{s.endedAt ? ` – ${formatTime(s.endedAt)}` : ""}</span>{s.status === "active" && <Pill tone="work">Active</Pill>}{er && <Pill tone={er.tone}>{er.label}</Pill>}</div>
                        {s.status === "completed" && <div className="mt-1 flex items-center gap-2"><ProgressBar value={coverage} tone="work" size="xs" className="max-w-[140px]" /><span className="text-[11px] text-ink-4">{s.observed > 0 ? `${coverage}% observed` : "time only"}{s.reportSubmittedAt ? " · report submitted" : " · report not submitted"}</span></div>}
                      </div>
                      <span className="t-num text-[13px] text-ink-2 shrink-0">{s.status === "active" ? <LiveClock since={s.startedAt} /> : formatDuration(s.durationSeconds ?? 0)}</span>
                      <ChevronRight className="h-4 w-4 text-ink-4" />
                    </Link>
                  </li>
                ); })}
              </ul>
            )}
          </Section>
        </div>

        <aside className="min-w-0">
          <Section title="Today by person" description="Recorded Work Mode time" flush>
            {ov.isLoading ? <div className="p-4"><SkeletonRows rows={5} /></div> : people.length === 0 ? <EmptyState compact icon={<Users />} title="No interns yet" action={<Button size="sm" asChild><Link href="/people?invite=1">Invite an intern</Link></Button>} /> : (
              <ul className="divide-y divide-line">
                {people.map((p) => (
                  <li key={p.id}>
                    <Link href={`/people/${p.id}`} className="block px-4 py-2.5 row-hover">
                      <div className="flex items-center gap-2"><Avatar name={p.name} size="xs" working={p.working} /><span className="text-[13px] text-ink truncate flex-1">{p.name}</span><span className="t-num text-xs text-ink-2">{formatDuration(p.secondsToday, { compact: true })}</span></div>
                      <div className="mt-1.5 flex items-center gap-2"><ProgressBar value={p.secondsToday} max={maxToday} tone={p.working ? "work" : "neutral"} size="xs" /><span className="text-[11px] text-ink-4 shrink-0 w-14 text-right">{p.hoursWeek}h wk</span></div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
      <ConfirmDialog open={!!endTarget} onOpenChange={(o) => !o && setEndTarget(null)} title={`End ${endTarget?.name}'s shift?`} description="Time tracking and activity observation stop immediately. A report is generated and the intern is told you ended it." confirmLabel="End shift" pending={endShift.isPending} onConfirm={() => { if (endTarget) endShift.mutate(endTarget.id); }} />
    </Page>
  );
}
