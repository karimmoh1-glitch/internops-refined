import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { FolderKanban, Lightbulb, Plus, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Page, PageHeader, Section, EmptyState, ErrorState, Skeleton } from "@/components/kit";
import { ProjectRow } from "@/components/projects/project-row";
import { AssignProjectDialog, ProposeProjectDialog, RejectProposalDialog, useApproveProposal } from "@/components/projects/dialogs";
import { PROJECT_KEYS, taskStatsFor, useInterns, useTaskList, type Project, type Role } from "@/components/projects/types";

type Filter = "all" | "proposals" | "review" | "active" | "planning" | "rejected";

const GROUPS: { key: Exclude<Filter, "all">; label: string; statuses: string[]; hint: string }[] = [
  { key: "proposals", label: "Proposals", statuses: ["pending_approval"], hint: "Intern-pitched projects waiting for a decision." },
  { key: "review", label: "Plan in review", statuses: ["submitted"], hint: "Plans submitted and waiting for approval." },
  { key: "active", label: "Active", statuses: ["active", "approved", "completed"], hint: "Approved plans being executed." },
  { key: "planning", label: "Planning", statuses: ["assigned", "planning"], hint: "Assigned, no approved plan yet." },
  { key: "rejected", label: "Declined", statuses: ["rejected"], hint: "Proposals that didn't go ahead." },
];

function groupOf(status: string): Exclude<Filter, "all"> {
  return GROUPS.find((g) => g.statuses.includes(status))?.key ?? "planning";
}

