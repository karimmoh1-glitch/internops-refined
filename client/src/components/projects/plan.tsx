import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, MessageSquare, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate, pluralize } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill, ProgressBar, RelativeTime, SkeletonRows, ErrorState, EmptyState, Section, Metric } from "@/components/kit";
import { invalidateProject } from "./dialogs";
import { PROJECT_KEYS, planVersionTone, type PlanComment, type PlanContent, type PlanVersion, type WeekPlan } from "./types";

// ---- Plan summary strip ------------------------------------------------------

export function PlanSummary({ plan, minimumHours, version }: { plan: PlanContent; minimumHours: number; version?: PlanVersion }) {
  const meets = plan.totalPlannedHours >= minimumHours;
  const tone = planVersionTone(version?.status ?? "draft");
  return (
    <div className="panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="t-section">Plan{version ? ` v${version.versionNumber}` : ""}</h3>
          {version && <Pill tone={tone.tone}>{tone.label}</Pill>}
        </div>
        {version?.createdAt && <span className="text-xs text-ink-3">Created <RelativeTime value={version.createdAt} live={false} /></span>}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {[
          { label: "Hours / day", value: plan.hoursPerDay },
          { label: "Days / week", value: plan.daysPerWeek },
          { label: "Weeks", value: plan.numberOfWeeks },
          { label: "Total planned", value: <Metric value={plan.totalPlannedHours} unit="h" className={meets ? "text-ok" : "text-warn"} /> },
        ].map((s) => (
          <div key={s.label}>
            <dt className="t-label">{s.label}</dt>
            <dd className="t-num mt-1 text-lg font-semibold text-ink leading-none">{s.value}</dd>
          </div>
        ))}
      </dl>
      {minimumHours > 0 && (
        <div className="mt-3">
          <ProgressBar value={plan.totalPlannedHours} max={minimumHours} tone={meets ? "ok" : "warn"} />
          <p className="mt-1.5 text-xs text-ink-3">{meets ? `Covers the ${minimumHours}h minimum.` : `${minimumHours - plan.totalPlannedHours}h short of the ${minimumHours}h minimum.`}</p>
        </div>
      )}
    </div>
  );
}

// ---- Weekly plan accordion --------------------------------------------------

