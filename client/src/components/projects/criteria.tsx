import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ListChecks, Plus, X } from "lucide-react";
import { Link } from "wouter";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConfirmDialog, EmptyState, ProgressBar, Section } from "@/components/kit";
import { PROJECT_KEYS, type Criterion } from "./types";

// Manager-owned "Definition of Done". Admins add/toggle/delete; interns see
// it read-only so they know what finished means before they get there.
export function DefinitionOfDone({ projectId, criteria, canEdit }: { projectId: string; criteria: Criterion[]; canEdit: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [optional, setOptional] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Criterion | null>(null);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: PROJECT_KEYS.detail(projectId) }); };
  const fail = (t: string) => (e: Error) => toast({ title: t, description: e.message, variant: "destructive" });

  const add = useMutation({
    mutationFn: () => api("POST", `/api/projects/${projectId}/criteria`, { text: text.trim(), optional }),
    onSuccess: () => { setText(""); setOptional(false); invalidate(); },
    onError: fail("Couldn't add criterion"),
  });
  const toggle = useMutation({
    mutationFn: (c: Criterion) => api("POST", `/api/criteria/${c.id}/toggle`, { completed: !c.completed }),
    onSuccess: invalidate,
    onError: fail("Couldn't update criterion"),
  });
  const remove = useMutation({
    mutationFn: (c: Criterion) => api("DELETE", `/api/criteria/${c.id}`),
    onSuccess: () => { setPendingDelete(null); invalidate(); },
    onError: fail("Couldn't remove criterion"),
  });

  const sorted = [...criteria].sort((a, b) => a.sortOrder - b.sortOrder);
  const required = sorted.filter((c) => !c.optional);
  const requiredDone = required.filter((c) => c.completed).length;
  const done = sorted.filter((c) => c.completed).length;

  return (
    <Section title="Definition of done" description={sorted.length ? `${requiredDone} of ${required.length} required met${sorted.length - required.length ? ` · ${sorted.length - required.length} optional` : ""}` : "What has to be true for this project to count as finished."} actions={sorted.length > 0 ? <span className="t-num text-xs text-ink-3">{done}/{sorted.length}</span> : undefined} flush>
      {sorted.length > 0 && <div className="px-4 pt-3"><ProgressBar value={requiredDone} max={Math.max(required.length, 1)} tone={required.length > 0 && requiredDone === required.length ? "ok" : "accent"} /></div>}
      {sorted.length === 0 ? (
        <EmptyState compact icon={<ListChecks />} title="No criteria yet" description={canEdit ? "Write down what finished means — a shipped feature, a demo, a document. The intern sees this list, and the project's health reads from it." : "Your manager hasn't defined what finished looks like for this project yet."} />
      ) : (
        <ul className="divide-y divide-line">
          {sorted.map((c) => (
            <li key={c.id} className="group flex items-start gap-2.5 px-4 py-2.5">
              {canEdit ? (
                <button type="button" onClick={() => toggle.mutate(c)} disabled={toggle.isPending} aria-pressed={c.completed} aria-label={c.completed ? `Mark "${c.text}" not done` : `Mark "${c.text}" done`} className="mt-0.5 shrink-0 rounded-sm">
                  {c.completed ? <CheckCircle2 className="h-4 w-4 text-ok" /> : <Circle className="h-4 w-4 text-ink-4 hover:text-ink-2" />}
                </button>
              ) : (
                c.completed ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-label="Done" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-label="Not done" />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-[13px]", c.completed ? "text-ink-3 line-through" : "text-ink")}>{c.text}{c.optional && <span className="ml-1.5 text-xs text-ink-4 no-underline">optional</span>}</p>
                {c.taskId && <Link href={`/tasks/${c.taskId}`} className="text-xs text-accent hover:underline">Linked task</Link>}
              </div>
              {canEdit && (
                <Button variant="ghost" size="icon-xs" aria-label={`Remove "${c.text}"`} className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-ink-3 hover:text-danger" onClick={() => setPendingDelete(c)}><X className="h-3.5 w-3.5" /></Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <form className="flex flex-col gap-2 border-t border-line px-4 py-3 sm:flex-row sm:items-center" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !add.isPending) add.mutate(); }}>
          <Input aria-label="New criterion" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a criterion, e.g. “Demo recorded and shared in #eng”" className="h-8 text-[13px] flex-1" maxLength={300} />
          <div className="flex items-center gap-3">
            <Label htmlFor={`optional-${projectId}`} className="flex items-center gap-1.5 text-xs text-ink-3 font-normal cursor-pointer"><Checkbox id={`optional-${projectId}`} checked={optional} onCheckedChange={(v) => setOptional(v === true)} />Optional</Label>
            <Button type="submit" size="sm" variant="outline" disabled={!text.trim() || add.isPending}><Plus className="h-3.5 w-3.5" />{add.isPending ? "Adding…" : "Add"}</Button>
          </div>
        </form>
      )}
      <ConfirmDialog open={!!pendingDelete} onOpenChange={(o) => { if (!o) setPendingDelete(null); }} title="Remove this criterion?" description={pendingDelete ? `“${pendingDelete.text}” is removed from the definition of done.` : undefined} confirmLabel="Remove" destructive pending={remove.isPending} onConfirm={() => { if (pendingDelete) remove.mutate(pendingDelete); }} />
    </Section>
  );
}
