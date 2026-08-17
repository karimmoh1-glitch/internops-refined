import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { parseErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TagInput } from "@/components/tag-input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, Clock, AlertTriangle, CheckCircle2, Circle, PlayCircle,
  Eye, Ban, Pencil, Trash2, ListTodo, Calendar, User, X, UserCog, Flag, Filter,
} from "lucide-react";
import { SimplePageSkeleton } from "@/components/dashboard-skeleton";

interface TaskUser {
  id: string;
  name: string;
  role: string;
  deactivatedAt?: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  createdByUserId: string;
  projectId: string | null;
  priority: "low" | "medium" | "high";
  status: "todo" | "in_progress" | "in_review" | "completed" | "blocked";
  dueDate: string | null;
  submission: string | null;
  submittedAt: string | null;
  feedback: string | null;
  blockedReason: string | null;
  completedAt: string | null;
  skillTags: string[];
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  title: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  todo: { label: "To Do", cls: "bg-white/10 text-white/70 border-white/[0.08]", icon: Circle },
  in_progress: { label: "In Progress", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: PlayCircle },
  in_review: { label: "In Review", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Eye },
  completed: { label: "Completed", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  blocked: { label: "Blocked", cls: "bg-red-500/10 text-red-400 border-red-500/20", icon: Ban },
};

const PRIORITY_META: Record<string, string> = {
  low: "bg-white/10 text-white/60 border-white/[0.08]",
  medium: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  high: "bg-red-500/10 text-red-400 border-red-500/20",
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] || STATUS_META.todo;
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={`${meta.cls} text-xs font-medium gap-1`} data-testid={`badge-status-${status}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </Badge>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge variant="outline" className={`${PRIORITY_META[priority] || PRIORITY_META.medium} text-xs font-medium capitalize`} data-testid={`badge-priority-${priority}`}>
      {priority}
    </Badge>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function isOverdue(task: Task): boolean {
  if (!task.dueDate) return false;
  if (task.status === "completed") return false;
  return new Date(task.dueDate).getTime() < Date.now();
}

interface TasksPageProps {
  user: { id: string; name: string; role: string; companyId: string | null };
}

export default function TasksPage({ user }: TasksPageProps) {
  if (user.role === "admin") return <ManagerTasksView user={user} />;
  return <InternTasksView user={user} />;
}

// ---------------------------------------------------------------------------
// Manager view
// ---------------------------------------------------------------------------

function ManagerTasksView({ user }: TasksPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const search = useSearch();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const params = new URLSearchParams(search);
    const assigneeId = params.get("assigneeId");
    if (assigneeId) setAssigneeFilter(assigneeId);
    const status = params.get("status");
    if (status) setStatusFilter(status);
  }, [search]);

  // Switching filters can hide selected rows, which would let a bulk action
  // silently apply to tasks the admin can no longer see — clear the
  // selection instead so "N selected" always matches what's on screen.
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, assigneeFilter]);

  const { data: taskList = [], isLoading: tasksLoading, isError: tasksError } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    refetchInterval: 15000,
  });
  const { data: interns = [] } = useQuery<TaskUser[]>({ queryKey: ["/api/interns"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const internNameById = useMemo(() => {
    const m = new Map<string, string>();
    interns.forEach((i) => m.set(i.id, i.name));
    return m;
  }, [interns]);

  const projectTitleById = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p.id, p.title));
    return m;
  }, [projects]);

  const filteredTasks = useMemo(() => {
    return taskList.filter((t) => {
      if (statusFilter === "overdue") {
        if (!isOverdue(t)) return false;
      } else if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }
      if (assigneeFilter !== "all" && t.assigneeId !== assigneeFilter) return false;
      return true;
    });
  }, [taskList, statusFilter, assigneeFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: taskList.length, overdue: 0 };
    for (const s of Object.keys(STATUS_META)) c[s] = 0;
    taskList.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1;
      if (isOverdue(t)) c.overdue += 1;
    });
    return c;
  }, [taskList]);

  const invalidateTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      invalidateTasks();
      setCreateOpen(false);
      toast({ title: "Task created" });
    },
    onError: (err: any) => toast({ title: "Failed to create task", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/tasks/${id}`),
    onSuccess: () => {
      invalidateTasks();
      setSelectedTask(null);
      toast({ title: "Task deleted" });
    },
    onError: (err: any) => toast({ title: "Failed to delete task", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback?: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/approve`, { feedback });
      return res.json();
    },
    onSuccess: (updated: Task) => {
      invalidateTasks();
      setSelectedTask(updated);
      toast({ title: "Task approved" });
    },
    onError: (err: any) => toast({ title: "Failed to approve task", description: err.message, variant: "destructive" }),
  });

  const requestChangesMutation = useMutation({
    mutationFn: async ({ id, feedback }: { id: string; feedback: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/request-changes`, { feedback });
      return res.json();
    },
    onSuccess: (updated: Task) => {
      invalidateTasks();
      setSelectedTask(updated);
      toast({ title: "Changes requested" });
    },
    onError: (err: any) => toast({ title: "Failed to request changes", description: err.message, variant: "destructive" }),
  });

  const updateTagsMutation = useMutation({
    mutationFn: async ({ id, skillTags }: { id: string; skillTags: string[] }) => {
      const res = await apiRequest("PUT", `/api/tasks/${id}`, { skillTags });
      return res.json();
    },
    onSuccess: () => invalidateTasks(),
    onError: (err: any) => toast({ title: "Failed to update skills", description: err.message, variant: "destructive" }),
  });

  // Bulk actions reuse the existing single-task PUT/DELETE endpoints — fired
  // in parallel rather than adding new bulk-specific server routes. Each
  // call is tracked individually so a partial failure (e.g. one task was
  // deleted by someone else mid-selection) still reports an accurate count
  // instead of an all-or-nothing error.
  const runBulk = async (ids: string[], op: (id: string) => Promise<Response>) => {
    const results = await Promise.allSettled(ids.map(op));
    const failed = results.filter((r) => r.status === "rejected").length;
    return { succeeded: ids.length - failed, failed };
  };

  const bulkReassignMutation = useMutation({
    mutationFn: async ({ ids, assigneeId }: { ids: string[]; assigneeId: string }) =>
      runBulk(ids, (id) => apiRequest("PUT", `/api/tasks/${id}`, { assigneeId })),
    onSuccess: ({ succeeded, failed }, { assigneeId }) => {
      invalidateTasks();
      setSelectedIds(new Set());
      const name = internNameById.get(assigneeId) || "the new assignee";
      toast({
        title: failed === 0 ? "Tasks reassigned" : "Some tasks couldn't be reassigned",
        description: failed === 0
          ? `${succeeded} task${succeeded === 1 ? "" : "s"} reassigned to ${name}.`
          : `${succeeded} reassigned, ${failed} failed.`,
        variant: failed === 0 ? undefined : "destructive",
      });
    },
    onError: (err: any) => toast({ title: "Bulk reassign failed", description: err.message, variant: "destructive" }),
  });

  const bulkPriorityMutation = useMutation({
    mutationFn: async ({ ids, priority }: { ids: string[]; priority: string }) =>
      runBulk(ids, (id) => apiRequest("PUT", `/api/tasks/${id}`, { priority })),
    onSuccess: ({ succeeded, failed }, { priority }) => {
      invalidateTasks();
      setSelectedIds(new Set());
      toast({
        title: failed === 0 ? "Priority updated" : "Some tasks couldn't be updated",
        description: failed === 0
          ? `${succeeded} task${succeeded === 1 ? "" : "s"} set to ${priority} priority.`
          : `${succeeded} updated, ${failed} failed.`,
        variant: failed === 0 ? undefined : "destructive",
      });
    },
    onError: (err: any) => toast({ title: "Bulk priority update failed", description: err.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => runBulk(ids, (id) => apiRequest("DELETE", `/api/tasks/${id}`)),
    onSuccess: ({ succeeded, failed }) => {
      invalidateTasks();
      setSelectedIds(new Set());
      toast({
        title: failed === 0 ? "Tasks deleted" : "Some tasks couldn't be deleted",
        description: failed === 0
          ? `${succeeded} task${succeeded === 1 ? "" : "s"} deleted.`
          : `${succeeded} deleted, ${failed} failed.`,
        variant: failed === 0 ? undefined : "destructive",
      });
    },
    onError: (err: any) => toast({ title: "Bulk delete failed", description: err.message, variant: "destructive" }),
  });

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (tasksLoading) {
    return <SimplePageSkeleton rows={5} />;
  }

  if (tasksError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-center">
        <p className="text-red-400 font-medium">Couldn't load tasks. Try refreshing the page.</p>
      </div>
    );
  }

  const filterTabs = [
    { key: "all", label: "All" },
    { key: "todo", label: "To Do" },
    { key: "in_progress", label: "In Progress" },
    { key: "in_review", label: "In Review" },
    { key: "blocked", label: "Blocked" },
    { key: "completed", label: "Completed" },
    { key: "overdue", label: "Overdue" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white" data-testid="text-tasks-title">Tasks</h1>
          <p className="text-sm text-white/50 mt-0.5">Assign, track, and review work across the team</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-task">
          <Plus className="w-4 h-4 mr-1.5" />
          New Task
        </Button>
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === tab.key ? "bg-white/10 text-white" : "text-white/60 hover:bg-card/10"
              }`}
              data-testid={`filter-status-${tab.key}`}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">{counts[tab.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="w-44" data-testid="select-filter-assignee">
              <SelectValue placeholder="All interns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All interns</SelectItem>
              {interns.map((i) => (
                <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl">
          <ListTodo className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-white/50 font-medium">
            {taskList.length === 0 ? "No tasks yet" : "No tasks match this filter"}
          </p>
          <p className="text-sm text-white/40 mt-1">
            {taskList.length === 0 ? "Create the first task to get started." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="border border-white/[0.08] rounded-xl overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-white/[0.03] border-b border-white/[0.06]">
            <Checkbox
              checked={selectedIds.size > 0 && selectedIds.size === filteredTasks.length}
              onCheckedChange={(checked) => {
                setSelectedIds(checked ? new Set(filteredTasks.map((t) => t.id)) : new Set());
              }}
              data-testid="checkbox-select-all-tasks"
              aria-label="Select all tasks"
            />
            <span className="text-xs text-white/40">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {filteredTasks.map((task) => {
              const overdue = isOverdue(task);
              const checked = selectedIds.has(task.id);
              return (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${checked ? "bg-[#6D5EF5]/[0.06]" : "hover:bg-white/[0.03]"}`}
                  data-testid={`row-task-${task.id}`}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSelected(task.id)}
                    data-testid={`checkbox-task-${task.id}`}
                    aria-label={`Select ${task.title}`}
                  />
                  <button
                    onClick={() => setSelectedTask(task)}
                    className="flex-1 min-w-0 text-left flex items-center gap-3"
                    data-testid={`button-open-task-${task.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-white truncate">{task.title}</span>
                        {task.projectId && projectTitleById.get(task.projectId) && (
                          <span className="text-xs text-white/40 truncate">in {projectTitleById.get(task.projectId)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                        <User className="w-3 h-3" />
                        {internNameById.get(task.assigneeId) || "Unknown"}
                        {task.dueDate && (
                          <span className={`flex items-center gap-1 ${overdue ? "text-red-400 font-medium" : ""}`}>
                            <Calendar className="w-3 h-3" />
                            {formatDate(task.dueDate)}
                            {overdue && " (overdue)"}
                          </span>
                        )}
                      </div>
                    </div>
                    <PriorityBadge priority={task.priority} />
                    <StatusBadge status={task.status} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          interns={interns}
          onReassign={(assigneeId) => bulkReassignMutation.mutate({ ids: Array.from(selectedIds), assigneeId })}
          onSetPriority={(priority) => bulkPriorityMutation.mutate({ ids: Array.from(selectedIds), priority })}
          onDelete={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}
          onClear={() => setSelectedIds(new Set())}
          isReassigning={bulkReassignMutation.isPending}
          isSettingPriority={bulkPriorityMutation.isPending}
          isDeleting={bulkDeleteMutation.isPending}
        />
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        interns={interns}
        projects={projects}
        existingTasks={taskList}
        onCreate={(data) => createMutation.mutate(data)}
        isPending={createMutation.isPending}
      />

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          assigneeName={internNameById.get(selectedTask.assigneeId) || "Unknown"}
          projectTitle={selectedTask.projectId ? projectTitleById.get(selectedTask.projectId) : undefined}
          onClose={() => setSelectedTask(null)}
          onApprove={(feedback) => approveMutation.mutate({ id: selectedTask.id, feedback })}
          onRequestChanges={(feedback) => requestChangesMutation.mutate({ id: selectedTask.id, feedback })}
          onDelete={() => deleteMutation.mutate(selectedTask.id)}
          onUpdateTags={(skillTags) => updateTagsMutation.mutate({ id: selectedTask.id, skillTags })}
          isApproving={approveMutation.isPending}
          isRequestingChanges={requestChangesMutation.isPending}
          isDeleting={deleteMutation.isPending}
          isUpdatingTags={updateTagsMutation.isPending}
        />
      )}
    </div>
  );
}

function BulkActionBar({
  count, interns, onReassign, onSetPriority, onDelete, onClear,
  isReassigning, isSettingPriority, isDeleting,
}: {
  count: number;
  interns: TaskUser[];
  onReassign: (assigneeId: string) => void;
  onSetPriority: (priority: string) => void;
  onDelete: () => void;
  onClear: () => void;
  isReassigning: boolean;
  isSettingPriority: boolean;
  isDeleting: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isBusy = isReassigning || isSettingPriority || isDeleting;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl" data-testid="bar-bulk-actions">
      <div className="bg-[#171412] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 pr-3 border-r border-white/[0.08]">
          <span className="text-sm font-semibold text-white tabular-nums" data-testid="text-bulk-selected-count">{count} selected</span>
          <button
            onClick={onClear}
            className="p-1 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            data-testid="button-clear-selection"
            title="Clear selection"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {!confirmDelete ? (
          <>
            <Select onValueChange={onReassign} disabled={isBusy}>
              <SelectTrigger className="w-40 h-8 text-xs" data-testid="select-bulk-reassign">
                <UserCog className="w-3.5 h-3.5 mr-1.5 text-white/40" />
                <SelectValue placeholder="Reassign to..." />
              </SelectTrigger>
              <SelectContent>
                {interns.filter((i) => !i.deactivatedAt).map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select onValueChange={onSetPriority} disabled={isBusy}>
              <SelectTrigger className="w-36 h-8 text-xs" data-testid="select-bulk-priority">
                <Flag className="w-3.5 h-3.5 mr-1.5 text-white/40" />
                <SelectValue placeholder="Set priority..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-red-400 hover:text-red-400 hover:bg-red-500/10 ml-auto"
              onClick={() => setConfirmDelete(true)}
              disabled={isBusy}
              data-testid="button-bulk-delete"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
              Delete
            </Button>

            {isBusy && <Loader2 className="w-4 h-4 animate-spin text-white/40" />}
          </>
        ) : (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-white/60">Delete {count} task{count === 1 ? "" : "s"}? This can't be undone.</span>
            <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={onDelete} disabled={isDeleting} data-testid="button-confirm-bulk-delete">
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirm"}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setConfirmDelete(false)} disabled={isDeleting}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateTaskDialog({
  open, onOpenChange, interns, projects, existingTasks, onCreate, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interns: TaskUser[];
  projects: Project[];
  existingTasks: Task[];
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [skillTags, setSkillTags] = useState<string[]>([]);
  const [dependsOnTaskId, setDependsOnTaskId] = useState("");

  const reset = () => {
    setTitle(""); setDescription(""); setAssigneeId(""); setProjectId(""); setPriority("medium"); setDueDate(""); setSkillTags([]); setDependsOnTaskId("");
  };

  const handleSubmit = () => {
    if (!title.trim() || !assigneeId) return;
    onCreate({
      title: title.trim(),
      description: description.trim() || undefined,
      assigneeId,
      projectId: projectId || undefined,
      priority,
      dueDate: dueDate || undefined,
      skillTags,
      dependsOnTaskId: dependsOnTaskId || undefined,
    });
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-create-task">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
          <DialogDescription>Assign a piece of work to an intern.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Write onboarding doc" data-testid="input-task-title" />
          </div>
          <div>
            <Label className="mb-1.5 block">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done?" rows={3} data-testid="input-task-description" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger data-testid="select-task-assignee"><SelectValue placeholder="Choose intern" /></SelectTrigger>
                <SelectContent>
                  {interns.filter((i) => !i.deactivatedAt).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block">Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger data-testid="select-task-project"><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block">Due date (optional)</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} data-testid="input-task-due-date" />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Skills (optional)</Label>
            <TagInput value={skillTags} onChange={setSkillTags} />
          </div>
          <div>
            <Label className="mb-1.5 block">Depends on (optional)</Label>
            <Select value={dependsOnTaskId || "none"} onValueChange={(v) => setDependsOnTaskId(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="select-task-depends-on"><SelectValue placeholder="No dependency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No dependency</SelectItem>
                {existingTasks.filter((t) => t.status !== "completed").map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-xs text-white/40 mt-1">This task will be flagged as blocked if the dependency isn't finished when it's due.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!title.trim() || !assigneeId || isPending} data-testid="button-submit-create-task">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Create Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDetailDialog({
  task, assigneeName, projectTitle, onClose, onApprove, onRequestChanges, onDelete, onUpdateTags,
  isApproving, isRequestingChanges, isDeleting, isUpdatingTags,
}: {
  task: Task;
  assigneeName: string;
  projectTitle?: string;
  onClose: () => void;
  onApprove: (feedback?: string) => void;
  onRequestChanges: (feedback: string) => void;
  onDelete: () => void;
  onUpdateTags: (skillTags: string[]) => void;
  isApproving: boolean;
  isRequestingChanges: boolean;
  isDeleting: boolean;
  isUpdatingTags: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [skillTags, setSkillTags] = useState<string[]>(task.skillTags || []);

  const commitTags = (tags: string[]) => {
    setSkillTags(tags);
    onUpdateTags(tags);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg" data-testid="dialog-task-detail">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle>{task.title}</DialogTitle>
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
          </div>
          <DialogDescription>
            Assigned to {assigneeName}{projectTitle ? ` · ${projectTitle}` : ""}{task.dueDate ? ` · Due ${formatDate(task.dueDate)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {task.description && (
            <p className="text-sm text-white/70 whitespace-pre-wrap">{task.description}</p>
          )}

          <div>
            <Label className="mb-1.5 block text-xs text-white/50">Skills</Label>
            <TagInput value={skillTags} onChange={commitTags} disabled={isUpdatingTags} placeholder="Add a skill..." />
          </div>

          {task.status === "blocked" && task.blockedReason && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-400">Blocked</p>
                <p className="text-sm text-red-400 mt-0.5">{task.blockedReason}</p>
              </div>
            </div>
          )}

          {task.submission && (
            <div className="bg-background border border-white/[0.08] rounded-lg p-3">
              <p className="text-xs font-semibold text-white/50 mb-1">
                Submission {task.submittedAt ? `· ${formatDate(task.submittedAt)}` : ""}
              </p>
              <p className="text-sm text-white/90 whitespace-pre-wrap">{task.submission}</p>
            </div>
          )}

          {task.feedback && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-400 mb-1">Feedback</p>
              <p className="text-sm text-blue-200 whitespace-pre-wrap">{task.feedback}</p>
            </div>
          )}

          {task.status === "in_review" && (
            <div>
              <Label className="mb-1.5 block text-sm">Feedback (optional for approve, required to request changes)</Label>
              <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Leave feedback for the intern..." data-testid="input-task-feedback" />
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            {!confirmDelete ? (
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={() => setConfirmDelete(true)} data-testid="button-delete-task">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/50">Delete this task?</span>
                <Button variant="destructive" size="sm" onClick={onDelete} disabled={isDeleting} data-testid="button-confirm-delete-task">
                  {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            )}
          </div>
          {task.status === "in_review" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => onRequestChanges(feedback)}
                disabled={!feedback.trim() || isRequestingChanges}
                data-testid="button-request-changes"
              >
                {isRequestingChanges ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Request Changes
              </Button>
              <Button onClick={() => onApprove(feedback || undefined)} disabled={isApproving} data-testid="button-approve-task">
                {isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Approve
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Intern view
// ---------------------------------------------------------------------------

const INTERN_GROUPS = [
  { key: "todo", label: "To Do" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "in_review", label: "In Review" },
  { key: "completed", label: "Completed" },
];

function InternTasksView({ user }: TasksPageProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [submitTask, setSubmitTask] = useState<Task | null>(null);
  const [blockTask, setBlockTask] = useState<Task | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<Task | null>(null);

  const statusFilter = new URLSearchParams(search).get("status");

  const { data: allTasks = [], isLoading, isError } = useQuery<Task[]>({
    queryKey: ["/api/tasks/mine"],
    refetchInterval: 15000,
  });
  const taskList = statusFilter
    ? allTasks.filter((t) => (statusFilter === "overdue" ? isOverdue(t) : t.status === statusFilter))
    : allTasks;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/tasks/mine"] });

  const startMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/tasks/${id}/start`),
    onSuccess: () => { invalidate(); toast({ title: "Task started" }); },
    onError: (err: any) => toast({ title: "Couldn't start task", description: err.message, variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async ({ id, submission }: { id: string; submission: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/submit`, { submission });
      return res.json();
    },
    onSuccess: () => { invalidate(); setSubmitTask(null); toast({ title: "Task submitted for review" }); },
    onError: (err: any) => toast({ title: "Couldn't submit task", description: err.message, variant: "destructive" }),
  });

  const blockMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/tasks/${id}/block`, { reason });
      return res.json();
    },
    onSuccess: () => { invalidate(); setBlockTask(null); toast({ title: "Task marked blocked" }); },
    onError: (err: any) => toast({ title: "Couldn't mark task blocked", description: err.message, variant: "destructive" }),
  });

  const unblockMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/tasks/${id}/unblock`),
    onSuccess: () => { invalidate(); toast({ title: "Task unblocked" }); },
    onError: (err: any) => toast({ title: "Couldn't unblock task", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <SimplePageSkeleton rows={5} />;
  }

  if (isError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-center">
        <p className="text-red-400 font-medium">Couldn't load your tasks. Try refreshing the page.</p>
      </div>
    );
  }

  const grouped: Record<string, Task[]> = {};
  INTERN_GROUPS.forEach((g) => { grouped[g.key] = []; });
  taskList.forEach((t) => { if (grouped[t.status]) grouped[t.status].push(t); });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white" data-testid="text-tasks-title">My Tasks</h1>
        <p className="text-sm text-white/50 mt-0.5">Everything assigned to you, grouped by status</p>
      </div>

      {statusFilter && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 px-3 py-1 text-sm flex items-center gap-1.5" data-testid="badge-active-filter">
            <Filter className="w-3 h-3" />
            Filtering: {statusFilter === "in_review" ? "In Review" : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          </Badge>
          <button onClick={() => setLocation("/tasks")} className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 transition-colors" data-testid="button-clear-filter">
            <X className="w-3 h-3" /> Clear filter
          </button>
        </div>
      )}

      {taskList.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl">
          <ListTodo className="w-8 h-8 text-white/30 mx-auto mb-2" />
          <p className="text-white/50 font-medium">{statusFilter ? "No tasks match this filter" : "No tasks assigned yet"}</p>
          <p className="text-sm text-white/40 mt-1">{statusFilter ? "Nice — nothing here right now." : "Your manager hasn't assigned you anything yet."}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {INTERN_GROUPS.map((group) => {
            const items = grouped[group.key];
            if (items.length === 0) return null;
            return (
              <div key={group.key}>
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={group.key} />
                  <span className="text-xs text-white/40">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((task) => {
                    const overdue = isOverdue(task);
                    return (
                      <div key={task.id} className="border border-white/[0.08] rounded-xl p-4" data-testid={`card-task-${task.id}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{task.title}</span>
                              <PriorityBadge priority={task.priority} />
                            </div>
                            {task.description && (
                              <p className="text-sm text-white/60 mt-1">{task.description}</p>
                            )}
                            {task.dueDate && (
                              <p className={`text-xs mt-1.5 flex items-center gap-1 ${overdue ? "text-red-400 font-medium" : "text-white/40"}`}>
                                <Clock className="w-3 h-3" />
                                Due {formatDate(task.dueDate)}{overdue ? " (overdue)" : ""}
                              </p>
                            )}
                            {task.status === "blocked" && task.blockedReason && (
                              <div className="mt-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 text-sm text-red-400">
                                {task.blockedReason}
                              </div>
                            )}
                            {task.feedback && (task.status === "in_progress" || task.status === "completed") && (
                              <button
                                onClick={() => setFeedbackTask(task)}
                                className="mt-2 text-xs text-blue-400 hover:underline"
                                data-testid={`button-view-feedback-${task.id}`}
                              >
                                View manager feedback
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {task.status === "todo" && (
                              <>
                                <Button size="sm" onClick={() => startMutation.mutate(task.id)} disabled={startMutation.isPending} data-testid={`button-start-${task.id}`}>
                                  Start
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setBlockTask(task)} disabled={startMutation.isPending} data-testid={`button-block-${task.id}`}>
                                  Block
                                </Button>
                              </>
                            )}
                            {task.status === "in_progress" && (
                              <>
                                <Button size="sm" onClick={() => setSubmitTask(task)} data-testid={`button-submit-${task.id}`}>
                                  Submit
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setBlockTask(task)} data-testid={`button-block-${task.id}`}>
                                  Block
                                </Button>
                              </>
                            )}
                            {task.status === "blocked" && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => unblockMutation.mutate(task.id)} disabled={unblockMutation.isPending} data-testid={`button-unblock-${task.id}`}>
                                  Unblock
                                </Button>
                                <Button size="sm" onClick={() => setSubmitTask(task)} data-testid={`button-submit-${task.id}`}>
                                  Submit anyway
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {submitTask && (
        <SubmitDialog
          task={submitTask}
          onClose={() => setSubmitTask(null)}
          onSubmit={(submission) => submitMutation.mutate({ id: submitTask.id, submission })}
          isPending={submitMutation.isPending}
        />
      )}

      {blockTask && (
        <BlockDialog
          task={blockTask}
          onClose={() => setBlockTask(null)}
          onBlock={(reason) => blockMutation.mutate({ id: blockTask.id, reason })}
          isPending={blockMutation.isPending}
        />
      )}

      {feedbackTask && (
        <Dialog open onOpenChange={(v) => !v && setFeedbackTask(null)}>
          <DialogContent data-testid="dialog-view-feedback">
            <DialogHeader>
              <DialogTitle>Feedback on "{feedbackTask.title}"</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-white/70 whitespace-pre-wrap">{feedbackTask.feedback}</p>
            <DialogFooter>
              <Button onClick={() => setFeedbackTask(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function SubmitDialog({ task, onClose, onSubmit, isPending }: { task: Task; onClose: () => void; onSubmit: (submission: string) => void; isPending: boolean }) {
  const [submission, setSubmission] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="dialog-submit-task">
        <DialogHeader>
          <DialogTitle>Submit "{task.title}"</DialogTitle>
          <DialogDescription>Describe what you did — this goes to your manager for review.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={submission}
          onChange={(e) => setSubmission(e.target.value)}
          rows={5}
          placeholder="What did you do for this task?"
          autoFocus
          data-testid="input-task-submission"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSubmit(submission)} disabled={!submission.trim() || isPending} data-testid="button-confirm-submit-task">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Submit for Review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({ task, onClose, onBlock, isPending }: { task: Task; onClose: () => void; onBlock: (reason: string) => void; isPending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent data-testid="dialog-block-task">
        <DialogHeader>
          <DialogTitle>Mark "{task.title}" as blocked</DialogTitle>
          <DialogDescription>Let your manager know what's stopping you — this shows up on their dashboard.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Waiting on API credentials from IT"
          autoFocus
          data-testid="input-block-reason"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" onClick={() => onBlock(reason)} disabled={!reason.trim() || isPending} data-testid="button-confirm-block-task">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
            Mark Blocked
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
