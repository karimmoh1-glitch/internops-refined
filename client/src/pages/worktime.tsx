import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SearchFilterBar from "@/components/search-filter-bar";
import { SimplePageSkeleton } from "@/components/dashboard-skeleton";
import { formatDuration } from "@/components/shift-control";
import { Activity, AlertTriangle, Ban, Inbox, ListPlus, Briefcase, MessageSquare } from "lucide-react";

interface InternOverview {
  id: string;
  name: string;
  deactivatedAt: string | null;
  isActive: boolean;
  shiftStartedAt: string | null;
  currentTaskTitle: string | null;
  today: { totalSeconds: number; sessionCount: number; avgSessionSeconds: number };
  week: { totalSeconds: number; sessionCount: number; avgSessionSeconds: number };
  totalTasks: number;
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  tasksCompletedToday: number;
}

const FILTERS = [
  { value: "working", label: "Working Now", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  { value: "no_work", label: "No Work Assigned", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  { value: "overdue", label: "Has Overdue", color: "bg-red-500/10 text-red-400 border-red-500/20" },
  { value: "blocked", label: "Has Blocked", color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
];

export default function Worktime() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const { data: interns = [], isLoading } = useQuery<InternOverview[]>({
    queryKey: ["/api/worktime/overview"],
    refetchInterval: 20000,
  });

  const filtered = useMemo(() => {
    return interns
      .filter((i) => !i.deactivatedAt)
      .filter((i) => {
        if (filter === "working") return i.isActive;
        if (filter === "no_work") return i.openTasks === 0;
        if (filter === "overdue") return i.overdueTasks > 0;
        if (filter === "blocked") return i.blockedTasks > 0;
        return true;
      })
      .filter((i) => !search.trim() || i.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        return b.today.totalSeconds - a.today.totalSeconds;
      });
  }, [interns, filter, search]);

  const workingNow = interns.filter((i) => i.isActive && !i.deactivatedAt).length;
  const noWork = interns.filter((i) => i.openTasks === 0 && !i.deactivatedAt).length;
  const totalTodaySeconds = interns.reduce((sum, i) => sum + i.today.totalSeconds, 0);

  if (isLoading) return <SimplePageSkeleton rows={5} />;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white" data-testid="text-worktime-title">Worktime</h1>
          <p className="text-sm text-white/50 mt-1">Who's working, who isn't, and where attention is needed</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-card border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Interns</p>
            <p className="text-2xl font-bold text-white">{interns.filter((i) => !i.deactivatedAt).length}</p>
          </div>
          <div className="bg-card border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Working Now</p>
            <p className="text-2xl font-bold text-emerald-400">{workingNow}</p>
          </div>
          <div className="bg-card border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide mb-1">No Work Assigned</p>
            <p className="text-2xl font-bold text-amber-400">{noWork}</p>
          </div>
          <div className="bg-card border border-white/[0.08] rounded-xl p-4">
            <p className="text-xs text-white/50 uppercase tracking-wide mb-1">Hours Today</p>
            <p className="text-2xl font-bold text-white">{formatDuration(totalTodaySeconds)}</p>
          </div>
        </div>

        <SearchFilterBar
          placeholder="Search interns..."
          searchValue={search}
          onSearchChange={setSearch}
          filterOptions={FILTERS}
          activeFilter={filter}
          onFilterChange={setFilter}
          resultCount={filtered.length}
        />

        {filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl bg-card">
            <Inbox className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-white/50 font-medium">No interns match this view</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm divide-y divide-white/[0.06]">
            {filtered.map((intern) => (
              <div
                key={intern.id}
                role="button"
                tabIndex={0}
                onClick={() => setLocation(`/interns/${intern.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") setLocation(`/interns/${intern.id}`); }}
                className="w-full text-left p-4 flex flex-wrap items-center gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                data-testid={`row-worktime-${intern.id}`}
              >
                <div className="w-10 h-10 bg-[#6D5EF5]/15 rounded-full flex items-center justify-center text-[#6D5EF5] font-semibold shrink-0 relative">
                  {intern.name[0]?.toUpperCase() || "?"}
                  {intern.isActive && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white truncate">{intern.name}</span>
                    {intern.isActive ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs gap-1">
                        <Activity className="w-3 h-3" />Working
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-white/10 text-white/50 border-white/[0.08] text-xs">Not working</Badge>
                    )}
                    {intern.overdueTasks > 0 && (
                      <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1">
                        <AlertTriangle className="w-3 h-3" />{intern.overdueTasks} overdue
                      </Badge>
                    )}
                    {intern.blockedTasks > 0 && (
                      <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-xs gap-1">
                        <Ban className="w-3 h-3" />{intern.blockedTasks} blocked
                      </Badge>
                    )}
                    {intern.openTasks === 0 && (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">No work assigned</Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5 truncate">
                    {intern.isActive && intern.currentTaskTitle ? `Working on "${intern.currentTaskTitle}"` : `${intern.openTasks} open task${intern.openTasks !== 1 ? "s" : ""}`}
                  </p>
                </div>
                <div className="flex items-center flex-wrap gap-x-6 gap-y-2 text-sm w-full sm:w-auto sm:shrink-0 pl-14 sm:pl-0">
                  <div className="text-right">
                    <p className="text-xs text-white/40">Today</p>
                    <p className="font-semibold text-white tabular-nums">{formatDuration(intern.today.totalSeconds)}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-white/40">This Week</p>
                    <p className="font-semibold text-white tabular-nums">{formatDuration(intern.week.totalSeconds)}</p>
                  </div>
                  <div className="text-right hidden md:block">
                    <p className="text-xs text-white/40">Completed Today</p>
                    <p className="font-semibold text-white tabular-nums">{intern.tasksCompletedToday}</p>
                  </div>
                  {intern.openTasks === 0 && (
                    <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => setLocation(`/tasks?assign=${intern.id}`)}
                        data-testid={`button-assign-task-${intern.id}`}
                      >
                        <ListPlus className="w-3.5 h-3.5 mr-1" />Task
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => setLocation(`/?assignProject=${intern.id}`)}
                        data-testid={`button-assign-project-${intern.id}`}
                      >
                        <Briefcase className="w-3.5 h-3.5 mr-1" />Project
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={() => setLocation(`/chat?userId=${intern.id}`)}
                        data-testid={`button-message-${intern.id}`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
