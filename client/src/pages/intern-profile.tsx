import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Loader2, CheckCircle2, Circle, PlayCircle, Eye, Ban,
  FileText, Briefcase, TrendingUp, Clock, Sparkles, Wand2, Award, GraduationCap,
  ListChecks, Plus, X,
} from "lucide-react";
import { aggregateSkillTags } from "@shared/skills";

interface PerformanceNarrative {
  id: string;
  content: string;
  aiGenerated: boolean;
  createdAt: string;
}

interface AlumniListEntry {
  id: string;
  alumniRecord: {
    internshipStartedAt: string | null;
    internshipEndedAt: string;
    totalTasksCompleted: number;
    totalTasksAssigned: number;
    skillTagCounts: { tag: string; count: number }[];
  };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

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

interface CompletionCriterion {
  id: string;
  text: string;
  optional: boolean;
  completed: boolean;
}

// Project "Definition of Done" — a lightweight, explicit checklist of what
// finished means, independent of task completion. Manager-owned: an admin
// defines and checks off criteria here; a project isn't "done" just
// because its progress bar says 100%.
function ProjectDefinitionOfDone({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [newCriterion, setNewCriterion] = useState("");

  const { data: project } = useQuery<{ completionCriteria: CompletionCriterion[] }>({
    queryKey: ["/api/projects", projectId],
    enabled: expanded,
  });
  const criteria = project?.completionCriteria || [];
  const doneCount = criteria.filter((c) => c.completed).length;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId] });

  const addMutation = useMutation({
    mutationFn: async (text: string) => apiRequest("POST", `/api/projects/${projectId}/criteria`, { text }),
    onSuccess: () => { setNewCriterion(""); invalidate(); },
    onError: (err: any) => toast({ title: "Couldn't add criterion", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) =>
      apiRequest("POST", `/api/criteria/${id}/toggle`, { completed }),
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: "Couldn't update criterion", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/criteria/${id}`),
    onSuccess: invalidate,
    onError: (err: any) => toast({ title: "Couldn't remove criterion", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="mt-3 border border-white/[0.06] rounded-lg overflow-hidden" data-testid={`section-dod-${projectId}`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-white/[0.03] transition-colors"
        data-testid={`button-toggle-dod-${projectId}`}
      >
        <span className="flex items-center gap-2 text-sm text-white/80">
          <ListChecks className="w-3.5 h-3.5 text-white/40" />
          Definition of Done — {projectTitle}
          {criteria.length > 0 && <span className="text-white/40">({doneCount}/{criteria.length})</span>}
        </span>
        <span className="text-xs text-white/40">{expanded ? "Hide" : "Show"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-1.5">
          {criteria.length === 0 && <p className="text-xs text-white/40 py-1">No criteria defined yet — add what "finished" means for this project.</p>}
          {criteria.map((c) => (
            <div key={c.id} className="flex items-center gap-2 group" data-testid={`row-criterion-${c.id}`}>
              <button onClick={() => toggleMutation.mutate({ id: c.id, completed: !c.completed })} data-testid={`button-toggle-criterion-${c.id}`}>
                {c.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4 text-white/30" />}
              </button>
              <span className={`text-sm flex-1 ${c.completed ? "text-white/40 line-through" : "text-white/80"}`}>
                {c.text}{c.optional && <span className="text-white/30 text-xs ml-1.5">(optional)</span>}
              </span>
              <button
                onClick={() => deleteMutation.mutate(c.id)}
                className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity"
                data-testid={`button-delete-criterion-${c.id}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-1.5">
            <Input
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && newCriterion.trim() && addMutation.mutate(newCriterion.trim())}
              placeholder="Add a criterion..."
              className="h-8 text-sm"
              data-testid={`input-new-criterion-${projectId}`}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              disabled={!newCriterion.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate(newCriterion.trim())}
              data-testid={`button-add-criterion-${projectId}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InternProfile({ internId }: InternProfileProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmAlumni, setConfirmAlumni] = useState(false);

  const { data: dashboard, isLoading: dashboardLoading } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<any[]>({ queryKey: ["/api/tasks"] });
  const { data: narrative } = useQuery<PerformanceNarrative | null>({
    queryKey: [`/api/interns/${internId}/performance-narrative`],
  });
  const { data: alumniList = [] } = useQuery<AlumniListEntry[]>({ queryKey: ["/api/alumni"] });
  const alumniRecord = alumniList.find((a) => a.id === internId)?.alumniRecord;

  const generateNarrativeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/interns/${internId}/performance-narrative`, {});
      return res.json();
    },
    onSuccess: (created: PerformanceNarrative) => {
      queryClient.setQueryData([`/api/interns/${internId}/performance-narrative`], created);
      toast({ title: created.aiGenerated ? "Summary generated" : "Summary generated (no AI key configured)" });
    },
    onError: (err: any) => toast({ title: "Failed to generate summary", description: err.message, variant: "destructive" }),
  });

  const badgeMutation = useMutation({
    mutationFn: async (awarded: boolean) => {
      const res = await apiRequest("POST", `/api/interns/${internId}/completion-badge`, { awarded });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Updated" });
    },
    onError: (err: any) => toast({ title: "Failed to update badge", description: err.message, variant: "destructive" }),
  });

  const transitionAlumniMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/interns/${internId}/transition-alumni`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni"] });
      setConfirmAlumni(false);
      toast({ title: "Transitioned to alumni" });
    },
    onError: (err: any) => toast({ title: "Failed to transition to alumni", description: err.message, variant: "destructive" }),
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/alumni/${internId}/reactivate`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/alumni"] });
      toast({ title: "Reactivated" });
    },
    onError: (err: any) => toast({ title: "Failed to reactivate", description: err.message, variant: "destructive" }),
  });

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

        {intern.alumniAt && (
          <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 mb-6 flex items-center justify-between gap-3" data-testid="banner-alumni">
            <div className="flex items-center gap-2.5">
              <GraduationCap className="w-5 h-5 text-indigo-400 shrink-0" />
              <div>
                <p className="text-sm font-medium text-indigo-300">Alumni since {formatDate(intern.alumniAt)}</p>
                {alumniRecord && (
                  <p className="text-xs text-indigo-300/60 mt-0.5">
                    {formatDate(alumniRecord.internshipStartedAt)} – {formatDate(alumniRecord.internshipEndedAt)} · {alumniRecord.totalTasksCompleted}/{alumniRecord.totalTasksAssigned} tasks completed
                  </p>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              data-testid="button-reactivate-alumnus"
            >
              {reactivateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Reactivate
            </Button>
          </div>
        )}

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

          {intern.projects?.map((p: any) => (
            <ProjectDefinitionOfDone key={p.id} projectId={p.id} projectTitle={p.title} />
          ))}

          <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Award className={`w-4 h-4 ${intern.completionBadgeAwardedAt ? "text-emerald-400" : "text-white/40"}`} />
              <span className="text-sm text-white/70">
                {intern.completionBadgeAwardedAt ? "Completion badge awarded" : "No completion badge yet"}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => badgeMutation.mutate(!intern.completionBadgeAwardedAt)}
              disabled={badgeMutation.isPending}
              data-testid="button-toggle-completion-badge"
            >
              {badgeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              {intern.completionBadgeAwardedAt ? "Revoke Badge" : "Award Completion Badge"}
            </Button>
          </div>

          {!intern.alumniAt && (
            <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-white/40" />
                <span className="text-sm text-white/70">Formally end this internship</span>
              </div>
              {!confirmAlumni ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-indigo-400 hover:text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10"
                  onClick={() => setConfirmAlumni(true)}
                  data-testid="button-transition-alumni"
                >
                  Transition to Alumni
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">This deactivates their login. Continue?</span>
                  <Button
                    size="sm"
                    onClick={() => transitionAlumniMutation.mutate()}
                    disabled={transitionAlumniMutation.isPending}
                    data-testid="button-confirm-transition-alumni"
                  >
                    {transitionAlumniMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    Confirm
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmAlumni(false)} disabled={transitionAlumniMutation.isPending}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-white/60" />
              Performance Summary
            </h2>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateNarrativeMutation.mutate()}
              disabled={generateNarrativeMutation.isPending}
              data-testid="button-generate-narrative"
            >
              {generateNarrativeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              {narrative ? "Regenerate" : "Generate Summary"}
            </Button>
          </div>
          {narrative ? (
            <p className="text-sm text-white/80 whitespace-pre-wrap" data-testid="text-performance-narrative">{narrative.content}</p>
          ) : (
            <p className="text-sm text-white/40">No summary yet. Generate one from {intern.name}'s completed work.</p>
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
