import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// The three free-text transitions: submit (intern), block (intern),
// review (admin: approve with optional feedback, or request changes with
// required feedback). Each explains what happens next.
export function SubmitDialog({ open, onOpenChange, onSubmit, pending, previousFeedback, resubmission }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (text: string) => void; pending: boolean; previousFeedback?: string | null; resubmission?: boolean }) {
  const [text, setText] = useState("");
  const [blockers, setBlockers] = useState("");
  const compose = () => (blockers.trim() ? `${text.trim()}\n\nOpen questions / blockers:\n${blockers.trim()}` : text.trim());
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{resubmission ? "Resubmit for review" : "Submit for review"}</DialogTitle>
          <DialogDescription>Your manager will see this with the task's history and any Work Mode evidence linked to it.</DialogDescription>
        </DialogHeader>
        {previousFeedback && <div className="rounded-md border border-warn/25 bg-warn-soft/60 p-3 text-[13px]"><div className="t-label mb-1">Changes requested last time</div><p className="text-ink-2">“{previousFeedback}”</p></div>}
        <div>
          <Label htmlFor="submit-text">What did you complete?</Label>
          <Textarea id="submit-text" autoFocus value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder="What changed, where it lives (links, branches, files), and how you checked it." className="mt-1.5" maxLength={10000} />
        </div>
        <div>
          <Label htmlFor="submit-blockers">Open questions or blockers <span className="text-ink-4 font-normal">(optional)</span></Label>
          <Textarea id="submit-blockers" value={blockers} onChange={(e) => setBlockers(e.target.value)} rows={2} placeholder="Anything you couldn't resolve or need a decision on." className="mt-1.5" />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          <Button onClick={() => onSubmit(compose())} disabled={pending || !text.trim()}>{pending ? "Submitting…" : "Submit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BlockDialog({ open, onOpenChange, onBlock, pending }: { open: boolean; onOpenChange: (o: boolean) => void; onBlock: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mark as blocked</DialogTitle><DialogDescription>Say what you're waiting on. Your manager is notified and the task shows as blocked until you unblock it.</DialogDescription></DialogHeader>
        <div><Label htmlFor="block-reason">What's blocking you?</Label><Textarea id="block-reason" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="e.g. Waiting on API credentials from Sam." className="mt-1.5" maxLength={2000} /></div>
        <DialogFooter><Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button><Button variant="destructive" onClick={() => onBlock(reason.trim())} disabled={pending || !reason.trim()}>{pending ? "Saving…" : "Mark blocked"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewDialog({ open, onOpenChange, mode, onApprove, onRequestChanges, pending, submission }: { open: boolean; onOpenChange: (o: boolean) => void; mode: "approve" | "changes"; onApprove: (feedback: string) => void; onRequestChanges: (feedback: string) => void; pending: boolean; submission?: string | null }) {
  const [feedback, setFeedback] = useState("");
  const approving = mode === "approve";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{approving ? "Approve this submission" : "Request changes"}</DialogTitle>
          <DialogDescription>{approving ? "The task is marked approved and the intern is notified. Feedback is optional." : "The task goes back to in progress with your feedback attached. The intern resubmits when ready."}</DialogDescription>
        </DialogHeader>
        {submission && <div className="rounded-md border border-line bg-surface-2 p-3 text-[13px] max-h-40 overflow-y-auto scroll-thin"><div className="t-label mb-1">Submission</div><p className="whitespace-pre-wrap text-ink-2">{submission}</p></div>}
        <div><Label htmlFor="review-feedback">Feedback{!approving && <span className="text-danger"> *</span>}</Label><Textarea id="review-feedback" autoFocus value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={4} placeholder={approving ? "Nice work on… (optional)" : "Be specific about what should change and why."} className="mt-1.5" maxLength={4000} /></div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
          {approving ? <Button onClick={() => onApprove(feedback.trim())} disabled={pending}>{pending ? "Approving…" : "Approve"}</Button> : <Button variant="destructive" onClick={() => onRequestChanges(feedback.trim())} disabled={pending || !feedback.trim()}>{pending ? "Sending…" : "Request changes"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
