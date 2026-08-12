import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { parseErrorMessage } from "@/lib/api-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, Clock, AlertTriangle, CheckCircle2, Circle, PlayCircle,
  Eye, Ban, Pencil, Trash2, ListTodo, Calendar, User,
} from "lucide-react";

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
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  title: string;
}

const STATUS_META: Record<string, { label: string; cls: string; icon: any }> = {
  todo: { label: "To Do", cls: "bg-gray-100 text-gray-700 border-gray-200", icon: Circle },
  in_progress: { label: "In Progress", cls: "bg-blue-50 text-blue-700 border-blue-200", icon: PlayCircle },
  in_review: { label: "In Review", cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Eye },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  blocked: { label: "Blocked", cls: "bg-red-50 text-red-700 border-red-200", icon: Ban },
};

const PRIORITY_META: Record<string, string> = {
  low: "bg-gray-100 text-gray-600 border-gray-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-red-50 text-red-700 border-red-200",
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

  useEffect(() => {
    const params = new URLSearchParams(search);
    const assigneeId = params.get("assigneeId");
    if (assigneeId) setAssigneeFilter(assigneeId);
  }, [search]);

  const { data: taskList = [], isLoading: tasksLoading, isError: tasksError } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
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

  if (tasksLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (tasksError) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10 text-center">
        <p className="text-red-600 font-medium">Couldn't load tasks. Try refreshing the page.</p>
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
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-tasks-title">Tasks</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign, track, and review work across the team</p>
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
                statusFilter === tab.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
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
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <ListTodo className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">
            {taskList.length === 0 ? "No tasks yet" : "No tasks match this filter"}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {taskList.length === 0 ? "Create the first task to get started." : "Try a different filter."}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
          {filteredTasks.map((task) => {
            const overdue = isOverdue(task);
            return (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3"
                data-testid={`row-task-${task.id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 truncate">{task.title}</span>
                    {task.projectId && projectTitleById.get(task.projectId) && (
                      <span className="text-xs text-gray-400 truncate">in {projectTitleById.get(task.projectId)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <User className="w-3 h-3" />
                    {internNameById.get(task.assigneeId) || "Unknown"}
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : ""}`}>
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
            );
          })}
        </div>
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        interns={interns}
        projects={projects}
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
          isApproving={approveMutation.isPending}
          isRequestingChanges={requestChangesMutation.isPending}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

function CreateTaskDialog({
  open, onOpenChange, interns, projects, onCreate, isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interns: TaskUser[];
  projects: Project[];
  onCreate: (data: any) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");

  const reset = () => {
    setTitle(""); setDescription(""); setAssigneeId(""); setProjectId(""); setPriority("medium"); setDueDate("");
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
  task, assigneeName, projectTitle, onClose, onApprove, onRequestChanges, onDelete,
  isApproving, isRequestingChanges, isDeleting,
}: {
  task: Task;
  assigneeName: string;
  projectTitle?: string;
  onClose: () => void;
  onApprove: (feedback?: string) => void;
  onRequestChanges: (feedback: string) => void;
  onDelete: () => void;
  isApproving: boolean;
  isRequestingChanges: boolean;
  isDeleting: boolean;
}) {
  const [feedback, setFeedback] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

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
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{task.description}</p>
          )}

          {task.status === "blocked" && task.blockedReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-red-700">Blocked</p>
                <p className="text-sm text-red-700 mt-0.5">{task.blockedReason}</p>
              </div>
            </div>
          )}

          {task.submission && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-gray-500 mb-1">
                Submission {task.submittedAt ? `· ${formatDate(task.submittedAt)}` : ""}
              </p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{task.submission}</p>
            </div>
          )}

          {task.feedback && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1">Feedback</p>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">{task.feedback}</p>
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
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(true)} data-testid="button-delete-task">
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Delete this task?</span>
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
  const [submitTask, setSubmitTask] = useState<Task | null>(null);
  const [blockTask, setBlockTask] = useState<Task | null>(null);
  const [feedbackTask, setFeedbackTask] = useState<Task | null>(null);

  const { data: taskList = [], isLoading, isError } = useQuery<Task[]>({
    queryKey: ["/api/tasks/mine"],
  });

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
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 text-center">
        <p className="text-red-600 font-medium">Couldn't load your tasks. Try refreshing the page.</p>
      </div>
    );
  }

  const grouped: Record<string, Task[]> = {};
  INTERN_GROUPS.forEach((g) => { grouped[g.key] = []; });
  taskList.forEach((t) => { if (grouped[t.status]) grouped[t.status].push(t); });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="text-tasks-title">My Tasks</h1>
        <p className="text-sm text-gray-500 mt-0.5">Everything assigned to you, grouped by status</p>
      </div>

      {taskList.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-gray-200 rounded-xl">
          <ListTodo className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 font-medium">No tasks assigned yet</p>
          <p className="text-sm text-gray-400 mt-1">Your manager hasn't assigned you anything yet.</p>
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
                  <span className="text-xs text-gray-400">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((task) => {
                    const overdue = isOverdue(task);
                    return (
                      <div key={task.id} className="border border-gray-200 rounded-xl p-4" data-testid={`card-task-${task.id}`}>
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">{task.title}</span>
                              <PriorityBadge priority={task.priority} />
                            </div>
                            {task.description && (
                              <p className="text-sm text-gray-600 mt-1">{task.description}</p>
                            )}
                            {task.dueDate && (
                              <p className={`text-xs mt-1.5 flex items-center gap-1 ${overdue ? "text-red-600 font-medium" : "text-gray-400"}`}>
                                <Clock className="w-3 h-3" />
                                Due {formatDate(task.dueDate)}{overdue ? " (overdue)" : ""}
                              </p>
                            )}
                            {task.status === "blocked" && task.blockedReason && (
                              <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                                {task.blockedReason}
                              </div>
                            )}
                            {task.feedback && (task.status === "in_progress" || task.status === "completed") && (
                              <button
                                onClick={() => setFeedbackTask(task)}
                                className="mt-2 text-xs text-blue-600 hover:underline"
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
                                <Button size="sm" variant="outline" onClick={() => setBlockTask(task)} data-testid={`button-block-${task.id}`}>
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
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{feedbackTask.feedback}</p>
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