function ListSkeleton() {
  return (
    <div className="panel divide-y divide-line" aria-busy aria-label="Loading projects">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3">
          <Skeleton className="h-8 w-8 rounded-full hidden sm:block" />
          <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5" /><Skeleton className="h-3 w-1/4" /></div>
          <Skeleton className="h-1.5 w-32 hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const role: Role = user?.role ?? "intern";
  const isAdmin = role === "admin";
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const filter = (params.get("filter") as Filter | null) ?? "all";
  const validFilter: Filter = filter === "all" || GROUPS.some((g) => g.key === filter) ? filter : "all";

  const [query, setQuery] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [rejecting, setRejecting] = useState<Project | null>(null);

  // Deep links: /projects?new=1 (assign) and /projects?propose=1 (propose).
  useEffect(() => {
    if (params.get("new") === "1" && isAdmin) setAssignOpen(true);
    if (params.get("propose") === "1" && !isAdmin) setProposeOpen(true);
  }, [params, isAdmin]);

  const setFilter = (f: Filter) => setLocation(f === "all" ? "/projects" : `/projects?filter=${f}`, { replace: true });
  const closeDialog = (setter: (o: boolean) => void) => { setter(false); if (params.has("new") || params.has("propose")) setFilter(validFilter); };

  const projects = useQuery<Project[]>({ queryKey: PROJECT_KEYS.list, staleTime: 15_000 });
  const tasks = useTaskList(role);
  const interns = useInterns(isAdmin);
  const approve = useApproveProposal();

  const ownerName = (p: Project) => (isAdmin ? interns.data?.find((i) => i.id === p.internId)?.name ?? "Intern" : user?.name ?? "You");

  const all = projects.data ?? [];
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: all.length, proposals: 0, review: 0, active: 0, planning: 0, rejected: 0 };
    for (const p of all) c[groupOf(p.status)]++;
    return c;
  }, [all]);

  const q = query.trim().toLowerCase();
  const visible = all.filter((p) => (validFilter === "all" || groupOf(p.status) === validFilter) && (!q || p.title.toLowerCase().includes(q) || p.idea.toLowerCase().includes(q) || ownerName(p).toLowerCase().includes(q)));
  const grouped = GROUPS.map((g) => ({ ...g, items: visible.filter((p) => groupOf(p.status) === g.key) })).filter((g) => g.items.length > 0);

  const renderRows = (items: Project[]) => (
    <ul className="divide-y divide-line">
      {[...items].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()).map((p) => (
        <ProjectRow key={p.id} project={p} ownerName={ownerName(p)} role={role} stats={tasks.data ? taskStatsFor(tasks.data, p.id) : undefined}
          onApprove={isAdmin ? (proj) => approve.mutate(proj) : undefined} onReject={isAdmin ? setRejecting : undefined} approving={approve.isPending && approve.variables?.id === p.id} />
      ))}
    </ul>
  );

  const summary = all.length > 0 ? [counts.active && `${counts.active} active`, counts.review && `${counts.review} in review`, counts.proposals && `${pluralize(counts.proposals, "proposal")}`].filter(Boolean).join(" · ") : "";

  return (
    <Page>
      <PageHeader
        title="Projects"
        description={isAdmin ? (summary || "Every project in the company, with its plan state and task progress.") : (summary || "Your projects, their plans, and what you've logged.")}
        actions={isAdmin
          ? <Button onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" />Assign project</Button>
          : <Button onClick={() => setProposeOpen(true)}><Lightbulb className="h-4 w-4" />Propose a project</Button>}
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter projects">
          {([{ key: "all" as Filter, label: "All" }, ...GROUPS.map((g) => ({ key: g.key as Filter, label: g.label }))]).map((f) => {
            const n = counts[f.key];
            if (f.key !== "all" && n === 0 && validFilter !== f.key) return null;
            const active = validFilter === f.key;
            return (
              <button key={f.key} role="tab" aria-selected={active} onClick={() => setFilter(f.key)}
                className={cn("inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors", active ? "border-line-strong bg-surface text-ink" : "border-transparent text-ink-3 hover:bg-surface hover:text-ink")}>
                {f.label}<span className={cn("t-num text-[10.5px]", active ? "text-ink-3" : "text-ink-4")}>{n}</span>
              </button>
            );
          })}
        </div>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
          <Input aria-label="Search projects" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, idea, owner" className="h-8 pl-8 text-[13px]" />
        </div>
      </div>

      {projects.isLoading ? <ListSkeleton />
        : projects.error ? <div className="panel"><ErrorState message={(projects.error as Error).message} onRetry={() => projects.refetch()} /></div>
        : all.length === 0 ? (
          <div className="panel">
            <EmptyState icon={<FolderKanban />} title={isAdmin ? "No projects yet" : "You don't have a project yet"}
              description={isAdmin ? "Assign an intern a project with an idea and a minimum number of hours. They draft a plan with the AI mentor, you approve it, and execution is tracked here." : "Your manager assigns projects, or you can pitch your own. Once approved, you plan it with the mentor and log work against it here."}
              action={isAdmin ? <Button onClick={() => setAssignOpen(true)}><Plus className="h-4 w-4" />Assign the first project</Button> : <Button onClick={() => setProposeOpen(true)}><Lightbulb className="h-4 w-4" />Propose a project</Button>} />
          </div>
        )
        : visible.length === 0 ? (
          <div className="panel">
            <EmptyState compact icon={<Search />} title={q ? "No projects match" : `Nothing in “${GROUPS.find((g) => g.key === validFilter)?.label ?? "this filter"}”`}
              description={q ? "Try a different word, or clear the search." : GROUPS.find((g) => g.key === validFilter)?.hint}
              action={<Button variant="outline" size="sm" onClick={() => { setQuery(""); setFilter("all"); }}>Show all projects</Button>} />
          </div>
        )
        : validFilter === "all" ? (
          <div className="space-y-4 anim-stagger">
            {grouped.map((g) => (
              <Section key={g.key} title={g.label} description={g.hint} actions={<span className="t-num text-xs text-ink-3">{g.items.length}</span>} flush>
                {renderRows(g.items)}
              </Section>
            ))}
          </div>
        ) : (
          <Section title={GROUPS.find((g) => g.key === validFilter)?.label} description={GROUPS.find((g) => g.key === validFilter)?.hint} actions={<span className="t-num text-xs text-ink-3">{visible.length}</span>} flush>
            {renderRows(visible)}
          </Section>
        )}

      {isAdmin && <AssignProjectDialog open={assignOpen} defaultInternId={params.get("internId") ?? undefined} onOpenChange={(o) => (o ? setAssignOpen(true) : closeDialog(setAssignOpen))} />}
      {!isAdmin && <ProposeProjectDialog open={proposeOpen} onOpenChange={(o) => (o ? setProposeOpen(true) : closeDialog(setProposeOpen))} />}
      {isAdmin && <RejectProposalDialog project={rejecting} open={!!rejecting} onOpenChange={(o) => { if (!o) setRejecting(null); }} />}
    </Page>
  );
}
