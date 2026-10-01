import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTaskMutations } from "./useTaskMutations";
import { X } from "lucide-react";

export interface TaskFormValues { id?: string; title: string; description: string; assigneeId: string; projectId: string; priority: "low" | "medium" | "high"; dueDate: string; skillTags: string[]; dependsOnTaskId: string }

// Create and edit share one form. Assignee/project/dependency options come
// from the same endpoints the server validates against.
export function TaskFormDialog({ open, onOpenChange, initial, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: Partial<TaskFormValues>; onSaved?: (id: string) => void }) {
  const editing = !!initial?.id;
  const m = useTaskMutations(initial?.id);
  const [v, setV] = useState<TaskFormValues>(() => ({ title: "", description: "", assigneeId: "", projectId: "", priority: "medium", dueDate: "", skillTags: [], dependsOnTaskId: "", ...initial }));
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (open) { setV({ title: "", description: "", assigneeId: "", projectId: "", priority: "medium", dueDate: "", skillTags: [], dependsOnTaskId: "", ...initial }); setError(null); } }, [open, initial]);

  const interns = useQuery<{ id: string; name: string; deactivatedAt: string | null }[]>({ queryKey: ["/api/interns"], enabled: open });
  const projects = useQuery<{ id: string; title: string; internId: string; status: string }[]>({ queryKey: ["/api/projects"], enabled: open });
  const tasks = useQuery<{ id: string; title: string; status: string; assigneeId: string }[]>({ queryKey: ["/api/tasks"], enabled: open });

  const assigneeProjects = useMemo(() => (projects.data ?? []).filter((p) => !v.assigneeId || p.internId === v.assigneeId).filter((p) => p.status !== "rejected"), [projects.data, v.assigneeId]);
  const dependencyOptions = useMemo(() => (tasks.data ?? []).filter((t) => t.id !== v.id && t.status !== "completed"), [tasks.data, v.id]);

  const addTag = () => { const t = tagInput.trim().replace(/,$/, ""); if (t && !v.skillTags.includes(t) && v.skillTags.length < 10) setV({ ...v, skillTags: [...v.skillTags, t] }); setTagInput(""); };
  const pending = m.create.isPending || m.update.isPending;

  const save = async () => {
    setError(null);
    if (!v.title.trim()) return setError("Give the task a title.");
    if (!v.assigneeId) return setError("Choose who this task is for.");
    const payload = { title: v.title.trim(), description: v.description.trim() || null, assigneeId: v.assigneeId, projectId: v.projectId || null, priority: v.priority, dueDate: v.dueDate ? new Date(v.dueDate + "T17:00:00").toISOString() : null, skillTags: v.skillTags, dependsOnTaskId: v.dependsOnTaskId || null };
    try {
      if (editing) { await m.update.mutateAsync({ id: v.id, data: payload }); onSaved?.(v.id!); }
      else { const created = await m.create.mutateAsync(payload); onSaved?.(created.id); }
      onOpenChange(false);
    } catch (e) { setError((e as Error).message); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>{editing ? "Changes are visible to the assignee immediately." : "The assignee is notified as soon as you save."}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div>
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" autoFocus value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} placeholder="e.g. Draft the onboarding email sequence" maxLength={200} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="task-desc">Description <span className="text-ink-4 font-normal">(optional)</span></Label>
            <Textarea id="task-desc" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} placeholder="What does done look like? Links, context, acceptance criteria." rows={4} className="mt-1.5" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="task-assignee">Assignee</Label>
              <Select value={v.assigneeId} onValueChange={(val) => setV({ ...v, assigneeId: val, projectId: assigneeProjects.some((p) => p.id === v.projectId && p.internId === val) ? v.projectId : "" })}>
                <SelectTrigger id="task-assignee" className="mt-1.5"><SelectValue placeholder={interns.isLoading ? "Loading…" : "Choose a person"} /></SelectTrigger>
                <SelectContent>{(interns.data ?? []).filter((i) => !i.deactivatedAt).map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-project">Project <span className="text-ink-4 font-normal">(optional)</span></Label>
              <Select value={v.projectId || "__none"} onValueChange={(val) => setV({ ...v, projectId: val === "__none" ? "" : val })}>
                <SelectTrigger id="task-project" className="mt-1.5"><SelectValue placeholder="No project" /></SelectTrigger>
                <SelectContent><SelectItem value="__none">No project</SelectItem>{assigneeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={v.priority} onValueChange={(val) => setV({ ...v, priority: val as TaskFormValues["priority"] })}>
                <SelectTrigger id="task-priority" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="high">High</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="low">Low</SelectItem></SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="task-due">Due date <span className="text-ink-4 font-normal">(optional)</span></Label>
              <Input id="task-due" type="date" value={v.dueDate} onChange={(e) => setV({ ...v, dueDate: e.target.value })} className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="task-depends">Depends on <span className="text-ink-4 font-normal">(optional)</span></Label>
            <Select value={v.dependsOnTaskId || "__none"} onValueChange={(val) => setV({ ...v, dependsOnTaskId: val === "__none" ? "" : val })}>
              <SelectTrigger id="task-depends" className="mt-1.5"><SelectValue placeholder="Nothing" /></SelectTrigger>
              <SelectContent><SelectItem value="__none">Nothing</SelectItem>{dependencyOptions.map((t) => <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-tags">Labels <span className="text-ink-4 font-normal">(skills, up to 10)</span></Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
              {v.skillTags.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-sm bg-surface-2 border border-line px-1.5 h-6 text-xs text-ink">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setV({ ...v, skillTags: v.skillTags.filter((x) => x !== t) })} className="text-ink-3 hover:text-ink"><X className="h-3 w-3" /></button></span>)}
              <input id="task-tags" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } else if (e.key === "Backspace" && !tagInput && v.skillTags.length) setV({ ...v, skillTags: v.skillTags.slice(0, -1) }); }} onBlur={addTag} placeholder={v.skillTags.length ? "" : "React, SQL, writing…"} className="h-6 min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-ink-4" />
            </div>
          </div>
          {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Create task"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
