import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronRight, ExternalLink, Github, Globe, HelpCircle, Inbox, Linkedin, X } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, CopyButton, EmptyState, ErrorState, Pill, RelativeTime, Section, SectionLabel, SkeletonRows, type Tone } from "@/components/kit";
import { type Application, type Overview, invalidatePeople, isOpenApplication, overviewKey } from "./types";

const STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warn" },
  under_review: { label: "Under review", tone: "info" },
  needs_information: { label: "Needs info", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "neutral" },
};

type NotesKind = "reject" | "request-info";

export function ApplicationsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const apps = useQuery<Application[]>({ queryKey: ["/api/applications"] });
  const overview = useQuery<Overview>({ queryKey: [overviewKey()], staleTime: 30_000 });
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notesFor, setNotesFor] = useState<{ app: Application; kind: NotesKind } | null>(null);
  const [notes, setNotes] = useState("");

  const company = overview.data?.company;
  const accepting = company?.acceptingApplications ?? false;
  const applyLink = company?.slug ? `${window.location.origin}/apply/${company.slug}` : "";

  const refresh = () => invalidatePeople(qc);
  const fail = (title: string) => (err: Error) => toast({ title, description: err.message, variant: "destructive" });

  const toggleAccepting = useMutation({
    mutationFn: (accepting: boolean) => api("PUT", "/api/company/accepting-applications", { accepting }),
    onSuccess: (_d, on) => { refresh(); toast({ title: on ? "Applications open" : "Applications closed", description: on ? "Your public application page is live." : "The public page now says applications are closed." }); },
    onError: fail("Couldn't update setting"),
  });
  const approve = useMutation({
    mutationFn: (a: Application) => api("POST", `/api/applications/${a.id}/approve`),
    onSuccess: (_d, a) => { refresh(); toast({ title: "Approved", description: `${a.name} can now sign in as an intern.` }); },
    onError: fail("Couldn't approve"),
  });
  const dismiss = useMutation({
    mutationFn: (a: Application) => api("POST", `/api/applications/${a.id}/dismiss`),
    onSuccess: () => { refresh(); toast({ title: "Dismissed", description: "Moved to history. Nothing was sent to the applicant." }); },
    onError: fail("Couldn't dismiss"),
  });
  const reject = useMutation({
    mutationFn: ({ a, n }: { a: Application; n: string }) => api("POST", `/api/applications/${a.id}/reject`, { notes: n.trim() || undefined }),
    onSuccess: () => { refresh(); setNotesFor(null); setNotes(""); toast({ title: "Application rejected", description: "The applicant was emailed if mail is configured." }); },
    onError: fail("Couldn't reject"),
  });
  const requestInfo = useMutation({
    mutationFn: ({ a, n }: { a: Application; n: string }) => api("POST", `/api/applications/${a.id}/request-info`, { notes: n.trim() }),
    onSuccess: () => { refresh(); setNotesFor(null); setNotes(""); toast({ title: "Marked as needing information", description: "Your note is saved on the application." }); },
    onError: fail("Couldn't update"),
  });

  const { open, history } = useMemo(() => {
    const all = [...(apps.data ?? [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { open: all.filter(isOpenApplication), history: all.filter((a) => !isOpenApplication(a)) };
  }, [apps.data]);

  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const row = (a: Application, reviewable: boolean) => {
    const st = STATUS[a.status] ?? { label: a.status.replace(/_/g, " "), tone: "neutral" as Tone };
    const isOpen = expanded.has(a.id);
    const busy = approve.isPending || dismiss.isPending;
    return (
      <li key={a.id} className="group">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
          <button type="button" onClick={() => toggle(a.id)} aria-expanded={isOpen} aria-controls={`app-${a.id}`} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-3" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
            <Avatar name={a.name} size="sm" />
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-ink">{a.name}</span>
              <span className="block truncate text-xs text-ink-3">{a.email} · applied <RelativeTime value={a.createdAt} live={false} /></span>
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            <Pill tone={st.tone}>{st.label}</Pill>
            {a.dismissedAt && <Pill tone="neutral">Dismissed</Pill>}
            {reviewable && (
              <Button variant="ghost" size="icon-xs" aria-label={`Dismiss ${a.name}'s application`} title="Dismiss from review (kept in history)" disabled={busy} onClick={() => dismiss.mutate(a)}><X className="h-3.5 w-3.5" /></Button>
            )}
          </div>
        </div>
        {isOpen && (
          <div id={`app-${a.id}`} className="space-y-3 border-t border-line bg-surface-2/60 px-4 py-3 pl-[52px]">
            {a.skills && <div><div className="t-label mb-1">Skills</div><p className="text-[13px] text-ink-2 whitespace-pre-wrap">{a.skills}</p></div>}
            {a.motivation && <div><div className="t-label mb-1">Why they want to join</div><p className="text-[13px] text-ink-2 whitespace-pre-wrap">{a.motivation}</p></div>}
            {(a.githubUrl || a.linkedinUrl || a.portfolioUrl) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {a.githubUrl && <a href={a.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><Github className="h-3.5 w-3.5" />GitHub<ExternalLink className="h-3 w-3 text-ink-4" /></a>}
                {a.linkedinUrl && <a href={a.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><Linkedin className="h-3.5 w-3.5" />LinkedIn<ExternalLink className="h-3 w-3 text-ink-4" /></a>}
                {a.portfolioUrl && <a href={a.portfolioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-ink-2 hover:text-ink"><Globe className="h-3.5 w-3.5" />Portfolio<ExternalLink className="h-3 w-3 text-ink-4" /></a>}
              </div>
            )}
            {a.reviewerNotes && (
              <div><div className="t-label mb-1">Reviewer note{a.reviewedAt && <span className="normal-case tracking-normal font-normal"> · {formatDateTime(a.reviewedAt)}</span>}</div><p className="text-[13px] text-ink-2 whitespace-pre-wrap">{a.reviewerNotes}</p></div>
            )}
            {!a.skills && !a.motivation && !a.githubUrl && !a.linkedinUrl && !a.portfolioUrl && !a.reviewerNotes && <p className="text-xs text-ink-3">The applicant left every optional field empty.</p>}
            {reviewable && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button size="sm" disabled={busy} onClick={() => approve.mutate(a)}><Check className="h-3.5 w-3.5" />{approve.isPending && approve.variables?.id === a.id ? "Approving…" : "Approve"}</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => { setNotes(""); setNotesFor({ app: a, kind: "request-info" }); }}><HelpCircle className="h-3.5 w-3.5" />Request info</Button>
                <Button size="sm" variant="outline" className="text-danger hover:bg-danger-soft" disabled={busy} onClick={() => { setNotes(""); setNotesFor({ app: a, kind: "reject" }); }}><X className="h-3.5 w-3.5" />Reject</Button>
              </div>
            )}
          </div>
        )}
      </li>
    );
  };

  const settingsPanel = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-lg border border-line bg-surface-2/60 px-3.5 py-3">
      <div className="flex items-center gap-3">
        <Switch id="accepting-applications" checked={accepting} disabled={overview.isLoading || toggleAccepting.isPending} onCheckedChange={(v) => toggleAccepting.mutate(v)} aria-label="Accepting applications" />
        <div>
          <Label htmlFor="accepting-applications" className="text-[13px] font-medium text-ink">Accepting applications</Label>
          <p className="text-xs text-ink-3">{overview.isLoading ? "Loading…" : accepting ? "Anyone with the link can apply." : "The public page is closed. Turn on to publish it."}</p>
        </div>
      </div>
      {accepting && applyLink && (
        <div className="flex min-w-0 items-center gap-1 rounded-md border border-line bg-surface px-2 py-1">
          <code className="min-w-0 max-w-[240px] truncate font-mono text-[12px] text-ink-2">{applyLink.replace(/^https?:\/\//, "")}</code>
          <CopyButton value={applyLink} size="icon-sm" label="Copy application link" />
          <Button asChild variant="ghost" size="icon-sm" aria-label="Open public application page"><a href={applyLink} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button>
        </div>
      )}
    </div>
  );

  const notesTitle = notesFor?.kind === "reject" ? `Reject ${notesFor.app.name}'s application?` : `What do you need from ${notesFor?.app.name ?? "the applicant"}?`;

  return (
    <div className="space-y-4">
      <Section title="Applications" description="Candidates who applied through your public page. Approving creates their intern account with the password they chose." flush>
        <div className="p-4">{settingsPanel}</div>
        {apps.isLoading ? <div className="px-4 pb-4"><SkeletonRows rows={3} /></div> :
          apps.error ? <ErrorState compact message={(apps.error as Error).message} onRetry={() => void apps.refetch()} /> :
          (apps.data ?? []).length === 0 ? (
            <EmptyState compact icon={<Inbox />} title="No applications yet"
              description={accepting ? "Share your public application page. Each submission shows up here for review." : "Turn on “Accepting applications” to publish a page where candidates can apply with their name, skills, and links."}
              action={accepting && applyLink ? <CopyButton value={applyLink} label="Copy application link" size="sm" className="border border-line-strong" /> : !accepting ? <Button size="sm" disabled={toggleAccepting.isPending} onClick={() => toggleAccepting.mutate(true)}>Open applications</Button> : undefined} />
          ) : (
            <div className="border-t border-line">
              <div className="px-4 pt-3"><SectionLabel right={<span className="t-num text-xs text-ink-3">{open.length}</span>}>Needs review</SectionLabel></div>
              {open.length === 0
                ? <p className="px-4 pb-4 text-[13px] text-ink-3">All caught up. Nothing is waiting for a decision.</p>
                : <ul className="divide-y divide-line border-t border-line">{open.map((a) => row(a, true))}</ul>}
              {history.length > 0 && (
                <>
                  <div className={cn("px-4 pt-3", open.length > 0 && "border-t border-line")}><SectionLabel right={<span className="t-num text-xs text-ink-3">{history.length}</span>}>History</SectionLabel></div>
                  <ul className="divide-y divide-line border-t border-line">{history.map((a) => row(a, false))}</ul>
                </>
              )}
            </div>
          )}
      </Section>

      <Dialog open={!!notesFor} onOpenChange={(o) => { if (!o && !reject.isPending && !requestInfo.isPending) { setNotesFor(null); setNotes(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{notesTitle}</DialogTitle>
            <DialogDescription>
              {notesFor?.kind === "reject" ? "An optional internal note. It stays on the application and is never shown to the applicant." : "Required. Saved on the application so the next reviewer knows what was missing."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="app-notes" className="text-[13px] text-ink-2">Note</Label>
            <Textarea id="app-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder={notesFor?.kind === "reject" ? "Optional" : "e.g. Portfolio link is broken"} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setNotesFor(null); setNotes(""); }}>Cancel</Button>
            {notesFor?.kind === "reject"
              ? <Button variant="destructive" disabled={reject.isPending} onClick={() => notesFor && reject.mutate({ a: notesFor.app, n: notes })}>{reject.isPending ? "Rejecting…" : "Reject application"}</Button>
              : <Button disabled={!notes.trim() || requestInfo.isPending} onClick={() => notesFor && requestInfo.mutate({ a: notesFor.app, n: notes })}>{requestInfo.isPending ? "Saving…" : "Mark as needs info"}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
