import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Loader2, CheckCircle2, Circle, PlayCircle, Eye, Ban,
  FileText, Briefcase, TrendingUp, Clock,
} from "lucide-react";

interface InternProfileProps {
  internId: string;
}

const TASK_STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  todo: { label: "To Do", cls: "bg-gray-100 text-gray-700 border-gray-200", icon: Circle },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: PlayCircle },
  in_review: { label: "In Review", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Eye },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  blocked: { label: "Blocked", cls: "bg-red-50 text-red-700 border-red-200", icon: Ban },
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
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!intern) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-gray-500 font-medium">Intern not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/")}>Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 text-gray-500" onClick={() => setLocation("/")} data-testid="button-back-to-dashboard">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Dashboard
        </Button>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-[#E8604F]/15 rounded-full flex items-center justify-center text-[#E8604F] font-semibold text-xl shrink-0">
              {intern.name[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900" data-testid="text-intern-profile-name">{intern.name}</h1>
              <p className="text-sm text-gray-500" data-testid="text-intern-profile-email">{intern.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Tasks</p>
              <p className="text-xl font-bold text-gray-900">{stats.completed}/{stats.total}</p>
              <p className="text-xs text-gray-400">{stats.completionPct}% complete</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
              <p className="text-xs text-gray-500 uppercase tracking-wide">In Progress</p>
              <p className="text-xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
            <div className={`rounded-lg p-3 border ${stats.blocked > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Blocked</p>
              <p className={`text-xl font-bold ${stats.blocked > 0 ? "text-red-700" : "text-gray-900"}`}>{stats.blocked}</p>
            </div>
            <div className={`rounded-lg p-3 border ${stats.overdue > 0 ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
              <p className={`text-xl font-bold ${stats.overdue > 0 ? "text-amber-700" : "text-gray-900"}`}>{stats.overdue}</p>
            </div>
          </div>

          {intern.projects?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {intern.projects.map((p: any) => (
                <Badge key={p.id} variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 gap-1">
                  <Briefcase className="w-3 h-3" />
                  {p.title}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600" />
          Work History
        </h2>

        {timeline.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl bg-white">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">No activity yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
            {timeline.map((event, i) => (
              <div key={i} className="p-4 flex gap-3" data-testid={`timeline-event-${i}`}>
                <div className="mt-0.5 shrink-0">
                  {event.kind === "task" && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                  {event.kind === "log" && <Clock className="w-4 h-4 text-gray-400" />}
                  {event.kind === "plan" && <FileText className="w-4 h-4 text-indigo-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-900 font-medium">{event.title}</p>
                  {event.detail && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{event.detail}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDateTime(event.ts)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
