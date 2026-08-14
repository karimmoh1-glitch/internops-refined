import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles, Loader2, Send, ChevronDown, ChevronRight,
  FileText, Clock, AlertCircle, Plus, ArrowLeft,
  MessageCircle, Pencil, Save, X, Trash2, RotateCcw,
  Calendar, Target, Zap, Layout, CheckCircle2, Search, MessageSquare,
  Shuffle, ThumbsDown, Scale, Building2, Layers, Flame, Shield, BookOpen, TrendingUp
} from "lucide-react";
import { InternDashboardSkeleton, WorkspaceSkeleton } from "@/components/dashboard-skeleton";
import SearchFilterBar from "@/components/search-filter-bar";
import { useIsMobile } from "@/hooks/use-mobile";
import CommandPalette, { useInternCommands } from "@/components/command-palette";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { PersonalProgressLineChart, WeeklyHoursBarChart } from "@/components/analytics-charts";
import GitHubPanel from "@/components/github-panel";
import { useLocation } from "wouter";

interface InternDashboardProps {
  user: { id: string; name: string; role: string };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface WeekPlan {
  weekNumber: number;
  milestone: string;
  deliverables: string[];
  successCriteria: string;
  hours: number;
}

interface PlanContent {
  hoursPerDay: number;
  daysPerWeek: number;
  numberOfWeeks: number;
  totalPlannedHours: number;
  weeks: WeekPlan[];
}

interface PlanVersion {
  id: string;
  versionNumber: number;
  status: string;
  contentJson: PlanContent;
  comments?: any[];
}

interface WeeklyLog {
  id: string;
  projectId: string;
  weekNumber: number;
  subtaskIndex: number | null;
  dayNumber: number | null;
  logText: string;
  createdAt: string;
}

interface LogComment {
  id: string;
  logId: string;
  content: string;
  createdAt: string;
  managerName?: string;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    ", " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDateTime(dateStr);
}

const STATUS_ORDER: Record<string, number> = {
  active: 0, submitted: 1, planning: 2, assigned: 3, approved: 4, completed: 5,
};

const STATUS_COLORS: Record<string, string> = {
  assigned: "bg-white/10 text-white/70 border-white/[0.08]",
  planning: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  submitted: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  completed: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  draft: "bg-white/10 text-white/60 border-white/[0.08]",
};

function getCompletionRate(project: any): number {
  const planContent = project.latestVersion?.contentJson ||
    (project.versions || []).find((v: any) => v.status === "approved")?.contentJson;
  if (!planContent || !planContent.weeks || planContent.weeks.length === 0) return 0;
  const totalWeeks = planContent.weeks.length;
  const logs: any[] = project.weeklyLogs || [];
  const weeksWithLogs = new Set(logs.map((l: any) => l.weekNumber));
  return Math.min((weeksWithLogs.size / totalWeeks) * 100, 100);
}

function getLastActivity(project: any): string {
  const logs: any[] = project.weeklyLogs || [];
  if (logs.length > 0) {
    const sorted = [...logs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted[0].createdAt;
  }
  return project.updatedAt || project.createdAt || new Date().toISOString();
}

export default function InternDashboard({ user }: InternDashboardProps) {
  const [view, setView] = useState<"projects">("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("projectId") || null;
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("projectId")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const { data: projects = [], isLoading: loadingProjects } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    refetchInterval: 20000,
  });

  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const commandItems = useInternCommands({
    projects: projects || [],
    onSelectProject: (id) => { setView("projects"); setSelectedProjectId(id); },
    onSignOut: () => {},
    onNavigateHome: () => { setView("projects"); setSelectedProjectId(null); },
  });

  useKeyboardShortcuts([
    { key: "k", meta: true, handler: () => setCommandPaletteOpen(true), description: "Open command palette" },
  ]);

  useEffect(() => {
    const handler = () => setCommandPaletteOpen(true);
    window.addEventListener("open-command-palette", handler);
    return () => window.removeEventListener("open-command-palette", handler);
  }, []);

  if (loadingProjects) {
    return <InternDashboardSkeleton />;
  }

  if (selectedProjectId) {
    const project = projects.find((p) => p.id === selectedProjectId);
    if (!project) {
      setSelectedProjectId(null);
      return null;
    }
    return (
      <>
        <ProjectWorkspace
          project={project}
          user={user}
          onBack={() => setSelectedProjectId(null)}
        />
        <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} items={commandItems} />
      </>
    );
  }

  return (
    <>
      <ProjectList
        projects={projects}
        onSelectProject={(id) => setSelectedProjectId(id)}
      />
      <CommandPalette open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} items={commandItems} />
    </>
  );
}

// Today / My Work / Upcoming / Recently Completed / Feedback, built from the
// intern's real assigned tasks. Quick actions here cover the common case
// (start a task); submitting or blocking opens the full Tasks page, which
// already has the dialogs for those.
const INTERN_ASK_PROMPTS = ["What's due soon?", "What should I focus on?", "Am I blocked on anything?"];

interface RelatedTasks {
  blockedTaskIds?: string[];
  overdueTaskIds?: string[];
}

interface AskMessage {
  role: "user" | "assistant";
  content: string;
  aiGenerated?: boolean;
  related?: RelatedTasks;
}

// Small clickable chips ("2 overdue", "1 blocked") beneath an AI response,
// routing to the matching pre-filtered Tasks view — mirrors the admin
// org-assistant's chips so the AI's answer is actionable, not just text.
function RelatedTaskChips({ related, onNavigate }: { related?: RelatedTasks; onNavigate: (status: string) => void }) {
  if (!related) return null;
  const chips: { label: string; status: string; count: number }[] = [
    { label: "overdue", status: "overdue", count: related.overdueTaskIds?.length || 0 },
    { label: "blocked", status: "blocked", count: related.blockedTaskIds?.length || 0 },
  ].filter((c) => c.count > 0);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {chips.map((c) => (
        <button
          key={c.status}
          onClick={() => onNavigate(c.status)}
          className="text-xs px-2.5 py-1 rounded-full border border-white/[0.1] text-white/60 hover:bg-white/[0.06] hover:text-white/80 transition-colors"
          data-testid={`chip-related-${c.status}`}
        >
          {c.count} {c.label}
        </button>
      ))}
    </div>
  );
}

