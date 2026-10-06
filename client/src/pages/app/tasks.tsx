import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Plus, LayoutList, Columns3, Search, ListTodo, ChevronDown, MoreHorizontal, Play, Send, Ban, Undo2, Check, Pencil, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { dueLabel, pluralize } from "@/lib/format";
import { Page, PageHeader, EmptyState, ErrorState, SkeletonRows, StatusIcon, PriorityMark, Pill, Avatar, Segmented, Kbd, ConfirmDialog, TASK_STATUS_META, type TaskStatus, toneClasses } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TaskFormDialog, type TaskFormValues } from "@/components/tasks/TaskFormDialog";
import { SubmitDialog, BlockDialog, ReviewDialog } from "@/components/tasks/TaskActionDialogs";
import { useTaskMutations } from "@/components/tasks/useTaskMutations";

interface Task { id: string; title: string; description: string | null; status: TaskStatus; priority: "low" | "medium" | "high"; assigneeId: string; projectId: string | null; dueDate: string | null; blockedReason: string | null; feedback: string | null; submission: string | null; skillTags: string[]; dependsOnTaskId: string | null; updatedAt: string; createdAt: string; startedAt: string | null; submittedAt: string | null }
type View = "all" | "todo" | "in_progress" | "in_review" | "blocked" | "completed" | "overdue" | "due-soon";
const STATUS_ORDER: TaskStatus[] = ["in_progress", "in_review", "blocked", "todo", "completed"];

