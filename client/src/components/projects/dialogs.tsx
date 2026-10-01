import { useEffect, useState } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_KEYS, useInterns, type Project } from "./types";

// Every project mutation touches the same handful of caches. One helper so
// no screen forgets one.
export function invalidateProject(qc: QueryClient, id?: string) {
  void qc.invalidateQueries({ queryKey: PROJECT_KEYS.list });
  // Overview keys carry a tz query string, so match on the path prefix.
  void qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && /^\/api\/(overview|me\/overview|notifications)/.test(q.queryKey[0]) });
  if (id) {
    void qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(id) });
    void qc.invalidateQueries({ queryKey: PROJECT_KEYS.logs(id) });
  }
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[13px] text-ink-2">{label}</Label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

// ---- Admin: assign a project to an intern -----------------------------------

export function AssignProjectDialog({ open, onOpenChange, defaultInternId }: { open: boolean; onOpenChange: (o: boolean) => void; defaultInternId?: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const interns = useInterns(open);
  const [internId, setInternId] = useState(defaultInternId ?? "");
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [hours, setHours] = useState("");
  const [repo, setRepo] = useState("");

  useEffect(() => { if (open && defaultInternId) setInternId(defaultInternId); }, [open, defaultInternId]);

  const reset = () => { setInternId(defaultInternId ?? ""); setTitle(""); setIdea(""); setHours(""); setRepo(""); };

  const assign = useMutation({
    mutationFn: async () => {
      const project = await api<Project>("POST", "/api/projects", { internId, title: title.trim(), idea: idea.trim(), minimumTotalHours: Number(hours) });
      // The create endpoint doesn't take a repo URL; the GitHub endpoint
      // validates it (format + token access), so it's a second call.
      if (repo.trim()) {
        try { await api("PUT", `/api/projects/${project.id}/github`, { githubRepoUrl: repo.trim() }); }
        catch (e) { toast({ title: "Project assigned, but the repository wasn't linked", description: (e as Error).message, variant: "destructive" }); }
      }
      return project;
    },
    onSuccess: (p) => {
      invalidateProject(qc, p.id);
      toast({ title: "Project assigned", description: `"${p.title}" is now on the intern's board.` });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Couldn't assign project", description: e.message, variant: "destructive" }),
  });

  const valid = !!internId && title.trim() && idea.trim() && Number(hours) > 0;
  const active = (interns.data ?? []).filter((i) => !i.deactivatedAt);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign a project</DialogTitle>
          <DialogDescription>The intern gets notified and plans it with the AI mentor before you review.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !assign.isPending) assign.mutate(); }}>
          <Field id="assign-intern" label="Intern">
            <Select value={internId} onValueChange={setInternId}>
              <SelectTrigger id="assign-intern" aria-label="Intern"><SelectValue placeholder={interns.isLoading ? "Loading interns…" : "Choose an intern"} /></SelectTrigger>
              <SelectContent>
                {active.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} <span className="text-ink-3">· {i.email}</span></SelectItem>)}
                {!interns.isLoading && active.length === 0 && <div className="px-2 py-1.5 text-xs text-ink-3">No active interns yet.</div>}
              </SelectContent>
            </Select>
          </Field>
          <Field id="assign-title" label="Title">
            <Input id="assign-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Internal analytics dashboard" autoFocus />
          </Field>
          <Field id="assign-idea" label="Idea" hint="The AI mentor uses this to draft the plan, so include the outcome you want and any constraints.">
            <Textarea id="assign-idea" value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} placeholder="What should be built, for whom, and what does done look like?" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="assign-hours" label="Minimum total hours" hint="Plans under this total are rejected by the server.">
              <Input id="assign-hours" type="number" min={1} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="80" />
            </Field>
            <Field id="assign-repo" label="GitHub repository (optional)">
              <div className="relative">
                <Github className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
                <Input id="assign-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/owner/repo" className="pl-8" />
              </div>
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || assign.isPending}>{assign.isPending ? "Assigning…" : "Assign project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Intern: propose a project ---------------------------------------------

export function ProposeProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [idea, setIdea] = useState("");
  const [hours, setHours] = useState("");
  const reset = () => { setTitle(""); setIdea(""); setHours(""); };

  const propose = useMutation({
    mutationFn: () => api<Project>("POST", "/api/projects/propose", { title: title.trim(), idea: idea.trim(), minimumTotalHours: Number(hours) }),
    onSuccess: () => {
      invalidateProject(qc);
      toast({ title: "Proposal sent", description: "A manager will review it. You'll be notified either way." });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Couldn't send proposal", description: e.message, variant: "destructive" }),
  });

  const valid = title.trim() && idea.trim() && Number(hours) > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Propose a project</DialogTitle>
          <DialogDescription>Pitch something you want to build. A manager reviews it before it becomes a real project.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !propose.isPending) propose.mutate(); }}>
          <Field id="propose-title" label="Title">
            <Input id="propose-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Slack digest bot for weekly standups" autoFocus />
          </Field>
          <Field id="propose-idea" label="The idea" hint="What would you build, why does it matter, and what would exist at the end?">
            <Textarea id="propose-idea" value={idea} onChange={(e) => setIdea(e.target.value)} rows={5} placeholder="Describe the problem, your approach, and the outcome." />
          </Field>
          <Field id="propose-hours" label="Estimated total hours" hint="A rough commitment. Your plan will need to cover at least this much.">
            <Input id="propose-hours" type="number" min={1} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="40" className="max-w-[160px]" />
          </Field>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || propose.isPending}>{propose.isPending ? "Sending…" : "Send for review"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Admin: edit title / idea / hours / repo --------------------------------

export function EditProjectDialog({ project, open, onOpenChange }: { project: Project; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState(project.title);
  const [idea, setIdea] = useState(project.idea);
  const [hours, setHours] = useState(String(project.minimumTotalHours ?? ""));
  const [repo, setRepo] = useState(project.githubRepoUrl ?? "");

  useEffect(() => {
    if (open) { setTitle(project.title); setIdea(project.idea); setHours(String(project.minimumTotalHours ?? "")); setRepo(project.githubRepoUrl ?? ""); }
  }, [open, project]);

  const save = useMutation({
    mutationFn: async () => {
      await api("PUT", `/api/projects/${project.id}`, { title: title.trim(), idea: idea.trim(), minimumTotalHours: Number(hours) });
      if (repo.trim() !== (project.githubRepoUrl ?? "")) {
        await api("PUT", `/api/projects/${project.id}/github`, { githubRepoUrl: repo.trim() || null });
      }
    },
    onSuccess: () => {
      invalidateProject(qc, project.id);
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.commits(project.id) });
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.pulls(project.id) });
      toast({ title: "Project updated" });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Couldn't save changes", description: e.message, variant: "destructive" }),
  });

  const valid = title.trim() && idea.trim() && Number(hours) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit project</DialogTitle>
          <DialogDescription>The intern is notified of changes. Plans already written are not rewritten.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid && !save.isPending) save.mutate(); }}>
          <Field id="edit-title" label="Title"><Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
          <Field id="edit-idea" label="Idea"><Textarea id="edit-idea" value={idea} onChange={(e) => setIdea(e.target.value)} rows={4} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="edit-hours" label="Minimum total hours"><Input id="edit-hours" type="number" min={1} inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
            <Field id="edit-repo" label="GitHub repository">
              <div className="relative">
                <Github className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-4" />
                <Input id="edit-repo" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="https://github.com/owner/repo" className="pl-8" />
              </div>
            </Field>
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={!valid || save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Admin: reject a proposal (optional reason, shared with the intern) ------

export function RejectProposalDialog({ project, open, onOpenChange }: { project: Project | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  useEffect(() => { if (!open) setReason(""); }, [open]);

  const reject = useMutation({
    mutationFn: () => api("POST", `/api/projects/${project!.id}/reject-proposal`, { reason: reason.trim() || undefined }),
    onSuccess: () => {
      invalidateProject(qc, project?.id);
      toast({ title: "Proposal declined", description: project ? `"${project.title}" was sent back to the intern.` : undefined });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: "Couldn't decline proposal", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open && !!project} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline "{project?.title}"?</DialogTitle>
          <DialogDescription>The intern keeps the reason on the project so they can propose something better.</DialogDescription>
        </DialogHeader>
        <Field id="reject-reason" label="Reason (optional)">
          <Textarea id="reject-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Too broad for the hours available — narrow it to one workflow." />
        </Field>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="destructive" disabled={reject.isPending} onClick={() => reject.mutate()}>{reject.isPending ? "Declining…" : "Decline proposal"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Approve is a one-liner shared by the list row and the detail header.
export function useApproveProposal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (project: Project) => api<Project>("POST", `/api/projects/${project.id}/approve-proposal`),
    onSuccess: (p) => { invalidateProject(qc, p.id); toast({ title: "Proposal approved", description: `"${p.title}" is now assigned and ready for planning.` }); },
    onError: (e: Error) => toast({ title: "Couldn't approve proposal", description: e.message, variant: "destructive" }),
  });
}