function WeekRow({ week, open, onToggle, right }: { week: WeekPlan; open: boolean; onToggle: () => void; right?: React.ReactNode }) {
  const id = `week-${week.weekNumber}`;
  return (
    <li className={cn("rounded-md border transition-colors", open ? "border-line-strong bg-surface" : "border-line bg-surface hover:bg-surface-2")}>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={id} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-3" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-4" />}
        <span className="t-num shrink-0 text-xs font-medium text-ink-3 w-8">W{week.weekNumber}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{week.milestone}</span>
        {right}
        <span className="t-num shrink-0 text-xs text-ink-3">{week.hours}h</span>
      </button>
      {open && (
        <div id={id} className="hairline-b border-t border-line px-3 pb-3 pt-3 text-[13px] text-ink-2 space-y-3">
          <div>
            <p className="t-label mb-1.5">Deliverables</p>
            {(week.deliverables ?? []).length === 0 ? <p className="text-ink-3">None listed.</p> : (
              <ul className="space-y-1">
                {(week.deliverables ?? []).map((d, i) => <li key={i} className="flex gap-2"><span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-ink-4" /><span>{d}</span></li>)}
              </ul>
            )}
          </div>
          <div>
            <p className="t-label mb-1">Success criteria</p>
            <p>{week.successCriteria || "Not specified."}</p>
          </div>
        </div>
      )}
    </li>
  );
}

export function PlanDisplay({ plan, defaultOpen = [1] }: { plan: PlanContent; defaultOpen?: number[] }) {
  const [open, setOpen] = useState<Set<number>>(() => new Set(defaultOpen));
  const toggle = (n: number) => setOpen((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  const weeks = plan.weeks ?? [];
  if (weeks.length === 0) return <p className="text-[13px] text-ink-3">This plan has no weeks in it.</p>;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="t-label">{pluralize(weeks.length, "week")}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="xs" onClick={() => setOpen(new Set(weeks.map((w) => w.weekNumber)))}>Expand all</Button>
          <Button variant="ghost" size="xs" onClick={() => setOpen(new Set())}>Collapse</Button>
        </div>
      </div>
      <ul className="space-y-1.5">
        {weeks.map((w) => <WeekRow key={w.weekNumber} week={w} open={open.has(w.weekNumber)} onToggle={() => toggle(w.weekNumber)} />)}
      </ul>
    </div>
  );
}

// ---- Comments on a plan version ---------------------------------------------
// Visible to BOTH roles. The legacy intern workspace never surfaced these,
// which meant revision requests were only ever seen as a truncated
// notification. Admins can add; interns read.

export function usePlanComments(versionId: string | undefined) {
  return useQuery<PlanComment[]>({ queryKey: PROJECT_KEYS.planComments(versionId ?? "none"), enabled: !!versionId, staleTime: 15_000 });
}

export function PlanCommentList({ comments, emptyText = "No manager feedback on this version yet." }: { comments: PlanComment[]; emptyText?: string }) {
  if (comments.length === 0) return <p className="text-[13px] text-ink-3">{emptyText}</p>;
  return (
    <ol className="space-y-2">
      {[...comments].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((c) => (
        <li key={c.id} className="rounded-md border border-info/20 bg-info-soft/60 px-3 py-2">
          <div className="flex items-start gap-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-wrap text-[13px] text-ink">{c.content}</p>
              <p className="mt-1 text-xs text-ink-3">Manager · <RelativeTime value={c.createdAt} live={false} /></p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function AddPlanComment({ versionId, projectId }: { versionId: string; projectId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const add = useMutation({
    mutationFn: () => api("POST", `/api/plan-versions/${versionId}/comments`, { content: text.trim() }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PROJECT_KEYS.planComments(versionId) });
      invalidateProject(qc, projectId);
      setText("");
      toast({ title: "Comment added", description: "The intern is notified." });
    },
    onError: (e: Error) => toast({ title: "Couldn't add comment", description: e.message, variant: "destructive" }),
  });
  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-start" onSubmit={(e) => { e.preventDefault(); if (text.trim() && !add.isPending) add.mutate(); }}>
      <Textarea aria-label="Comment on this plan" value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Leave a note on this version — the intern sees it in their Plan tab." className="min-h-[44px] flex-1" />
      <Button type="submit" variant="outline" size="sm" disabled={!text.trim() || add.isPending} className="shrink-0">{add.isPending ? "Adding…" : "Add comment"}</Button>
    </form>
  );
}

// ---- Version history --------------------------------------------------------

function VersionItem({ version, current, projectId, canComment }: { version: PlanVersion; current: boolean; projectId: string; canComment: boolean }) {
  const [open, setOpen] = useState(false);
  const comments = usePlanComments(open ? version.id : undefined);
  const tone = planVersionTone(version.status);
  const plan = version.contentJson;
  return (
    <li className="rounded-md border border-line">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2 rounded-md">
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-3" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-4" />}
        <span className="t-num text-[13px] font-medium text-ink">v{version.versionNumber}</span>
        <Pill tone={tone.tone}>{tone.label}</Pill>
        {current && <span className="text-xs text-ink-3">current</span>}
        <span className="ml-auto t-num text-xs text-ink-3 shrink-0">{plan?.numberOfWeeks ?? "–"}w · {plan?.totalPlannedHours ?? "–"}h{version.createdAt ? ` · ${formatDate(version.createdAt)}` : ""}</span>
      </button>
      {open && (
        <div className="border-t border-line px-3 py-3 space-y-3">
          {plan?.weeks?.length ? <PlanDisplay plan={plan} defaultOpen={[]} /> : <p className="text-[13px] text-ink-3">No content stored for this version.</p>}
          <div>
            <p className="t-label mb-1.5">Manager feedback</p>
            {comments.isLoading ? <SkeletonRows rows={1} /> : comments.error ? <ErrorState compact message={(comments.error as Error).message} onRetry={() => comments.refetch()} /> : <PlanCommentList comments={comments.data ?? []} />}
            {canComment && <div className="mt-2"><AddPlanComment versionId={version.id} projectId={projectId} /></div>}
          </div>
        </div>
      )}
    </li>
  );
}

export function VersionHistory({ versions, currentId, projectId, canComment }: { versions: PlanVersion[]; currentId?: string; projectId: string; canComment: boolean }) {
  const sorted = useMemo(() => [...versions].sort((a, b) => b.versionNumber - a.versionNumber), [versions]);
  if (sorted.length === 0) return null;
  return (
    <Section title="Version history" description={`${pluralize(sorted.length, "version")} · every revision request creates a new draft`}>
      <ol className="space-y-1.5">
        {sorted.map((v) => <VersionItem key={v.id} version={v} current={v.id === currentId} projectId={projectId} canComment={canComment} />)}
      </ol>
    </Section>
  );
}

// ---- Generate plan dialog (intern) -----------------------------------------

export function GeneratePlanDialog({ projectId, minimumHours, open, onOpenChange, onGenerated }: { projectId: string; minimumHours: number; open: boolean; onOpenChange: (o: boolean) => void; onGenerated?: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [hpd, setHpd] = useState("4");
  const [dpw, setDpw] = useState("5");
  const [weeks, setWeeks] = useState(() => String(Math.max(1, Math.ceil(minimumHours / 20)) || 8));
  const total = (Number(hpd) || 0) * (Number(dpw) || 0) * (Number(weeks) || 0);
  const ok = Number(hpd) > 0 && Number(hpd) <= 24 && Number(dpw) > 0 && Number(dpw) <= 7 && Number.isInteger(Number(weeks)) && Number(weeks) > 0 && Number(weeks) <= 52 && total >= minimumHours;

  const gen = useMutation({
    mutationFn: () => api<{ planVersion: PlanVersion }>("POST", `/api/projects/${projectId}/generate-plan`, { hoursPerDay: Number(hpd), daysPerWeek: Number(dpw), numberOfWeeks: Number(weeks) }),
    onSuccess: ({ planVersion }) => {
      invalidateProject(qc, projectId);
      toast({ title: `Plan v${planVersion.versionNumber} drafted`, description: "Review it, ask the mentor for changes, then submit it." });
      onOpenChange(false);
      onGenerated?.();
    },
    onError: (e: Error) => toast({ title: "Couldn't generate a plan", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!gen.isPending) onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate a first draft</DialogTitle>
          <DialogDescription>The mentor splits the project idea into weekly milestones that fit your schedule. You can change anything afterwards.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (ok && !gen.isPending) gen.mutate(); }}>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "gen-hpd", label: "Hours / day", v: hpd, set: setHpd, max: 24 },
              { id: "gen-dpw", label: "Days / week", v: dpw, set: setDpw, max: 7 },
              { id: "gen-weeks", label: "Weeks", v: weeks, set: setWeeks, max: 52 },
            ].map((f) => (
              <div key={f.id} className="space-y-1.5">
                <Label htmlFor={f.id} className="text-xs text-ink-2">{f.label}</Label>
                <Input id={f.id} type="number" min={1} max={f.max} inputMode="numeric" value={f.v} onChange={(e) => f.set(e.target.value)} className="t-num" />
              </div>
            ))}
          </div>
          <div className={cn("rounded-md border px-3 py-2 text-[13px]", total >= minimumHours ? "border-ok/20 bg-ok-soft text-ok" : "border-warn/25 bg-warn-soft text-warn")}>
            <span className="t-num font-semibold">{total}h</span> planned · minimum {minimumHours}h{total < minimumHours && ` · add ${minimumHours - total}h`}
          </div>
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={gen.isPending}>Cancel</Button>
            <Button type="submit" variant="pulse" disabled={!ok || gen.isPending}><Sparkles className="h-4 w-4" />{gen.isPending ? "Drafting… ~20s" : "Generate plan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NoPlanState({ canGenerate, onGenerate, minimumHours }: { canGenerate: boolean; onGenerate?: () => void; minimumHours: number }) {
  return (
    <EmptyState
      icon={<Sparkles />}
      title="No plan yet"
      description={canGenerate ? `Generate a first draft from the project idea and the hours you have. It needs to cover at least ${minimumHours}h; you can reshape it with the mentor before submitting.` : "The intern hasn't drafted a plan for this project yet. You'll be notified when one is submitted for review."}
      action={canGenerate && onGenerate ? <Button variant="pulse" size="sm" onClick={onGenerate}><Sparkles className="h-4 w-4" />Generate a first draft</Button> : undefined}
    />
  );
}