function useQueryParams() {
  const search = useSearch();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function TasksPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const params = useQueryParams();
  const [, setLocation] = useLocation();

  const [view, setView] = useState<View>(() => (params.get("view") as View) || (params.get("status") as View) || "all");
  const [layout, setLayout] = useState<"list" | "board">(() => (localStorage.getItem("internops_tasks_layout") as "list" | "board") || "list");
  const [assignee, setAssignee] = useState<string>(() => params.get("assigneeId") || "all");
  const [project, setProject] = useState<string>(() => params.get("projectId") || "all");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(() => params.get("new") === "1");
  // Deep links (`/tasks?new=1&assigneeId=…&projectId=…`) pre-fill the create
  // form. The values are captured here before the URL is replaced, so the
  // dialog keeps them; opening via the button or `n` starts blank.
  const [createInitial, setCreateInitial] = useState<Partial<TaskFormValues>>(() => ({ assigneeId: params.get("assigneeId") || "", projectId: params.get("projectId") || "" }));
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusIdx, setFocusIdx] = useState(-1);
  const [dialog, setDialog] = useState<{ kind: "submit" | "block" | "approve" | "changes" | "delete"; task: Task } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem("internops_tasks_layout", layout); }, [layout]);
  useEffect(() => {
    if (params.get("new") !== "1") return;
    setCreateInitial({ assigneeId: params.get("assigneeId") || "", projectId: params.get("projectId") || "" });
    setCreateOpen(true);
    setLocation("/tasks", { replace: true });
  }, [params, setLocation]);
  const openCreate = useCallback(() => { setCreateInitial({}); setCreateOpen(true); }, []);

  const tasksQ = useQuery<Task[]>({ queryKey: [isAdmin ? "/api/tasks" : "/api/tasks/mine"], refetchInterval: 30_000 });
  const interns = useQuery<{ id: string; name: string; deactivatedAt: string | null }[]>({ queryKey: ["/api/interns"], enabled: isAdmin });
  const managers = useQuery<{ id: string; name: string }[]>({ queryKey: ["/api/managers"], enabled: isAdmin });
  const projects = useQuery<{ id: string; title: string }[]>({ queryKey: ["/api/projects"] });
  const m = useTaskMutations();

  const nameById = useMemo(() => { const map = new Map<string, string>(); for (const i of interns.data ?? []) map.set(i.id, i.name); for (const a of managers.data ?? []) map.set(a.id, a.name); if (user) map.set(user.id, user.name); return map; }, [interns.data, managers.data, user]);
  const projectById = useMemo(() => new Map((projects.data ?? []).map((p) => [p.id, p.title])), [projects.data]);
  const now = Date.now();

  const filtered = useMemo(() => {
    let list = tasksQ.data ?? [];
    if (view === "overdue") list = list.filter((t) => t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now);
    else if (view === "due-soon") list = list.filter((t) => t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() >= now && new Date(t.dueDate).getTime() <= now + 3 * 86_400_000);
    else if (view !== "all") list = list.filter((t) => t.status === view);
    if (assignee !== "all") list = list.filter((t) => t.assigneeId === assignee);
    if (project !== "all") list = list.filter((t) => (project === "none" ? !t.projectId : t.projectId === project));
    if (search.trim()) { const q = search.trim().toLowerCase(); list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q) || t.skillTags.some((s) => s.toLowerCase().includes(q))); }
    const rank = (t: Task) => { const overdue = t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now ? 0 : 1; return [STATUS_ORDER.indexOf(t.status), overdue, t.dueDate ? new Date(t.dueDate).getTime() : Infinity, { high: 0, medium: 1, low: 2 }[t.priority]] as const; };
    return [...list].sort((a, b) => { const ra = rank(a), rb = rank(b); for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return (ra[i] as number) - (rb[i] as number); return a.title.localeCompare(b.title); });
  }, [tasksQ.data, view, assignee, project, search, now]);

  const counts = useMemo(() => {
    const all = tasksQ.data ?? [];
    const c: Record<string, number> = { all: all.length, todo: 0, in_progress: 0, in_review: 0, blocked: 0, completed: 0, overdue: 0 };
    for (const t of all) { c[t.status] = (c[t.status] ?? 0) + 1; if (t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now) c.overdue++; }
    return c;
  }, [tasksQ.data, now]);

  // Keyboard: j/k move, enter opens, n new (admin), / search, x select
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "j" || e.key === "ArrowDown") { e.preventDefault(); setFocusIdx((i) => Math.min(filtered.length - 1, i + 1)); }
      else if (e.key === "k" || e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(0, i - 1)); }
      else if (e.key === "Enter" && focusIdx >= 0 && filtered[focusIdx]) setLocation(`/tasks/${filtered[focusIdx].id}`);
      else if (e.key === "n" && isAdmin) { e.preventDefault(); openCreate(); }
      else if (e.key === "x" && isAdmin && focusIdx >= 0 && filtered[focusIdx]) { e.preventDefault(); toggleSelect(filtered[focusIdx].id); }
      else if (e.key === "Escape") { setSelected(new Set()); setFocusIdx(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, focusIdx, isAdmin, setLocation, openCreate]);

  const toggleSelect = useCallback((id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; }), []);

  const viewOptions = isAdmin
    ? [{ value: "all" as View, label: "All", count: counts.all }, { value: "in_review" as View, label: "In review", count: counts.in_review }, { value: "overdue" as View, label: "Overdue", count: counts.overdue }, { value: "blocked" as View, label: "Blocked", count: counts.blocked }, { value: "in_progress" as View, label: "In progress", count: counts.in_progress }, { value: "todo" as View, label: "To do", count: counts.todo }, { value: "completed" as View, label: "Approved", count: counts.completed }]
    : [{ value: "all" as View, label: "All", count: counts.all }, { value: "in_progress" as View, label: "In progress", count: counts.in_progress }, { value: "todo" as View, label: "To do", count: counts.todo }, { value: "in_review" as View, label: "In review", count: counts.in_review }, { value: "blocked" as View, label: "Blocked", count: counts.blocked }, { value: "completed" as View, label: "Approved", count: counts.completed }];

  // Memoised so the edit form isn't reset by the 30s refetch while someone is typing.
  const editInitial = useMemo<Partial<TaskFormValues> | undefined>(() => editTask ? { id: editTask.id, title: editTask.title, description: editTask.description ?? "", assigneeId: editTask.assigneeId, projectId: editTask.projectId ?? "", priority: editTask.priority, dueDate: editTask.dueDate ? new Date(editTask.dueDate).toISOString().slice(0, 10) : "", skillTags: editTask.skillTags ?? [], dependsOnTaskId: editTask.dependsOnTaskId ?? "" } : undefined, [editTask]);

  const grouped = useMemo(() => {
    const g = new Map<TaskStatus, Task[]>();
    for (const s of STATUS_ORDER) g.set(s, []);
    for (const t of filtered) g.get(t.status)!.push(t);
    return g;
  }, [filtered]);

  const rowActions = (t: Task) => {
    const items: RowAction[] = [];
    if (!isAdmin || t.assigneeId === user?.id) {
      if (t.status === "todo") items.push({ label: "Start", icon: <Play className="h-4 w-4" />, onSelect: () => m.start.mutate(t.id) });
      if (t.status === "in_progress" || t.status === "blocked") items.push({ label: "Submit for review", icon: <Send className="h-4 w-4" />, onSelect: () => setDialog({ kind: "submit", task: t }) });
      if (t.status === "todo" || t.status === "in_progress") items.push({ label: "Mark blocked", icon: <Ban className="h-4 w-4" />, onSelect: () => setDialog({ kind: "block", task: t }) });
      if (t.status === "blocked") items.push({ label: "Unblock", icon: <Undo2 className="h-4 w-4" />, onSelect: () => m.unblock.mutate(t.id) });
    }
    if (isAdmin) {
      if (t.status === "in_review") { items.push({ label: "Approve", icon: <Check className="h-4 w-4" />, onSelect: () => setDialog({ kind: "approve", task: t }) }); items.push({ label: "Request changes", icon: <Undo2 className="h-4 w-4" />, onSelect: () => setDialog({ kind: "changes", task: t }) }); }
      items.push({ label: "Edit", icon: <Pencil className="h-4 w-4" />, onSelect: () => setEditTask(t) });
      items.push({ label: "Delete", icon: <Trash2 className="h-4 w-4" />, onSelect: () => setDialog({ kind: "delete", task: t }), destructive: true });
    }
    return items;
  };

  const rowProps = { isAdmin, focusIdx, selected, onFocus: setFocusIdx, onToggleSelect: toggleSelect, projectName: (t: Task) => (t.projectId ? projectById.get(t.projectId) : undefined), assigneeName: (t: Task) => nameById.get(t.assigneeId), rowActions };

  const emptyTitle = view === "all" && assignee === "all" && project === "all" && !search ? (isAdmin ? "No tasks yet" : "Nothing assigned yet") : "No tasks match";
  const emptyDesc = view === "all" && assignee === "all" && project === "all" && !search
    ? (isAdmin ? "Create the first task. The assignee is notified, and from then on every submission, review, and Work Mode session links back to it." : "When your manager assigns work, it appears here with its deadline and priority.")
    : "Try a different view, assignee, or search.";

  return (
    <Page width="wide">
      <PageHeader title="Tasks" description={isAdmin ? "Assign, review, and track work across the team." : "Everything assigned to you, in priority order."}
        actions={<>
          <Segmented value={layout} onChange={setLayout} options={[{ value: "list", label: <><LayoutList className="h-3.5 w-3.5" /><span className="sr-only">List view</span></> }, { value: "board", label: <><Columns3 className="h-3.5 w-3.5" /><span className="sr-only">Board view</span></> }]} />
          {isAdmin && <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New task<Kbd className="ml-1 hidden md:inline-flex bg-accent-hover/40 border-accent-hover text-accent-ink/80">N</Kbd></Button>}
        </>}>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="overflow-x-auto scroll-thin max-w-full -mx-1 px-1 pb-1"><Segmented value={view} onChange={(v) => { setView(v); setFocusIdx(-1); }} options={viewOptions} /></div>
          <div className="flex-1" />
          {isAdmin && (
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Filter by assignee"><SelectValue placeholder="Everyone" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Everyone</SelectItem>{(interns.data ?? []).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
          {(projects.data?.length ?? 0) > 0 && (
            <Select value={project} onValueChange={setProject}>
              <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Filter by project"><SelectValue placeholder="Any project" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Any project</SelectItem><SelectItem value="none">No project</SelectItem>{(projects.data ?? []).map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-4" />
            <Input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter tasks" aria-label="Filter tasks" className="h-8 w-[180px] pl-8 text-xs" />
          </div>
        </div>
      </PageHeader>

      {tasksQ.isLoading ? <div className="panel p-4"><SkeletonRows rows={8} /></div>
        : tasksQ.error ? <ErrorState message={(tasksQ.error as Error).message} onRetry={() => tasksQ.refetch()} />
        : filtered.length === 0 ? <div className="panel"><EmptyState icon={<ListTodo />} title={emptyTitle} description={emptyDesc} action={isAdmin && view === "all" ? <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4" />New task</Button> : undefined} /></div>
        : layout === "list" ? (
          <div className="panel overflow-hidden">
            {view === "all" ? STATUS_ORDER.map((s) => {
              const items = grouped.get(s)!;
              if (items.length === 0) return null;
              const meta = TASK_STATUS_META[s];
              const startIdx = filtered.indexOf(items[0]);
              return (
                <div key={s}>
                  <div className={cn("flex items-center gap-2 px-3 md:px-4 h-8 bg-surface-2/60 border-y border-line first:border-t-0 text-xs font-medium", toneClasses[meta.tone].text)}><meta.Icon className="h-3.5 w-3.5" />{meta.label}<span className="t-num text-ink-4">{items.length}</span></div>
                  <div className="divide-y divide-line">{items.map((t, i) => <TaskListRow key={t.id} t={t} idx={startIdx + i} {...rowProps} />)}</div>
                </div>
              );
            }) : <div className="divide-y divide-line">{filtered.map((t, i) => <TaskListRow key={t.id} t={t} idx={i} {...rowProps} />)}</div>}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 items-start">
            {STATUS_ORDER.map((s) => { const meta = TASK_STATUS_META[s]; const items = grouped.get(s)!; return (
              <div key={s} className="rounded-lg bg-bg-sunken border border-line p-2 min-h-[120px]">
                <div className={cn("flex items-center gap-1.5 px-1 pb-2 text-xs font-medium", toneClasses[meta.tone].text)}><meta.Icon className="h-3.5 w-3.5" />{meta.label}<span className="t-num text-ink-4">{items.length}</span></div>
                <div className="space-y-2">{items.map((t) => <BoardCard key={t.id} t={t} assigneeName={isAdmin ? nameById.get(t.assigneeId) ?? "?" : undefined} />)}{items.length === 0 && <p className="px-1 py-3 text-xs text-ink-4">Empty</p>}</div>
              </div>
            ); })}
          </div>
        )}

      {filtered.length > 0 && <p className="mt-3 hidden md:flex items-center gap-2 text-[11px] text-ink-4"><Kbd>j</Kbd><Kbd>k</Kbd> move · <Kbd>↵</Kbd> open{isAdmin && <> · <Kbd>x</Kbd> select · <Kbd>n</Kbd> new</>} · <Kbd>/</Kbd> search</p>}

      {/* Bulk bar */}
      {isAdmin && selected.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 md:left-[calc(50%+116px)] z-30 flex items-center gap-2 rounded-lg border border-line bg-surface-raised px-3 py-2 pop anim-pop">
          <span className="text-[13px] font-medium">{pluralize(selected.size, "task")} selected</span>
          <BulkReassign selectedIds={Array.from(selected)} interns={(interns.data ?? []).filter((i) => !i.deactivatedAt)} onDone={() => setSelected(new Set())} />
          <Button variant="destructive" size="sm" onClick={() => setDialog({ kind: "delete", task: { id: "__bulk" } as Task })}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
          <Button variant="ghost" size="icon-sm" aria-label="Clear selection" onClick={() => setSelected(new Set())}><X className="h-4 w-4" /></Button>
        </div>
      )}

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} initial={createInitial} />
      <TaskFormDialog open={!!editTask} onOpenChange={(o) => !o && setEditTask(null)} initial={editInitial} />
      {dialog?.kind === "submit" && <SubmitDialog open onOpenChange={() => setDialog(null)} pending={m.submit.isPending} previousFeedback={dialog.task.feedback} resubmission={!!dialog.task.submittedAt} onSubmit={(text) => m.submit.mutate({ id: dialog.task.id, submission: text }, { onSuccess: () => setDialog(null) })} />}
      {dialog?.kind === "block" && <BlockDialog open onOpenChange={() => setDialog(null)} pending={m.block.isPending} onBlock={(reason) => m.block.mutate({ id: dialog.task.id, reason }, { onSuccess: () => setDialog(null) })} />}
      {(dialog?.kind === "approve" || dialog?.kind === "changes") && <ReviewDialog open onOpenChange={() => setDialog(null)} mode={dialog.kind} pending={m.approve.isPending || m.requestChanges.isPending} submission={dialog.task.submission} onApprove={(fb) => m.approve.mutate({ id: dialog.task.id, feedback: fb }, { onSuccess: () => setDialog(null) })} onRequestChanges={(fb) => m.requestChanges.mutate({ id: dialog.task.id, feedback: fb }, { onSuccess: () => setDialog(null) })} />}
      {dialog?.kind === "delete" && (
        <ConfirmDialog open onOpenChange={() => setDialog(null)} destructive pending={m.remove.isPending}
          title={dialog.task.id === "__bulk" ? `Delete ${pluralize(selected.size, "task")}?` : "Delete this task?"}
          description="Submissions and comments on it are deleted too. Work Mode evidence stays, unlinked. This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => { const ids = dialog.task.id === "__bulk" ? Array.from(selected) : [dialog.task.id]; for (const id of ids) await m.remove.mutateAsync(id).catch(() => {}); setSelected(new Set()); setDialog(null); }} />
      )}
    </Page>
  );
}

// Rows and cards live outside TasksPage on purpose: defining them inline
// gives React a new component type on every render, which remounts every
// row (and closes its open dropdown) each time hover moves the focus index.
type RowAction = { label: string; icon: React.ReactNode; onSelect: () => void; destructive?: boolean };

function TaskListRow({ t, idx, isAdmin, focusIdx, selected, onFocus, onToggleSelect, projectName, assigneeName, rowActions }: {
  t: Task; idx: number; isAdmin: boolean; focusIdx: number; selected: Set<string>; onFocus: (i: number) => void; onToggleSelect: (id: string) => void;
  projectName: (t: Task) => string | undefined; assigneeName: (t: Task) => string | undefined; rowActions: (t: Task) => RowAction[];
}) {
  const due = dueLabel(t.dueDate, t.status);
  const actions = rowActions(t);
  const project = projectName(t);
  const assignee = assigneeName(t);
  return (
    <div className={cn("group flex items-center gap-2.5 px-3 md:px-4 h-11 row-hover", focusIdx === idx && "bg-surface-2 ring-1 ring-inset ring-accent/40", selected.has(t.id) && "bg-accent-soft/50")} onMouseEnter={() => onFocus(idx)}>
      {isAdmin && <input type="checkbox" aria-label={`Select ${t.title}`} checked={selected.has(t.id)} onChange={() => onToggleSelect(t.id)} className="h-3.5 w-3.5 accent-[var(--accent)] shrink-0" />}
      <StatusIcon status={t.status} />
      <Link href={`/tasks/${t.id}`} className="min-w-0 flex-1 flex items-center gap-2">
        <span className="truncate text-[13px] text-ink">{t.title}</span>
        {t.blockedReason && <span className="hidden lg:inline truncate text-xs text-danger max-w-[200px]">· {t.blockedReason}</span>}
      </Link>
      {project && <span className="hidden xl:inline text-xs text-ink-3 truncate max-w-[160px]">{project}</span>}
      {isAdmin && <span className="hidden md:flex items-center gap-1.5 text-xs text-ink-3 w-[120px] truncate"><Avatar name={assignee ?? "?"} size="xs" /><span className="truncate">{(assignee ?? "Unknown").split(" ")[0]}</span></span>}
      {due ? <Pill tone={due.tone === "muted" ? "neutral" : due.tone} className="hidden sm:inline-flex w-[92px] justify-center">{due.text}</Pill> : <span className="hidden sm:block w-[92px]" />}
      <PriorityMark priority={t.priority} />
      {actions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`Actions for ${t.title}`} className="opacity-60 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {actions.map((a, i) => <DropdownMenuItem key={i} onSelect={a.onSelect} className={a.destructive ? "text-danger focus:text-danger" : ""}>{a.icon}{a.label}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function BoardCard({ t, assigneeName }: { t: Task; assigneeName?: string }) {
  const due = dueLabel(t.dueDate, t.status);
  return (
    <Link href={`/tasks/${t.id}`} className="block rounded-md border border-line bg-surface p-2.5 hover:border-line-strong hover:lift transition-all anim-pop">
      <p className="text-[13px] text-ink leading-snug line-clamp-2">{t.title}</p>
      {t.blockedReason && <p className="mt-1 text-xs text-danger line-clamp-2">{t.blockedReason}</p>}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">{assigneeName !== undefined && <Avatar name={assigneeName} size="xs" />}{due && <Pill tone={due.tone === "muted" ? "neutral" : due.tone}>{due.text}</Pill>}</div>
        <PriorityMark priority={t.priority} />
      </div>
    </Link>
  );
}

function BulkReassign({ selectedIds, interns, onDone }: { selectedIds: string[]; interns: { id: string; name: string }[]; onDone: () => void }) {
  const m = useTaskMutations();
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size="sm" disabled={busy}>{busy ? "Reassigning…" : "Reassign"}<ChevronDown className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-48 max-h-64 overflow-y-auto">
        {interns.map((i) => <DropdownMenuItem key={i.id} onSelect={async () => { setBusy(true); for (const id of selectedIds) await m.update.mutateAsync({ id, data: { assigneeId: i.id } }).catch(() => {}); setBusy(false); onDone(); }}><Avatar name={i.name} size="xs" />{i.name}</DropdownMenuItem>)}
        {interns.length === 0 && <><DropdownMenuSeparator /><div className="px-2 py-1.5 text-xs text-ink-3">No active interns</div></>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

