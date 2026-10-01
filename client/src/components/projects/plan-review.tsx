import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, MessageSquare, RotateCcw } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Section, SkeletonRows, ErrorState, ConfirmDialog } from "@/components/kit";
import { invalidateProject } from "./dialogs";
import { PlanSummary, PlanDisplay, PlanCommentList, usePlanComments } from "./plan";
import { PROJECT_KEYS, type PlanVersion, type ProjectDetail } from "./types";

// Admin review surface for one plan version. Approve takes an optional
// note; request-revision REQUIRES one (the server rejects it otherwise and
// the intern needs to know what to change); add-comment just leaves a note
// without changing state. All three are the legacy PlanReviewCard calls.
export function PlanReviewCard({ project, version }: { project: ProjectDetail; version: PlanVersion }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [comment, setComment] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const comments = usePlanComments(version.id);
  const reviewable = version.status === "submitted";

  const done = (title: string, description?: string) => {
    void qc.invalidateQueries({ queryKey: PROJECT_KEYS.planComments(version.id) });
    invalidateProject(qc, project.id);
    setComment("");
    toast({ title, description });
  };
  const fail = (title: string) => (e: Error) => toast({ title, description: e.message, variant: "destructive" });

  const approve = useMutation({
    mutationFn: () => api("POST", `/api/plan-versions/${version.id}/approve`, { comment: comment.trim() || undefined }),
    onSuccess: () => { setConfirmApprove(false); done(`Plan v${version.versionNumber} approved`, "The project is now in execution. The intern can start logging work."); },
    onError: fail("Couldn't approve plan"),
  });
  const revise = useMutation({
    mutationFn: () => api("POST", `/api/plan-versions/${version.id}/request-revision`, { comment: comment.trim() }),
    onSuccess: () => done("Revision requested", `A new draft v${version.versionNumber + 1} was opened for the intern with your note attached.`),
    onError: fail("Couldn't request revision"),
  });
  const note = useMutation({
    mutationFn: () => api("POST", `/api/plan-versions/${version.id}/comments`, { content: comment.trim() }),
    onSuccess: () => done("Comment added", "The intern sees it in their Plan tab."),
    onError: fail("Couldn't add comment"),
  });
  const busy = approve.isPending || revise.isPending || note.isPending;

  return (
    <div className="space-y-4">
      <PlanSummary plan={version.contentJson} minimumHours={project.minimumTotalHours} version={version} />
      <Section title="Weekly plan" description={`Submitted by ${project.internName}`}>
        <PlanDisplay plan={version.contentJson} />
      </Section>
      <Section title="Feedback" description={reviewable ? "Approve, or send it back with a note." : "This version isn't awaiting review. You can still leave a note."} id="review">
        <div className="space-y-4">
          {comments.isLoading ? <SkeletonRows rows={2} /> : comments.error ? <ErrorState compact message={(comments.error as Error).message} onRetry={() => comments.refetch()} /> : <PlanCommentList comments={comments.data ?? []} />}
          <div className="space-y-1.5">
            <Label htmlFor="review-comment" className="text-[13px] text-ink-2">Your note {reviewable && <span className="text-ink-3 font-normal">· required to request a revision</span>}</Label>
            <Textarea id="review-comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Week 3 is overloaded — move the integration work to week 4 and add a buffer day." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {reviewable && (
              <>
                <Button onClick={() => setConfirmApprove(true)} disabled={busy}><CheckCircle2 className="h-4 w-4" />Approve plan</Button>
                <Button variant="outline" onClick={() => revise.mutate()} disabled={busy || !comment.trim()} title={!comment.trim() ? "Write what should change first" : undefined}><RotateCcw className="h-4 w-4" />{revise.isPending ? "Sending…" : "Request revision"}</Button>
              </>
            )}
            <Button variant="ghost" onClick={() => note.mutate()} disabled={busy || !comment.trim()} className={reviewable ? "sm:ml-auto" : undefined}><MessageSquare className="h-4 w-4" />{note.isPending ? "Adding…" : "Add comment only"}</Button>
          </div>
        </div>
      </Section>
      <ConfirmDialog
        open={confirmApprove}
        onOpenChange={setConfirmApprove}
        title={`Approve plan v${version.versionNumber}?`}
        description={<>The project moves to execution and {project.internName} starts logging against these weeks.{comment.trim() ? " Your note is attached as a comment." : ""}</>}
        confirmLabel="Approve"
        pending={approve.isPending}
        onConfirm={() => approve.mutate()}
      />
    </div>
  );
}
