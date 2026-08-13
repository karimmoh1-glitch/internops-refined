import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, CheckCircle2, Circle, PlayCircle, Eye, Ban,
  FileText, Briefcase, TrendingUp, Clock, Sparkles,
} from "lucide-react";
import { aggregateSkillTags } from "@shared/skills";

interface InternProfileProps {
  internId: string;
}

const TASK_STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  todo: { label: "To Do", cls: "bg-white/10 text-white/70 border-white/[0.08]", icon: Circle },
  in_progress: { label: "In Progress", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: PlayCircle },
  in_review: { label: "In Review", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Eye },
  completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  blocked: { label: "Blocked", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: Ban },
};

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

interface TimelineEvent {
  ts: string;
  kind: "task" | "log" | "plan";
  title: string;
  detail?: string;
}

export default function InternProfile({ internId }: InternProfileProps) {
  const [, setLocation] = useLocation();

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({ queryKey: ["/api/tasks"] });

  const intern = useMemo(() => {
    return (dashboard?.interns || []).find((i: any) => i.id === internId);
  }, [dashboard, internId]);

  const internTasks = useMemo(() => tasks.filter((t: any) => t.assigneeId === internId), [tasks, internId]);

  const stats = useMemo(() => {
    const total = internTasks.length;
    const completed = internTasks.filter((t: any) => t.status === "completed").length;
    const inProgress = internTasks.filter((t: any) => t.status === "in_progress").length;
    const blocked = internTasks.filter((t: any) => t.status === "blocked").length;
    const inReview = internTasks.filter((t: any) => t.status === "in_review").length;
    const now = Date.now();
    const overdue = internTasks.filter((t: any) => t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() < now).length;
    const completionPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, blocked, inReview, overdue, completionPct };
  }, [internTasks]);

  const skills = useMemo(
    () => aggregateSkillTags(internTasks.filter((t: any) => t.status === "completed")),
    [internTasks]
  );

  const timeline = useMemo(() => {
    const events: TimelineEvent[] = [];

    internTasks.forEach((t: any) => {
      events.push({ ts: t.createdAt, kind: "task", title: `Assigned task "${t.title}"` });
      if (t.submittedAt) events.push({ ts: t.submittedAt, kind: "task", title: `Submitted "${t.title}" for review`, detail: t.submission || undefined });
      if (t.completedAt) events.push({ ts: t.completedAt, kind: "task", title: `Completed "${t.title}"`, detail: t.feedback || undefined });
      if (t.status === "blocked" && t.blockedReason) events.push({ ts: t.updatedAt, kind: "task", title: `Blocked on "${t.title}"`, detail: t.blockedReason });
    });

    (intern?.projects || []).forEach((project: any) => {
      (project.weeklyLogs || []).forEach((log: any) => {
        events.push({
          ts: log.createdAt,
          kind: "log",
          title: `Logged work on "${project.title}"${log.weekNumber ? ` (Week ${log.weekNumber}${log.dayNumber ? `, Day ${log.dayNumber}` : ""})` : ""}`,
          detail: log.logText,
        });
      });
      (project.versions || []).forEach((v: any) => {
        events.push({ ts: v.createdAt, kind: "plan", title: `Plan v${v.versionNumber} created for "${project.title}"`, detail: v.status });
      });
    });

    return events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [internTasks, intern]);

  const isLoading = dashboardLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!intern) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-white/50 font-medium">Intern not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A09]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-white/50" onClick={() => setLocation("/")} data-testid="button-back-to-dashboard">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>

        <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#6D5EF5]/15 rounded-full flex items-center justify-center text-[#6D5EF5] font-semibold text-xl shrink-0">
              {intern.name[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white" data-testid="text-intern-profile-name">{intern.name}</h1>
              <p className="text-sm text-white/50" data-testid="text-intern-profile-email">{intern.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-[#0B0A09] rounded-lg p-3 border border-white/[0.06]">
              <p className="text-xs text-white/50 uppercase tracking-wide">Tasks</p>
              <p className="text-xl font-bold text-white">{stats.completed}/{stats.total}</p>
              <p className="text-xs text-white/40">{stats.completionPct}% complete</p>
            </div>
            <div className="bg-[#0B0A09] rounded-lg p-3 border border-white/[0.06]">
              <p className="text-xs text-white/50 uppercase tracking-wide">In Progress</p>
              <p className="text-xl font-bold text-white">{stats.inProgress}</p>
            </div>
            <div className={`rounded-lg p-3 border ${stats.blocked > 0 ? "bg-red-500/10 border-red-500/15" : "bg-[#0B0A09] border-white/[0.06]"}`}>
              <p className="text-xs text-white/50 uppercase tracking-wide">Blocked</p>
              <p className={`text-xl font-bold ${stats.blocked > 0 ? "text-red-400" : "text-white"}`}>{stats.blocked}</p>
            </div>
            <div className={`rounded-lg p-3 border ${stats.overdue > 0 ? "bg-amber-500/10 border-amber-500/15" : "bg-[#0B0A09] border-white/[0.06]"}`}>
              <p className="text-xs text-white/50 uppercase tracking-wide">Overdue</p>
              <p className={`text-xl font-bold ${stats.overdue > 0 ? "text-amber-400" : "text-white"}`}>{stats.overdue}</p>
            </div>
          </div>

          {intern.projects?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {intern.projects.map((p: any) => (
                <Badge key={p.id} variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 gap-1">
                  <Briefcase className="w-3 h-3" />
                  {p.title}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {skills.length > 0 && (
          <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white/60" />
              Skills
            </h2>
            <div className="space-y-2.5" data-testid="section-skills">
              {skills.map(({ tag, count }) => {
                const pct = Math.round((count / skills[0].count) * 100);
                return (
                  <div key={tag} className="flex items-center gap-3" data-testid={`row-skill-${tag}`}>
                    <span className="text-sm text-white/80 w-32 shrink-0 truncate">{tag}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-[#6D5EF5]" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-white/40 w-16 text-right shrink-0">{count} task{count === 1 ? "" : "s"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-white/60" />
          Work History
        </h2>

        {timeline.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl bg-[#141110]">
            <FileText className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-white/50 font-medium">No activity yet</p>
          </div>
        ) : (
          <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm divide-y divide-white/[0.06]">
            {timeline.map((event, i) => (
              <div key={i} className="p-4 flex gap-3" data-testid={`timeline-event-${i}`}>
                <div className="mt-0.5 shrink-0">
                  {event.kind === "task" && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                  {event.kind === "log" && <Clock className="w-4 h-4 text-white/40" />}
                  {event.kind === "plan" && <FileText className="w-4 h-4 text-indigo-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium">{event.title}</p>
                  {event.detail && <p className="text-sm text-white/50 mt-0.5 line-clamp-2">{event.detail}</p>}
                  <p className="text-xs text-white/40 mt-1">{formatDateTime(event.ts)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
