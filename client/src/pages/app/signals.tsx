import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Radar, Clock, Eye, Ban, Activity, BellOff, ChevronDown, ChevronRight, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { api, tzOffset } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDateTime, relativeTime, pluralize } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Page, PageHeader, EmptyState, ErrorState, SkeletonRows, Avatar, Pill, Segmented, type Tone } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Signal { key: string; type: string; severity: "high" | "medium"; headline: string; description: string; internId?: string; internName?: string; taskId?: string; projectId?: string; taskTitle?: string | null; projectTitle?: string | null; href: string; source: string; evidence: { label: string; value: string }[]; actions: { label: string; kind: string; taskId?: string; projectId?: string; userId?: string }[] }

type GroupKey = "attention" | "deadline" | "review" | "blocked" | "workflow";
const GROUPS: { key: GroupKey; label: string; description: string; Icon: typeof Radar; tone: Tone; types: string[] }[] = [
  { key: "blocked", label: "Blocked", description: "Work that can't move until something changes.", Icon: Ban, tone: "danger", types: ["possible_blocker"] },
  { key: "deadline", label: "Deadlines", description: "Past due or about to be.", Icon: Clock, tone: "warn", types: ["deadline_risk", "project_at_risk"] },
  { key: "review", label: "Waiting on you", description: "Decisions only a manager can make.", Icon: Eye, tone: "info", types: ["pending_review", "pending_proposal"] },
  { key: "workflow", label: "Workflow", description: "Patterns in sessions and assignments worth a look.", Icon: Activity, tone: "accent", types: ["workflow_stalled", "no_work_assigned", "overloaded", "inactive", "unusual_hours"] },
];
const ISO = /^\d{4}-\d{2}-\d{2}T/;

export default function SignalsPage() {
  const key = `/api/signals?tzOffsetMinutes=${tzOffset()}`;
  const q = useQuery<Signal[]>({ queryKey: [key], refetchInterval: 60_000 });
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"all" | GroupKey>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const dismiss = useMutation({ mutationFn: (k: string) => api("POST", "/api/signals/dismiss", { key: k }), onSuccess: () => { qc.invalidateQueries({ queryKey: [key] }); qc.invalidateQueries({ queryKey: [`/api/overview?tzOffsetMinutes=${tzOffset()}`] }); toast({ title: "Dismissed for 3 days" }); }, onError: (e: Error) => toast({ title: "Couldn't dismiss", description: e.message, variant: "destructive" }) });
  const snooze = useMutation({ mutationFn: ({ k, days }: { k: string; days: number }) => api("POST", "/api/signals/snooze", { key: k, days }), onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: [key] }); qc.invalidateQueries({ queryKey: [`/api/overview?tzOffsetMinutes=${tzOffset()}`] }); toast({ title: `Snoozed for ${pluralize(v.days, "day")}` }); }, onError: (e: Error) => toast({ title: "Couldn't snooze", description: e.message, variant: "destructive" }) });

  const grouped = useMemo(() => {
    const all = q.data ?? [];
    return GROUPS.map((g) => ({ ...g, items: all.filter((s) => g.types.includes(s.type)) })).filter((g) => g.items.length > 0);
  }, [q.data]);
  const high = (q.data ?? []).filter((s) => s.severity === "high").length;
  const visible = view === "all" ? grouped : grouped.filter((g) => g.key === view);

  return (
    <Page>
      <PageHeader title="Signals" description="What needs a manager's attention, with the evidence behind each one. Conditions, never judgments."
        actions={<Button variant="outline" size="sm" asChild><Link href="/pulse?q=What%20needs%20my%20attention%3F"><Sparkles className="h-4 w-4 text-pulse" />Ask Pulse</Link></Button>}>
        {(q.data?.length ?? 0) > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Segmented value={view} onChange={setView} options={[{ value: "all", label: "All", count: q.data!.length }, ...grouped.map((g) => ({ value: g.key, label: g.label, count: g.items.length }))]} />
            {high > 0 && <span className="text-xs text-ink-3">{pluralize(high, "high-priority signal")}</span>}
          </div>
        )}
      </PageHeader>

      {q.isLoading ? <div className="panel p-4"><SkeletonRows rows={6} /></div>
        : q.error ? <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
        : (q.data?.length ?? 0) === 0 ? <div className="panel"><EmptyState icon={<Radar />} title="All quiet" description="No overdue, blocked, stalled, or waiting work right now. Signals are computed live from tasks and Work Mode sessions, so this updates on its own." /></div>
        : (
          <div className="space-y-6">
            {visible.map((g) => (
              <section key={g.key}>
                <div className="mb-2 flex items-center gap-2"><g.Icon className={cn("h-4 w-4", `text-${g.tone}`)} /><h2 className="t-section">{g.label}</h2><span className="t-num text-xs text-ink-4">{g.items.length}</span><span className="hidden sm:inline text-xs text-ink-4">· {g.description}</span></div>
                <ul className="space-y-2">
                  {g.items.map((s) => {
                    const isOpen = open.has(s.key);
                    const message = s.actions.find((a) => a.kind === "message");
                    return (
                      <li key={s.key} className={cn("panel overflow-hidden anim-fade-up", s.severity === "high" && "border-l-2 border-l-danger")}>
                        <div className="flex items-start gap-3 p-3.5">
                          <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", s.severity === "high" ? "bg-danger" : "bg-warn")} aria-label={s.severity === "high" ? "High severity" : "Medium severity"} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[13px] font-semibold text-ink">{s.headline}</span>
                              {s.internName && s.internId && <Link href={`/people/${s.internId}`} className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><Avatar name={s.internName} size="xs" />{s.internName}</Link>}
                              <Pill tone="neutral" className="text-[11px]">{s.source}</Pill>
                            </div>
                            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{s.description}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <Button size="xs" variant="outline" asChild><Link href={s.href}>{s.taskId ? "Open task" : s.projectId ? "Open project" : "Open profile"}<ArrowRight className="h-3 w-3" /></Link></Button>
                              {message?.userId && <Button size="xs" variant="ghost" asChild><Link href={`/messages?userId=${message.userId}`}><MessageSquare className="h-3 w-3" />Message</Link></Button>}
                              <button onClick={() => setOpen((set) => { const n = new Set(set); if (n.has(s.key)) n.delete(s.key); else n.add(s.key); return n; })} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-ink-3 hover:text-ink" aria-expanded={isOpen}>
                                {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}Evidence
                              </button>
                            </div>
                            {isOpen && (
                              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-line bg-surface-2 p-3 text-xs">
                                {s.evidence.map((e, i) => <div key={i} className="contents"><dt className="text-ink-3">{e.label}</dt><dd className="text-ink">{ISO.test(e.value) ? <>{formatDateTime(e.value)} <span className="text-ink-4">({relativeTime(e.value)})</span></> : e.value}</dd></div>)}
                                {s.evidence.length === 0 && <dd className="col-span-2 text-ink-3">Derived from the task and session records linked above.</dd>}
                              </dl>
                            )}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label="Snooze or dismiss"><BellOff className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => snooze.mutate({ k: s.key, days: 1 })}>Snooze 1 day</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => snooze.mutate({ k: s.key, days: 7 })}>Snooze 1 week</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => dismiss.mutate(s.key)}>Dismiss (3 days)</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <p className="text-[11px] text-ink-4">Snoozed and dismissed signals come back automatically if the condition still holds when the period ends.</p>
          </div>
        )}
    </Page>
  );
}