// "Ask InternOps" — the intern-scoped counterpart to the admin org
// assistant. Backend structurally limits context to this intern's own
// tasks/projects (see server/routes.ts's /api/ai/intern-assistant), so
// this is never a generic chatbot that happens to know org-wide info.
function AskInternOpsCard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [input, setInput] = useState("");

  const askMutation = useMutation({
    mutationFn: async (question: string) => {
      const nextMessages = [...messages, { role: "user" as const, content: question }];
      setMessages(nextMessages);
      const res = await apiRequest("POST", "/api/ai/intern-assistant", {
        messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, aiGenerated: data.aiGenerated, related: data.related }]);
    },
    onError: (err: any) => toast({ title: "Ask InternOps is unavailable", description: err.message, variant: "destructive" }),
  });

  const ask = (question: string) => {
    if (!question.trim() || askMutation.isPending) return;
    setInput("");
    askMutation.mutate(question.trim());
  };

  return (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-[#6D5EF5]/40 via-[#8B7FF7]/20 to-transparent mb-4" data-testid="section-ask-internops">
      <div className="bg-card rounded-[11px] p-5">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-7 h-7 rounded-lg bg-surface-accent flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-[#8B7FF7]" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-white leading-tight">Ask InternOps</h3>
            <p className="text-[11px] text-white/40 leading-tight">Answers from your own tasks — nothing else</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {INTERN_ASK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => ask(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-white/[0.08] text-white/60 hover:bg-white/[0.06] transition-colors"
                data-testid={`button-intern-ask-prompt-${p.replace(/\s+/g, "-").toLowerCase()}`}
              >
                {p}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-3 max-h-72 overflow-y-auto">
            {messages.map((m, i) => (
              <div key={i} className={`text-sm ${m.role === "user" ? "text-right" : ""}`} data-testid={`intern-assistant-message-${i}`}>
                <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 whitespace-pre-wrap text-left ${m.role === "user" ? "bg-surface-accent text-white" : "bg-background text-white/90 border border-white/[0.06]"}`}>
                  {m.content}
                </div>
                {m.role === "assistant" && (
                  <RelatedTaskChips related={m.related} onNavigate={(status) => setLocation(`/tasks?status=${status}`)} />
                )}
              </div>
            ))}
            {askMutation.isPending && (
              <div className="text-sm">
                <div className="inline-flex items-center gap-1.5 bg-background border border-white/[0.06] rounded-lg px-3 py-2 text-white/40">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Ask about your tasks..."
            className="flex-1 focus-visible:ring-[#6D5EF5]/50"
            data-testid="input-intern-assistant"
          />
          <Button size="sm" onClick={() => ask(input)} disabled={!input.trim() || askMutation.isPending} className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-ask-intern-assistant">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// "What should I work on?" — a recommendation, never a command. Scored
// server-side from real deadline/priority/dependency data (see
// server/services/nextBestAction.ts); the intern can always ignore it and
// pick something else from the full task list below.
function NextBestActionCard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ recommended: { task: any; reason: string; blockingCount: number } | null; alternateCount: number }>({
    queryKey: ["/api/tasks/next-best"],
    refetchInterval: 15000,
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/tasks/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/next-best"] });
      toast({ title: "Task started" });
    },
    onError: (err: any) => toast({ title: "Couldn't start task", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !data?.recommended) return null;
  const { task, reason } = data.recommended;

  return (
    <div className="relative rounded-xl p-[1px] bg-gradient-to-br from-[#6D5EF5]/40 via-[#8B7FF7]/20 to-transparent mb-4" data-testid="section-next-best-action">
      <div className="bg-card rounded-[11px] p-5">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="w-4 h-4 text-[#8B7FF7]" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[#8B7FF7]">Your Next Best Action</span>
        </div>
        <h3 className="text-lg font-heading font-semibold text-white mb-1">{task.title}</h3>
        <p className="text-sm text-white/50 mb-4">{reason}</p>
        <div className="flex items-center gap-2">
          {task.status === "todo" ? (
            <Button size="sm" onClick={() => startMutation.mutate(task.id)} className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-start-next-best">
              Start Task
            </Button>
          ) : (
            <Button size="sm" onClick={() => setLocation("/tasks")} className="bg-[#6D5EF5] hover:bg-[#5142D6] text-white" data-testid="button-continue-next-best">
              Continue Task
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setLocation("/tasks")} data-testid="button-view-all-from-next-best">
            View All Tasks
          </Button>
        </div>
      </div>
    </div>
  );
}

function InternTaskOverview() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/tasks/mine"], refetchInterval: 15000 });

  const startMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/tasks/${id}/start`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/mine"] });
      toast({ title: "Task started" });
    },
    onError: (err: any) => toast({ title: "Couldn't start task", description: err.message, variant: "destructive" }),
  });

  if (isLoading || tasks.length === 0) return null;

  const now = Date.now();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999);

  const dueToday = tasks.filter((t: any) => t.dueDate && t.status !== "completed" && new Date(t.dueDate) >= startOfToday && new Date(t.dueDate) <= endOfToday);
  const myWork = tasks.filter((t: any) => t.status === "in_progress" || t.status === "blocked");
  const upcoming = tasks.filter((t: any) => t.dueDate && t.status !== "completed" && new Date(t.dueDate).getTime() > endOfToday.getTime())
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 5);
  const recentlyCompleted = tasks.filter((t: any) => t.status === "completed" && t.completedAt)
    .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 5);
  const withFeedback = tasks.filter((t: any) => t.feedback)
    .sort((a: any, b: any) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);
  const todoCount = tasks.filter((t: any) => t.status === "todo").length;

  return (
    <div className="mb-8 space-y-4" data-testid="section-intern-task-overview">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Today</h2>
        <Button size="sm" variant="outline" onClick={() => setLocation("/tasks")} data-testid="button-view-all-tasks">
          View All Tasks
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5">
          <h3 className="font-semibold text-white text-sm mb-3">Due Today {dueToday.length > 0 && `(${dueToday.length})`}</h3>
          {dueToday.length === 0 ? (
            <p className="text-sm text-white/40">Nothing due today.</p>
          ) : (
            <div className="space-y-2">
              {dueToday.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-white/70 truncate">{t.title}</span>
                  {t.status === "todo" && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => startMutation.mutate(t.id)} data-testid={`button-quick-start-${t.id}`}>Start</Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5">
          <h3 className="font-semibold text-white text-sm mb-3">My Work {myWork.length > 0 && `(${myWork.length})`}</h3>
          {myWork.length === 0 ? (
            <p className="text-sm text-white/40">{todoCount > 0 ? `${todoCount} task${todoCount > 1 ? "s" : ""} waiting to be started.` : "Nothing in progress."}</p>
          ) : (
            <div className="space-y-2">
              {myWork.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-white/70 truncate">{t.title}</span>
                  <Badge variant="outline" className={t.status === "blocked" ? "bg-red-500/10 text-red-400 border-red-500/20 text-xs" : "bg-blue-500/10 text-blue-400 border-blue-500/20 text-xs"}>
                    {t.status === "blocked" ? "Blocked" : "In Progress"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {upcoming.length > 0 && (
          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5">
            <h3 className="font-semibold text-white text-sm mb-3">Upcoming</h3>
            <div className="space-y-2">
              {upcoming.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-white/70 truncate">{t.title}</span>
                  <span className="text-xs text-white/40 whitespace-nowrap">{new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentlyCompleted.length > 0 && (
          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-5">
            <h3 className="font-semibold text-white text-sm mb-3">Recently Completed</h3>
            <div className="space-y-2">
              {recentlyCompleted.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="text-white/70 truncate">{t.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {withFeedback.length > 0 && (
          <div className="bg-blue-500/10 rounded-xl border border-blue-500/15 p-5 md:col-span-2">
            <h3 className="font-semibold text-white text-sm mb-3">Recent Feedback</h3>
            <div className="space-y-3">
              {withFeedback.map((t: any) => (
                <div key={t.id} className="text-sm">
                  <span className="text-white font-medium">{t.title}: </span>
                  <span className="text-white/60">{t.feedback}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectList({ projects, onSelectProject }: { projects: any[]; onSelectProject: (id: string) => void }) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data: internAnalytics } = useQuery<any>({ queryKey: ["/api/analytics/intern"] });

  const filtered = [...projects]
    .filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (p.title || "").toLowerCase().includes(q) || (p.idea || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const statusDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
      if (statusDiff !== 0) return statusDiff;
      return new Date(getLastActivity(b)).getTime() - new Date(getLastActivity(a)).getTime();
    });

  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-background" data-testid="no-project-state">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <NextBestActionCard />
          <InternTaskOverview />
          <div className="flex items-center justify-center py-12">
            <div className="text-center p-8 max-w-md">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-white/30" />
              </div>
              <h2 className="text-lg font-semibold text-white/70 mb-1">No Projects Yet</h2>
              <p className="text-white/50 text-sm" data-testid="text-no-project">
                Your manager will assign you a project soon. You'll be able to plan and track your work here.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="project-list">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" data-testid="text-dashboard-title">My Projects</h1>
            <p className="text-sm text-white/50 mt-1">{projects.length} project{projects.length !== 1 ? "s" : ""} assigned</p>
          </div>
          <Button
            onClick={() => setLocation("/chat")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            Team Chat
          </Button>
        </div>

        <NextBestActionCard />
        <AskInternOpsCard />
        <InternTaskOverview />

        {internAnalytics && (internAnalytics.progressByWeek?.length > 0 || internAnalytics.activityByWeek?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6" data-testid="intern-analytics">
            <PersonalProgressLineChart data={internAnalytics.progressByWeek || []} />
            <WeeklyHoursBarChart data={internAnalytics.activityByWeek || []} />
          </div>
        )}

        {projects.length > 1 && (
          <SearchFilterBar
            placeholder="Search projects..."
            searchValue={search}
            onSearchChange={setSearch}
            filterOptions={[
              { value: "active", label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
              { value: "planning", label: "Planning", color: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
              { value: "submitted", label: "Submitted", color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
              { value: "assigned", label: "Assigned", color: "bg-background text-white/60 border-white/[0.08]" },
            ]}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
            resultCount={filtered.length}
          />
        )}

        {filtered.length === 0 && (search || statusFilter) ? (
          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm p-12 text-center">
            <Search className="w-10 h-10 text-white/30 mx-auto mb-3" />
            <p className="text-white/50 mb-2">No matching projects</p>
            <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter(null); }}>Clear filters</Button>
          </div>
        ) : (
        <div className="space-y-3">
          {filtered.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className="w-full text-left bg-card border border-white/[0.08] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-white/20 transition-all duration-200"
              data-testid={`card-project-${project.id}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-3">
                  <h3 className="text-base font-semibold text-white truncate" data-testid={`text-project-title-${project.id}`}>
                    {project.title || project.idea || "Untitled Project"}
                  </h3>
                  {project.idea && project.title && (
                    <p className="text-sm text-white/50 mt-0.5 truncate">{project.idea}</p>
                  )}
                </div>
                <Badge className={`${STATUS_COLORS[project.status] || STATUS_COLORS.assigned} capitalize`} data-testid={`badge-status-${project.id}`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-xs text-white/50 mb-1">
                    <span>Completion</span>
                    <span>{Math.round(getCompletionRate(project))}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${getCompletionRate(project) >= 100 ? "bg-emerald-500/100" : getCompletionRate(project) > 0 ? "bg-blue-500/100" : "bg-white/15"}`}
                      style={{ width: `${Math.max(getCompletionRate(project), 2)}%` }}
                      data-testid={`progress-completion-${project.id}`}
                    />
                  </div>
                </div>
                <div className="text-xs text-white/40 flex items-center gap-1 whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  <span data-testid={`text-last-activity-${project.id}`}>{formatRelativeTime(getLastActivity(project))}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}

function ProjectWorkspace({ project, user, onBack }: { project: any; user: any; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"chat" | "plan">("plan");

  const { data: projectDetail, isLoading: loadingDetail } = useQuery<any>({
    queryKey: [`/api/projects/${project.id}`],
    staleTime: 10000,
  });

  const { data: weeklyLogs = [] } = useQuery<WeeklyLog[]>({
    queryKey: [`/api/weekly-logs/project/${project.id}`],
    staleTime: 10000,
  });

  const { data: logComments = [] } = useQuery<LogComment[]>({
    queryKey: [`/api/log-comments/project/${project.id}`],
    staleTime: 10000,
  });

  const versions: PlanVersion[] = projectDetail?.versions || [];
  const draftVersion = versions.find((v) => v.status === "draft");
  const approvedVersion = versions.find((v) => v.status === "approved");
  const submittedVersion = versions.find((v) => v.status === "submitted");
  const latestVersion = versions.sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const currentVersion = draftVersion || approvedVersion || submittedVersion || latestVersion;
  const planContent = currentVersion?.contentJson;

  const refreshProject = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: [`/api/weekly-logs/project/${project.id}`] });
  }, [queryClient, project.id]);

  const status = projectDetail?.status || project.status;
  const isExecution = status === "active";
  const hasPlan = !!planContent;

  return (
    <div className="h-screen flex flex-col bg-background" data-testid="project-workspace">
      <div className="border-b border-white/[0.08] bg-card px-4 py-3 flex items-center gap-4 shrink-0">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors" data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Projects</span>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white truncate" data-testid="text-project-title">
            {project.title || project.idea || "My Project"}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge className={`${STATUS_COLORS[status] || STATUS_COLORS.assigned} text-xs capitalize`}>
              {status}
            </Badge>
            {project.minimumTotalHours && (
              <span className="text-xs text-white/40 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Min {project.minimumTotalHours}h
              </span>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <div className="flex border-b border-white/[0.08] bg-card shrink-0">
          <button
            onClick={() => setMobileTab("plan")}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === "plan" ? "text-indigo-400 border-b-2 border-indigo-600" : "text-white/50 hover:text-white/80"
            }`}
          >
            <FileText className="w-4 h-4" />
            Plan
          </button>
          <button
            onClick={() => setMobileTab("chat")}
            className={`flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
              mobileTab === "chat" ? "text-indigo-400 border-b-2 border-indigo-600" : "text-white/50 hover:text-white/80"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            AI Chat
          </button>
        </div>
      )}

      <div className="flex-1 flex min-h-0">
        {(!isMobile || mobileTab === "chat") && (
          <div className={`${isMobile ? "w-full" : "w-[38%] lg:w-[35%]"} border-r border-white/[0.08] flex flex-col min-h-0`}>
            <UnifiedAIChat
              projectId={project.id}
              projectStatus={status}
              hasPlan={hasPlan}
              minimumHours={project.minimumTotalHours || 0}
              onRefresh={refreshProject}
            />
          </div>
        )}

        {(!isMobile || mobileTab === "plan") && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              {loadingDetail ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-white/40" /></div>
              ) : (
                <RightPanel
                  project={project}
                  projectDetail={projectDetail}
                  status={status}
                  planContent={planContent}
                  currentVersion={currentVersion}
                  versions={versions}
                  weeklyLogs={weeklyLogs}
                  logComments={logComments}
                  isExecution={isExecution}
                  hasPlan={hasPlan}
                  onRefresh={refreshProject}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RightPanel({ project, projectDetail, status, planContent, currentVersion, versions, weeklyLogs, logComments, isExecution, hasPlan, onRefresh }: {
  project: any; projectDetail: any; status: string; planContent: PlanContent | undefined;
  currentVersion: PlanVersion | undefined; versions: PlanVersion[];
  weeklyLogs: WeeklyLog[]; logComments: LogComment[];
  isExecution: boolean; hasPlan: boolean; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentVersion) throw new Error("No version to submit");
      const res = await apiRequest("POST", `/api/plan-versions/${currentVersion.id}/submit`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${project.id}`] });
      toast({ title: "Plan Submitted!", description: "Your plan has been submitted for review." });
      onRefresh();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (!hasPlan) {
    return (
      <div className="p-6 flex flex-col items-center justify-center h-full text-center" data-testid="no-plan-display">
        <div className="bg-gradient-to-br from-primary/10 to-violet-500/10 border border-white/[0.06] rounded-2xl p-8 max-w-md">
          <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Let's Plan Your Project</h2>
          <p className="text-sm text-white/60 mb-4">
            Use the AI assistant on the left to plan your project. Tell it how many weeks you'd like to spread the work over,
            how many hours per day you can commit, and it will help you create a detailed execution plan.
          </p>
          <div className="bg-card/80 rounded-xl p-4 text-left space-y-2">
            <p className="text-xs font-semibold text-white/70 uppercase tracking-wide mb-2">Try saying:</p>
            <p className="text-sm text-primary italic">"I want to work 4 hours a day, 5 days a week, for 6 weeks"</p>
            <p className="text-sm text-primary italic">"Generate a plan for my project"</p>
            <p className="text-sm text-primary italic">"How should I spread {project.minimumTotalHours || 100} hours over 8 weeks?"</p>
          </div>
          {project.minimumTotalHours && (
            <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-2">
              <p className="text-sm text-blue-400">
                Minimum required: <span className="font-bold">{project.minimumTotalHours} hours</span>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-card border border-white/[0.08] rounded-xl shadow-sm p-4" data-testid="plan-summary-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">Project Plan</h2>
            {currentVersion && (
              <Badge className={STATUS_COLORS[currentVersion.status] || STATUS_COLORS.assigned}>
                v{currentVersion.versionNumber}.0 {currentVersion.status}
              </Badge>
            )}
          </div>
          {currentVersion?.status === "draft" && (
            <Button size="sm" onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending} data-testid="button-submit-plan">
              {submitMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
              Submit for Review
            </Button>
          )}
        </div>

        {status === "submitted" && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-400" />
              <p className="text-sm text-blue-400 font-medium">Plan is under review by your manager</p>
            </div>
          </div>
        )}

        {planContent && (
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div className="bg-background rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Hours/Day</p>
              <p className="text-base font-bold text-white">{planContent.hoursPerDay}</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Days/Week</p>
              <p className="text-base font-bold text-white">{planContent.daysPerWeek}</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Weeks</p>
              <p className="text-base font-bold text-white">{planContent.numberOfWeeks}</p>
            </div>
            <div className="bg-background rounded-lg p-2.5 text-center">
              <p className="text-[10px] text-white/50 uppercase tracking-wide">Total Hours</p>
              <p className={`text-base font-bold ${planContent.totalPlannedHours >= (project.minimumTotalHours || 0) ? "text-emerald-400" : "text-red-400"}`}>
                {planContent.totalPlannedHours}h
              </p>
            </div>
          </div>
        )}

        {planContent && project.minimumTotalHours && (
          <div className="w-full bg-white/15 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${planContent.totalPlannedHours >= project.minimumTotalHours ? "bg-emerald-500/100" : "bg-amber-500/100"}`}
              style={{ width: `${Math.min((planContent.totalPlannedHours / project.minimumTotalHours) * 100, 100)}%` }}
              data-testid="progress-hours"
            />
          </div>
        )}
      </div>

      {project.githubRepoUrl && (
        <GitHubPanel
          projectId={project.id}
          githubRepoUrl={project.githubRepoUrl}
          onCommitSelect={(sha) => {
            // Allow intern to easily reference a commit
            const event = new CustomEvent("github-commit-selected", { detail: sha });
            window.dispatchEvent(event);
          }}
        />
      )}

      {planContent && !isExecution && (
        <PlanDisplay planContent={planContent} />
      )}

      {isExecution && planContent && (
        <ExecutionDisplay
          project={project}
          planContent={planContent}
          weeklyLogs={weeklyLogs}
          logComments={logComments}
        />
      )}

      {versions.length > 1 && (
        <div className="bg-card border border-white/[0.08] rounded-xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-white mb-2">Version History</h3>
          <div className="space-y-1.5">
            {versions.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-white/[0.06] text-sm" data-testid={`version-item-${v.id}`}>
                <span className="text-white/70 font-medium">v{v.versionNumber || 1}.0</span>
                <Badge className={STATUS_COLORS[v.status] || STATUS_COLORS.assigned}>{v.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlanDisplay({ planContent }: { planContent: PlanContent }) {
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));

  const toggleWeek = (weekNum: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(weekNum)) next.delete(weekNum);
      else next.add(weekNum);
      return next;
    });
  };

  return (
    <div className="space-y-2" data-testid="plan-display">
      {planContent.weeks.map((week) => (
        <div key={week.weekNumber} className={`bg-card border rounded-xl shadow-sm transition-all duration-200 ${
          expandedWeeks.has(week.weekNumber) ? "border-indigo-500/20 ring-1 ring-indigo-100" : "border-white/[0.08]"
        }`} data-testid={`week-card-${week.weekNumber}`}>
          <button
            onClick={() => toggleWeek(week.weekNumber)}
            className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.04] transition-colors rounded-xl"
            data-testid={`toggle-week-${week.weekNumber}`}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {expandedWeeks.has(week.weekNumber) ? <ChevronDown className="w-4 h-4 text-indigo-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />}
              <span className="text-sm font-semibold text-white">W{week.weekNumber}</span>
              <span className="text-sm text-white/60 truncate">{week.milestone}</span>
            </div>
            <span className="text-xs text-white/40 font-medium ml-2 shrink-0">{week.hours}h</span>
          </button>

          {expandedWeeks.has(week.weekNumber) && (
            <div className="px-4 pb-4 border-t border-white/[0.06]">
              <div className="pt-3 space-y-2 text-sm text-white/60">
                <p><span className="font-medium text-white/70">Milestone:</span> {week.milestone}</p>
                <div>
                  <span className="font-medium text-white/70">Deliverables:</span>
                  <ul className="list-disc ml-5 mt-1 space-y-0.5">
                    {(week.deliverables || []).map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                </div>
                <p><span className="font-medium text-white/70">Success Criteria:</span> {week.successCriteria}</p>
                <p><span className="font-medium text-white/70">Hours:</span> {week.hours}h</p>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ExecutionDisplay({ project, planContent, weeklyLogs, logComments }: {
  project: any; planContent: PlanContent; weeklyLogs: WeeklyLog[]; logComments: LogComment[];
}) {
  const [activeWeek, setActiveWeek] = useState(1);
  const daysPerWeek = planContent.daysPerWeek || 5;

  return (
    <div className="space-y-3" data-testid="execution-display">
      <div className="flex items-center gap-1 flex-wrap mb-2">
        {planContent.weeks.map((w) => (
          <button
            key={w.weekNumber}
            onClick={() => setActiveWeek(w.weekNumber)}
            className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
              activeWeek === w.weekNumber
                ? "bg-[#6D5EF5] text-white shadow-sm"
                : "bg-white/10 text-white/50 hover:bg-card/15"
            }`}
            title={`Week ${w.weekNumber}: ${w.milestone}`}
            data-testid={`nav-week-${w.weekNumber}`}
          >
            {w.weekNumber}
          </button>
        ))}
      </div>

      {planContent.weeks.map((week) => {
        if (week.weekNumber !== activeWeek) return null;
        const logsForWeek = weeklyLogs.filter((l) => l.weekNumber === week.weekNumber);
        const commentsForWeek = logComments.filter((c) =>
          logsForWeek.some((l) => l.id === c.logId)
        );
        return (
          <WeekExecutionCard
            key={week.weekNumber}
            week={week}
            logs={logsForWeek}
            comments={commentsForWeek}
            projectId={project.id}
            daysPerWeek={daysPerWeek}
          />
        );
      })}
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekExecutionCard({ week, logs, comments, projectId, daysPerWeek }: {
  week: WeekPlan; logs: WeeklyLog[]; comments: LogComment[];
  projectId: string; daysPerWeek: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set());
  const [logInputs, setLogInputs] = useState<Record<string, string>>({});
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const addLogMutation = useMutation({
    mutationFn: async ({ subtaskIndex, dayNumber, logText }: { subtaskIndex: number; dayNumber: number; logText: string }) => {
      const res = await apiRequest("POST", "/api/weekly-logs", {
        projectId,
        weekNumber: week.weekNumber,
        subtaskIndex,
        dayNumber,
        logText: logText.trim(),
      });
      return res.json();
    },
    onSuccess: (_, vars) => {
      const key = `${vars.dayNumber}-${vars.subtaskIndex}`;
      setLogInputs(prev => ({ ...prev, [key]: "" }));
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-logs/project/${projectId}`] });
      toast({ title: "Log Added" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const editLogMutation = useMutation({
    mutationFn: async ({ logId, text }: { logId: string; text: string }) => {
      const res = await apiRequest("PUT", `/api/weekly-logs/${logId}`, { logText: text.trim() });
      return res.json();
    },
    onSuccess: () => {
      setEditingLogId(null);
      setEditingText("");
      queryClient.invalidateQueries({ queryKey: [`/api/weekly-logs/project/${projectId}`] });
      toast({ title: "Log Updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const totalSubtasks = (week.deliverables || []).length;
  const subtasksWithLogs = new Set(logs.filter(l => l.subtaskIndex !== null).map(l => l.subtaskIndex));
  const completionPct = totalSubtasks > 0 ? Math.round((subtasksWithLogs.size / totalSubtasks) * 100) : 0;

  const toggleDay = (day: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
  };

  const toggleSubtask = (key: string) => {
    setExpandedSubtasks(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const renderLogEntry = (log: WeeklyLog) => {
    const logCmts = comments.filter(c => c.logId === log.id);
    const isEditing = editingLogId === log.id;
    return (
      <div key={log.id} className="bg-card rounded-lg px-3 py-2 border border-white/[0.06]" data-testid={`log-entry-${log.id}`}>
        {isEditing ? (
          <div className="space-y-2">
            <Textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="min-h-[40px] text-sm" data-testid={`input-edit-log-${log.id}`} />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => editLogMutation.mutate({ logId: log.id, text: editingText })} disabled={!editingText.trim()} data-testid={`button-save-edit-${log.id}`}>
                <Save className="w-3 h-3 mr-1" />Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditingLogId(null); setEditingText(""); }} data-testid={`button-cancel-edit-${log.id}`}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between">
              <p className="text-sm text-white/90 flex-1">{log.logText}</p>
              <button onClick={() => { setEditingLogId(log.id); setEditingText(log.logText); }} className="ml-2 text-white/30 hover:text-white/70 p-0.5">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />{formatDateTime(log.createdAt)}
            </p>
          </>
        )}
        {logCmts.length > 0 && logCmts.map((comment) => (
          <div key={comment.id} className="mt-1.5 bg-amber-500/10 border border-amber-500/15 rounded px-2 py-1.5 flex items-start gap-1.5" data-testid={`log-comment-${comment.id}`}>
            <MessageCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-amber-300">{comment.content}</p>
              <p className="text-[10px] text-amber-500 mt-0.5">{comment.managerName ? `${comment.managerName} · ` : ""}{formatRelativeTime(comment.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border border-indigo-500/20 rounded-xl shadow-sm ring-1 ring-indigo-100" data-testid={`execution-week-${week.weekNumber}`}>
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Week {week.weekNumber}</span>
            <span className="text-sm text-white/60">{week.milestone}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-1.5">
              <div className="w-16 bg-white/10 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full transition-all ${completionPct >= 100 ? "bg-emerald-500/100" : completionPct > 0 ? "bg-indigo-500/100" : "bg-white/15"}`} style={{ width: `${Math.max(completionPct, 3)}%` }} />
              </div>
              <span className="text-xs text-white/40">{completionPct}%</span>
            </div>
            <Badge className="bg-white/10 text-white/60 border-white/[0.08] text-xs">{logs.length} logs</Badge>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {week.hours}h planned</span>
          <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {week.successCriteria}</span>
        </div>
      </div>

      <div className="p-4 space-y-2">
        {Array.from({ length: daysPerWeek }, (_, i) => i + 1).map((dayNum) => {
          const dayLogs = logs.filter(l => l.dayNumber === dayNum);
          const isDayOpen = expandedDays.has(dayNum);
          const dayLabel = DAY_LABELS[(dayNum - 1) % 7] || `D${dayNum}`;

          return (
            <div key={dayNum} className={`border rounded-lg transition-all ${isDayOpen ? "border-indigo-500/20 bg-indigo-500/10" : "border-white/[0.06]"}`} data-testid={`day-${week.weekNumber}-${dayNum}`}>
              <button
                onClick={() => toggleDay(dayNum)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-white/[0.04] rounded-lg"
                data-testid={`toggle-day-${week.weekNumber}-${dayNum}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {isDayOpen ? <ChevronDown className="w-3.5 h-3.5 text-indigo-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-white/40 shrink-0" />}
                  <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  <span className="text-sm font-medium text-white/90">Day {dayNum}</span>
                  <span className="text-xs text-white/40">({dayLabel})</span>
                </div>
                <span className="text-xs text-white/40 ml-2 shrink-0">{dayLogs.length} log{dayLogs.length !== 1 ? "s" : ""}</span>
              </button>

              {isDayOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {(week.deliverables || []).map((deliverable, dIdx) => {
                    const subtaskKey = `${dayNum}-${dIdx}`;
                    const subtaskDayLogs = dayLogs.filter(l => l.subtaskIndex === dIdx);
                    const isSubtaskOpen = expandedSubtasks.has(subtaskKey);
                    const logVal = logInputs[subtaskKey] || "";

                    return (
                      <div key={dIdx} className={`border rounded-lg transition-all ${isSubtaskOpen ? "border-indigo-100 bg-card" : "border-white/[0.05] bg-background/50"}`} data-testid={`subtask-${week.weekNumber}-${dayNum}-${dIdx}`}>
                        <button
                          onClick={() => toggleSubtask(subtaskKey)}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/[0.04] rounded-lg"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {subtaskDayLogs.length > 0 ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-full border-2 border-white/[0.15] shrink-0" />
                            )}
                            <span className="text-xs text-white/70">{deliverable}</span>
                          </div>
                          <span className="text-[11px] text-white/40 ml-2 shrink-0">{subtaskDayLogs.length} log{subtaskDayLogs.length !== 1 ? "s" : ""}</span>
                        </button>

                        {isSubtaskOpen && (
                          <div className="px-3 pb-2.5 space-y-2">
                            {subtaskDayLogs.length > 0 && (
                              <div className="space-y-1.5">
                                {subtaskDayLogs.map(renderLogEntry)}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Input
                                value={logVal}
                                onChange={(e) => setLogInputs(prev => ({ ...prev, [subtaskKey]: e.target.value }))}
                                placeholder="What did you do for this task?"
                                className="text-sm h-8 bg-card"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.shiftKey && logVal.trim()) {
                                    addLogMutation.mutate({ subtaskIndex: dIdx, dayNumber: dayNum, logText: logVal });
                                  }
                                }}
                                data-testid={`input-log-${week.weekNumber}-${dayNum}-${dIdx}`}
                              />
                              <Button
                                size="sm"
                                className="h-8 text-xs shrink-0"
                                onClick={() => addLogMutation.mutate({ subtaskIndex: dIdx, dayNumber: dayNum, logText: logVal })}
                                disabled={!logVal.trim() || addLogMutation.isPending}
                                data-testid={`button-add-log-${week.weekNumber}-${dayNum}-${dIdx}`}
                              >
                                {addLogMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Plus className="w-3 h-3 mr-1" />Log</>}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function UnifiedAIChat({ projectId, projectStatus, hasPlan, minimumHours, onRefresh }: {
  projectId: string;
  projectStatus: string;
  hasPlan: boolean;
  minimumHours: number;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const getBrainstormWelcome = (): string => {
    return `Hey! I'm your creative brainstorming partner. Let's explore wild ideas for your project together!\n\nWe can:\n- Challenge assumptions and flip ideas upside down\n- Weigh pros and cons of different approaches\n- Break down complex problems with fun analogies\n- Explore technologies, architectures, and edge cases\n\nTry the quick starters below, hit the spark button for a random creative prompt, or just start typing!`;
  };

  const getPlanWelcomeMessage = (): string => {
    if (!hasPlan && (projectStatus === "assigned" || projectStatus === "planning")) {
      return `Hey! I'm your AI project mentor. I've guided many interns through projects like this, and I'm here to help you build a solid plan.\n\nLet's start with your schedule:\n- How many hours per day can you work?\n- How many days per week?\n- How many weeks do you want to spread this over?\n${minimumHours ? `\nYour manager requires at least ${minimumHours} hours total. I'll make sure we hit that target!\n` : ""}\nI'll help you build a realistic plan with proper milestones, buffer time, and dependency tracking. Let's do this!`;
    }
    if (hasPlan && projectStatus === "active") {
      return "Welcome back! Your plan is approved and you're in execution mode. I can help you track progress against your milestones, flag any pacing concerns, or suggest adjustments. How's it going?";
    }
    if (projectStatus === "revision_requested" || projectStatus === "planning") {
      return "I see your manager has sent some feedback on your plan. Let me help you understand what they're looking for and make the right changes. Use the quick actions below or tell me what you'd like to adjust!";
    }
    return "Hey! I'm your AI mentor. I can help you create, refine, or restructure your project plan. I'll flag risks, suggest best practices, and make sure your plan is rock solid. What do you need?";
  };

  const defaultMode = (!hasPlan && (projectStatus === "assigned" || projectStatus === "planning")) ? "brainstorm" : "plan";
  const [chatMode, setChatMode] = useState<"brainstorm" | "plan">(defaultMode as "brainstorm" | "plan");

  // Separate message stores for each mode — preserved across switches
  const [brainstormMessages, setBrainstormMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: getBrainstormWelcome() },
  ]);
  const [planMessages, setPlanMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: getPlanWelcomeMessage() },
  ]);

  const messages = chatMode === "brainstorm" ? brainstormMessages : planMessages;
  const setMessages = chatMode === "brainstorm" ? setBrainstormMessages : setPlanMessages;

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sparkLoading, setSparkLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState({ brainstorm: false, plan: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load chat history from server on mount
  useEffect(() => {
    const loadHistory = async (mode: "brainstorm" | "plan") => {
      try {
        const res = await apiRequest("GET", `/api/ai/chat-history/${projectId}/${mode}`);
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          const setter = mode === "brainstorm" ? setBrainstormMessages : setPlanMessages;
          const welcome = mode === "brainstorm" ? getBrainstormWelcome() : getPlanWelcomeMessage();
          setter([{ role: "assistant", content: welcome }, ...data.messages]);
        }
      } catch {
        // Silent fail — just use the welcome message
      } finally {
        setHistoryLoaded(prev => ({ ...prev, [mode]: true }));
      }
    };
    loadHistory("brainstorm");
    loadHistory("plan");
  }, [projectId]);

  // Mode switch preserves messages — just switches which array is displayed
  const switchMode = (newMode: "brainstorm" | "plan") => {
    if (newMode === chatMode) return;
    setChatMode(newMode);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const executeAction = async (action: string, instruction?: string, params?: any) => {
    try {
      const body: any = { projectId, action };
      if (instruction) body.instruction = instruction;
      if (action === "generate_plan") {
        body.hoursPerDay = params?.hoursPerDay || 4;
        body.daysPerWeek = params?.daysPerWeek || 5;
        body.numberOfWeeks = params?.numberOfWeeks || 8;
      }
      const res = await apiRequest("POST", "/api/ai/action", body);
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}`] });
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
        onRefresh();
        return true;
      }
      return false;
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
      return false;
    }
  };

  const sendMessage = async (overrideInput?: string) => {
    const userMsg = (overrideInput || input).trim();
    if (!userMsg || sending) return;
    if (!overrideInput) setInput("");
    const newMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/ai/chat", {
        projectId,
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        mode: chatMode,
      });
      const data = await res.json();
      let response = data.response;

      const modifyMatch = response.match(/\[ACTION:MODIFY_PLAN\]\s*([\s\S]*?)(?:\[|$)/);
      const generateMatch = response.match(/\[ACTION:GENERATE_PLAN(?::(\d+),(\d+),(\d+))?\]/);
      const deleteMatch = response.match(/\[ACTION:DELETE_PLAN\]/);

      if (modifyMatch) {
        const instruction = modifyMatch[1]?.trim() || userMsg;
        await executeAction("modify_plan", instruction);
        response = response.replace(/\[ACTION:MODIFY_PLAN\][\s\S]*?(?:\[|$)/, "").trim();
        if (!response) response = "Done! I've updated your plan. You can see the changes on the right.";
        toast({ title: "Plan Modified", description: "Your plan has been updated." });
      } else if (generateMatch) {
        const params = {
          hoursPerDay: generateMatch[1] ? parseInt(generateMatch[1]) : 4,
          daysPerWeek: generateMatch[2] ? parseInt(generateMatch[2]) : 5,
          numberOfWeeks: generateMatch[3] ? parseInt(generateMatch[3]) : 8,
        };
        await executeAction("generate_plan", undefined, params);
        response = response.replace(/\[ACTION:GENERATE_PLAN(?::\d+,\d+,\d+)?\]/g, "").trim();
        if (!response) response = "I've generated your plan! You can see it on the right side. Let me know if you'd like to adjust anything.";
        toast({ title: "Plan Generated", description: "Your plan is ready to review." });
      } else if (deleteMatch) {
        await executeAction("delete_plan");
        response = response.replace(/\[ACTION:DELETE_PLAN\]/g, "").trim();
        if (!response) response = "Plan deleted. Let's start fresh! Tell me your schedule preferences and I'll create a new plan.";
        toast({ title: "Plan Deleted", description: "You can now start fresh." });
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch (err: any) {
      toast({ title: "AI Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // Spark button — random creative prompt
  const handleSpark = async () => {
    if (sparkLoading || sending) return;
    setSparkLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai/spark", { projectId });
      const data = await res.json();
      if (data.spark) {
        await sendMessage(data.spark);
      }
    } catch (err: any) {
      toast({ title: "Spark failed", description: err.message, variant: "destructive" });
    } finally {
      setSparkLoading(false);
    }
  };

  // Brainstorm quick starters
  const brainstormStarters = [
    { label: "Challenge my idea", icon: ThumbsDown, prompt: "Play devil's advocate with my project idea. What are the weaknesses, risks, and things I haven't thought of?" },
    { label: "Flip it", icon: Shuffle, prompt: "What if we approached this project from the completely opposite direction? Explore reverse or contrarian approaches." },
    { label: "Surprise me", icon: Flame, prompt: "Give me a completely unexpected, creative suggestion for my project that I probably haven't considered." },
    { label: "Pros & Cons", icon: Scale, prompt: "Give me a structured pros and cons analysis of my current project approach." },
    { label: "Architect it", icon: Building2, prompt: "Help me think through the technical architecture for this project. What components, services, and data flows should I consider?" },
    { label: "Alternatives", icon: Layers, prompt: "What are some completely different technologies, frameworks, or approaches I could use for this project?" },
  ];

  // Plan mode quick actions — expanded with mentor actions
  const quickActions = [
    ...(!hasPlan ? [{ label: "Generate Plan", icon: Sparkles, action: async () => {
      setMessages(prev => [...prev,
        { role: "user" as const, content: "Generate a plan for my project" },
        { role: "assistant" as const, content: "Let me create a plan for your project..." }
      ]);
      const success = await executeAction("generate_plan");
      if (success) {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: "Your plan is ready! You can see it on the right side. Feel free to ask me to modify anything - change weeks, adjust hours, update deliverables, or restructure the plan." };
          return copy;
        });
      }
    }}] : []),
    ...(hasPlan ? [
      { label: "Review Plan", icon: Shield, action: async () => {
        await sendMessage("Review my plan critically — flag any risks, unrealistic time estimates, missing dependencies, or areas that need more thought.");
      }},
      { label: "Optimize Hours", icon: TrendingUp, action: async () => {
        await sendMessage("Analyze my hour allocations across all weeks. Am I spending too much or too little time on any particular week? Where should I add buffer time?");
      }},
      { label: "Best Practices", icon: BookOpen, action: async () => {
        await sendMessage("What industry best practices should I apply to my current plan? Are there patterns from real production teams I should follow?");
      }},
      { label: "Start Over", icon: RotateCcw, action: async () => {
        if (!confirm("Delete your current plan and start fresh?")) return;
        setMessages(prev => [...prev,
          { role: "user" as const, content: "Delete my plan and start over" },
          { role: "assistant" as const, content: "Deleting your plan..." }
        ]);
        const success = await executeAction("delete_plan");
        if (success) {
          setMessages(prev => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: "Plan deleted. Let's start fresh! Tell me your schedule preferences (hours/day, days/week, number of weeks) and I'll create a new plan." };
            return copy;
          });
        }
      }},
    ] : []),
  ];

  return (
    <div className="flex flex-col h-full bg-card" data-testid="ai-chat-panel">
      {/* Header — mode-aware gradient */}
      <div className={`px-4 py-3 border-b border-white/[0.08] flex items-center gap-2 shrink-0 transition-all duration-500 ${
        chatMode === "brainstorm"
          ? "bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-yellow-500/10"
          : "bg-gradient-to-r from-indigo-500/10 to-purple-500/10"
      }`}>
        {chatMode === "brainstorm"
          ? <Zap className="w-4 h-4 text-amber-500" />
          : <Sparkles className="w-4 h-4 text-indigo-500" />
        }
        <h3 className="text-sm font-semibold text-white">
          {chatMode === "brainstorm" ? "Creative Space" : "AI Mentor"}
        </h3>
        <div className="flex items-center gap-1 ml-auto bg-card rounded-lg p-0.5 border border-white/[0.08]">
          <button
            onClick={() => switchMode("brainstorm")}
            disabled={sending}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-300 ${
              chatMode === "brainstorm"
                ? "bg-amber-500/15 text-amber-400"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Zap className="w-3 h-3" />
            Brainstorm
          </button>
          <button
            onClick={() => switchMode("plan")}
            disabled={sending}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all duration-300 ${
              chatMode === "plan"
                ? "bg-indigo-500/15 text-indigo-400"
                : "text-white/50 hover:text-white/80"
            }`}
          >
            <Target className="w-3 h-3" />
            Plan
          </button>
        </div>
      </div>

      {/* Messages — mode-aware styling */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-3 min-h-0 transition-colors duration-500 ${
        chatMode === "brainstorm" ? "bg-gradient-to-b from-amber-500/[0.04] to-transparent" : "bg-card"
      }`}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`} data-testid={`chat-message-${i}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              msg.role === "user"
                ? chatMode === "brainstorm"
                  ? "bg-amber-500/100 text-white rounded-br-md"
                  : "bg-[#6D5EF5] text-white rounded-br-md"
                : chatMode === "brainstorm"
                  ? "bg-orange-500/10 text-white/90 rounded-bl-md border border-orange-500/20"
                  : "bg-white/10 text-white/90 rounded-bl-md"
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start" data-testid="chat-typing-indicator">
            <div className={`rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5 ${
              chatMode === "brainstorm"
                ? "bg-orange-500/10 border border-orange-500/20"
                : "bg-white/10"
            }`}>
              {chatMode === "brainstorm" ? (
                <>
                  <span className="w-2 h-2 bg-amber-400 rounded-full animate-spark" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-orange-400 rounded-full animate-spark" style={{ animationDelay: "200ms" }} />
                  <span className="w-2 h-2 bg-yellow-400 rounded-full animate-spark" style={{ animationDelay: "400ms" }} />
                  <span className="text-xs text-amber-400 ml-1 animate-pulse">sparking ideas...</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-white/30 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom bar — quick actions + input */}
      <div className="border-t border-white/[0.08] p-3 space-y-2 shrink-0">
        {/* Brainstorm quick starters — show when conversation is fresh */}
        {chatMode === "brainstorm" && messages.length <= 2 && (
          <div className="flex flex-wrap gap-1.5">
            {brainstormStarters.map((starter, i) => (
              <button
                key={i}
                onClick={() => sendMessage(starter.prompt)}
                disabled={sending}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-all disabled:opacity-50"
                data-testid={`brainstorm-starter-${i}`}
              >
                <starter.icon className="w-3 h-3" />
                {starter.label}
              </button>
            ))}
          </div>
        )}

        {/* Plan quick actions */}
        {chatMode === "plan" && quickActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map((qa, i) => (
              <button
                key={i}
                onClick={qa.action}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors disabled:opacity-50"
                data-testid={`quick-action-${i}`}
              >
                <qa.icon className="w-3.5 h-3.5" />
                {qa.label}
              </button>
            ))}
          </div>
        )}

        {/* Input row with spark button */}
        <div className="flex gap-2">
          {chatMode === "brainstorm" && (
            <Button
              onClick={handleSpark}
              disabled={sparkLoading || sending}
              size="icon"
              variant="outline"
              className="shrink-0 border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-400"
              title="Random creative prompt"
              data-testid="button-spark"
            >
              {sparkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            </Button>
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={chatMode === "brainstorm"
              ? "Share your ideas, explore wild approaches..."
              : "Ask your mentor anything about planning..."}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            className={`text-sm ${chatMode === "brainstorm" ? "border-amber-500/20 focus-visible:ring-amber-300" : ""}`}
            data-testid="input-chat-message"
          />
          <Button
            onClick={() => sendMessage()}
            disabled={!input.trim() || sending}
            size="icon"
            className={`shrink-0 ${chatMode === "brainstorm" ? "bg-amber-500/100 hover:bg-amber-600" : ""}`}
            data-testid="button-send-chat"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
