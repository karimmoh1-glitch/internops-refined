import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, FolderPlus, ListPlus, MessageSquare, MoreHorizontal, Power, Search, ShieldPlus, Square, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, Dot, EmptyState, ErrorState, Pill, RelativeTime, Segmented, Skeleton } from "@/components/kit";
import { ActionConfirm, type PendingAction, TypedDeleteDialog } from "./confirm";
import { useInternActions } from "./use-intern-actions";
import { type Alumnus, type InternRow, type Overview, overviewKey } from "./types";

type Filter = "all" | "working" | "attention" | "inactive";

interface RosterRow {
  id: string; name: string; email: string; deactivatedAt: string | null;
  working: boolean; startedAt: string | null; currentTask: { id: string; title: string } | null;
  openTasks: number; overdue: number; blocked: number; inReview: number; secondsToday: number; signals: number;
  lastActivity: string | null;
  hasMetrics: boolean;
}

const GRID = "md:grid-cols-[minmax(0,1.5fr)_116px_64px_minmax(90px,1fr)_56px_36px] xl:grid-cols-[minmax(0,1.5fr)_128px_76px_minmax(120px,1fr)_60px_60px_84px_36px]";

export function InternsTab({ onInvite, onAdd }: { onInvite: () => void; onAdd: () => void }) {
  const interns = useQuery<InternRow[]>({ queryKey: ["/api/interns"] });
  const overview = useQuery<Overview>({ queryKey: [overviewKey()], refetchInterval: 30_000, staleTime: 20_000 });
  const alumni = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });
  const actions = useInternActions();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [deleting, setDeleting] = useState<RosterRow | null>(null);

  const rows = useMemo<RosterRow[]>(() => {
    const alumniIds = new Set((alumni.data ?? []).map((a) => a.id));
    const people = new Map((overview.data?.people ?? []).map((p) => [p.id, p]));
    const working = new Map((overview.data?.working ?? []).map((w) => [w.personId, w]));
    const last = new Map<string, string>();
    for (const f of overview.data?.feed ?? []) {
      if (!f.personId) continue;
      const prev = last.get(f.personId);
      if (!prev || new Date(f.ts) > new Date(prev)) last.set(f.personId, f.ts);
    }
    return (interns.data ?? []).filter((i) => !alumniIds.has(i.id)).map((i) => {
      const p = people.get(i.id);
      const w = working.get(i.id);
      return {
        id: i.id, name: i.name, email: i.email, deactivatedAt: i.deactivatedAt,
        working: !!w || !!p?.working, startedAt: w?.startedAt ?? null, currentTask: w?.currentTask ?? null,
        openTasks: p?.openTasks ?? 0, overdue: p?.overdue ?? 0, blocked: p?.blocked ?? 0, inReview: p?.inReview ?? 0,
        secondsToday: p?.secondsToday ?? 0, signals: p?.signals ?? 0,
        lastActivity: w?.startedAt ?? last.get(i.id) ?? null,
        hasMetrics: !!p,
      };
    });
  }, [interns.data, overview.data, alumni.data]);

  const needsAttention = (r: RosterRow) => !r.deactivatedAt && (r.overdue > 0 || r.blocked > 0 || r.signals > 0);
  const counts = useMemo(() => ({
    all: rows.length,
    working: rows.filter((r) => r.working).length,
    attention: rows.filter(needsAttention).length,
    inactive: rows.filter((r) => !!r.deactivatedAt).length,
  }), [rows]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rank = (r: RosterRow) => (r.deactivatedAt ? 3 : r.working ? 0 : needsAttention(r) ? 1 : 2);
    return rows
      .filter((r) => filter === "all" ? true : filter === "working" ? r.working : filter === "attention" ? needsAttention(r) : !!r.deactivatedAt)
      .filter((r) => !s || r.name.toLowerCase().includes(s) || r.email.toLowerCase().includes(s))
      .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [rows, filter, q]);

  const ref = (r: RosterRow) => ({ id: r.id, name: r.name });
  const menuFor = (r: RosterRow) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative z-10 text-ink-3" aria-label={`Actions for ${r.name}`}><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild><Link href={`/messages?userId=${r.id}`}><MessageSquare className="h-4 w-4" />Message</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`/tasks?new=1&assigneeId=${r.id}`}><ListPlus className="h-4 w-4" />Assign task</Link></DropdownMenuItem>
        <DropdownMenuItem asChild><Link href={`/projects?new=1&internId=${r.id}`}><FolderPlus className="h-4 w-4" />Assign project</Link></DropdownMenuItem>
        <DropdownMenuSeparator />
        {r.working && (
          <DropdownMenuItem onSelect={() => setConfirm({
            title: `End ${r.name}'s shift?`,
            description: "Their Work Mode session closes now and a shift report is generated. They'll be notified that a manager ended it.",
            confirmLabel: "End shift", destructive: true, run: () => actions.endShift.mutateAsync(ref(r)),
          })}><Square className="h-4 w-4" />End shift</DropdownMenuItem>
        )}
        {r.deactivatedAt ? (
          <DropdownMenuItem onSelect={() => setConfirm({
            title: `Reactivate ${r.name}?`, description: "They can sign in again with everything intact.", confirmLabel: "Reactivate",
            run: () => actions.reactivate.mutateAsync(ref(r)),
          })}><Power className="h-4 w-4" />Reactivate</DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem onSelect={() => setConfirm({
              title: `Deactivate ${r.name}?`,
              description: "They won't be able to sign in and any active shift ends. Tasks, sessions, and messages stay. You can reactivate them any time.",
              confirmLabel: "Deactivate", destructive: true, run: () => actions.deactivate.mutateAsync(ref(r)),
            })}><Power className="h-4 w-4" />Deactivate</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setConfirm({
              title: `Promote ${r.name} to manager?`,
              description: "They get full manager access to every intern, task, project, and setting. Any active shift ends. Reverse it from the Managers tab.",
              confirmLabel: "Promote", run: () => actions.promote.mutateAsync(ref(r)),
            })}><ShieldPlus className="h-4 w-4" />Promote to manager</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(r)}><Trash2 className="h-4 w-4" />Delete permanently</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const status = (r: RosterRow) => r.deactivatedAt
    ? <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><Dot tone="neutral" />Deactivated</span>
    : r.working
      ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-work"><Dot tone="work" pulse />Working now</span>
      : <span className="inline-flex items-center gap-1.5 text-xs text-ink-3"><Dot tone="neutral" className="opacity-50" />Not working</span>;

  const taskCell = (r: RosterRow) => (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={cn("t-num text-[13px]", r.openTasks === 0 ? "text-ink-4" : "text-ink")}>{r.openTasks}</span>
      {r.overdue > 0 && <Pill tone="danger">{r.overdue} overdue</Pill>}
      {r.blocked > 0 && <Pill tone="warn">{r.blocked} blocked</Pill>}
    </span>
  );
  const num = (n: number, tone?: "warn") => <span className={cn("t-num text-[13px]", n === 0 ? "text-ink-4" : tone === "warn" ? "text-warn font-medium" : "text-ink")}>{n === 0 ? "—" : n}</span>;
  const today = (r: RosterRow) => <span className={cn("t-num text-[13px]", r.secondsToday === 0 ? "text-ink-4" : "text-ink")}>{r.secondsToday === 0 ? "—" : formatDuration(r.secondsToday, { compact: true })}</span>;

  const body = () => {
    if (interns.isLoading) return (
      <div className="divide-y divide-line" aria-busy aria-label="Loading interns">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3", GRID)}>
            <div className="flex items-center gap-3"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-1.5"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-44" /></div></div>
            <Skeleton className="h-3 w-20" /><Skeleton className="hidden h-3 w-10 md:block" /><Skeleton className="hidden h-3 w-24 md:block" /><Skeleton className="hidden h-3 w-6 md:block" /><Skeleton className="hidden h-3 w-6 md:block" /><Skeleton className="hidden h-3 w-14 md:block" /><Skeleton className="h-6 w-6" />
          </div>
        ))}
      </div>
    );
    if (interns.error) return <ErrorState message={(interns.error as Error).message} onRetry={() => void interns.refetch()} />;
    if (rows.length === 0) return (
      <EmptyState icon={<Users />} title="No interns yet" description="Invite someone with a link they use to set their own password, or create the account yourself and hand over the credentials."
        action={<><Button size="sm" onClick={onInvite}>Invite</Button><Button size="sm" variant="outline" onClick={onAdd}>Add intern</Button></>} />
    );
    if (visible.length === 0) return (
      <EmptyState compact title={q.trim() ? "No matches" : filter === "working" ? "Nobody is in Work Mode" : filter === "attention" ? "Nothing needs attention" : "No deactivated accounts"}
        description={q.trim() ? `Nothing matches “${q.trim()}” in this view.` : filter === "working" ? "Rows switch to “Working now” the moment a shift starts." : filter === "attention" ? "No overdue or blocked tasks and no open signals for anyone." : "Deactivated interns would appear here."}
        action={<Button variant="outline" size="sm" onClick={() => { setQ(""); setFilter("all"); }}>Show everyone</Button>} />
    );
    return (
      <ul className="divide-y divide-line">
        {visible.map((r) => (
          <li key={r.id} className={cn("relative row-hover", r.deactivatedAt && "opacity-70")}>
            {/* Desktop */}
            <div className={cn("hidden md:grid items-center gap-3 px-4 py-2.5", GRID)}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={r.name} size="md" working={r.working} />
                <div className="min-w-0">
                  <Link href={`/people/${r.id}`} className="block truncate text-[13.5px] font-medium text-ink before:absolute before:inset-0 hover:underline underline-offset-2">{r.name}</Link>
                  <p className="truncate text-xs text-ink-3">{r.working && r.currentTask ? <>On <span className="text-ink-2">{r.currentTask.title}</span></> : r.email}</p>
                </div>
              </div>
              <div>{status(r)}</div>
              <div>{today(r)}</div>
              <div>{taskCell(r)}</div>
              <div className="hidden xl:block">{num(r.inReview)}</div>
              <div>{num(r.signals, "warn")}</div>
              <div className="hidden xl:block text-xs text-ink-3">{r.lastActivity ? <RelativeTime value={r.lastActivity} /> : <span className="text-ink-4" title="Nothing in the recent activity feed">—</span>}</div>
              <div className="flex justify-end">{menuFor(r)}</div>
            </div>
            {/* Mobile */}
            <div className="flex items-start gap-3 px-4 py-3 md:hidden">
              <Avatar name={r.name} size="md" working={r.working} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/people/${r.id}`} className="truncate text-[13.5px] font-medium text-ink before:absolute before:inset-0">{r.name}</Link>
                  {menuFor(r)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                  {status(r)}
                  {r.secondsToday > 0 && <span>Today {today(r)}</span>}
                  {r.lastActivity && <span>Active <RelativeTime value={r.lastActivity} /></span>}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
                  <span>{taskCell(r)} open</span>
                  {r.inReview > 0 && <span><span className="t-num text-ink">{r.inReview}</span> in review</span>}
                  {r.signals > 0 && <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="h-3 w-3" /><span className="t-num">{r.signals}</span> signals</span>}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hairline-b">
        <Segmented value={filter} onChange={setFilter} options={[
          { value: "all", label: "All", count: counts.all },
          { value: "working", label: "Working", count: counts.working },
          { value: "attention", label: "Needs attention", count: counts.attention },
          { value: "inactive", label: "Inactive", count: counts.inactive },
        ]} />
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="h-8 pl-8 text-[13px]" aria-label="Search interns" />
        </div>
      </div>
      {overview.error && !interns.isLoading && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-warn-soft px-4 py-2 text-xs text-warn" role="status">
          <span>Live metrics didn't load: {(overview.error as Error).message}</span>
          <Button variant="ghost" size="xs" onClick={() => void overview.refetch()}>Retry</Button>
        </div>
      )}
      {!interns.isLoading && !interns.error && visible.length > 0 && (
        <div className={cn("hidden md:grid gap-3 px-4 py-2 hairline-b t-label", GRID)} aria-hidden>
          <span>Person</span><span>Status</span><span>Today</span><span>Open tasks</span><span className="hidden xl:block">Review</span><span>Signals</span><span className="hidden xl:block">Last activity</span><span />
        </div>
      )}
      {body()}
      <ActionConfirm action={confirm} onClose={() => setConfirm(null)} />
      <TypedDeleteDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }} name={deleting?.name ?? ""}
        title={`Delete ${deleting?.name ?? "this intern"} permanently?`}
        description="This erases their account and every task, work session, report, message, and device tied to it. There is no undo. If you only want to stop them signing in, deactivate instead."
        onConfirm={() => deleting ? actions.remove.mutateAsync(ref(deleting)) : Promise.resolve()} />
    </div>
  );
}
