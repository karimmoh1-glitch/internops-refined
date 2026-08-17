import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Lightbulb, Check, X, ChevronDown, ChevronRight, Loader2, Inbox,
} from "lucide-react";

interface Project {
  id: string;
  internId: string;
  title: string;
  idea: string;
  minimumTotalHours: number;
  status: string;
  createdAt: string;
}

interface Intern {
  id: string;
  name: string;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function ProposalRow({ proposal, internName }: { proposal: Project; internName: string }) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
  };

  const approveMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/projects/${proposal.id}/approve-proposal`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Project approved", description: `"${proposal.title}" is now active.` });
    },
    onError: (error: any) => toast({ title: "Couldn't approve", description: error.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/projects/${proposal.id}/reject-proposal`, { reason: rejectReason.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      setShowReject(false);
      toast({ title: "Proposal rejected" });
    },
    onError: (error: any) => toast({ title: "Couldn't reject", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="border border-white/[0.08] rounded-lg" data-testid={`proposal-${proposal.id}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.04] transition-colors rounded-lg">
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate" data-testid={`text-proposal-title-${proposal.id}`}>{proposal.title}</p>
            <p className="text-xs text-white/50 truncate">{internName} &middot; {formatDate(proposal.createdAt)}</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs font-medium shrink-0">
          Pending
        </Badge>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          <div>
            <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Idea</span>
            <p className="text-sm text-white/90 mt-0.5 whitespace-pre-wrap">{proposal.idea}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-white/50 uppercase tracking-wide">Minimum hours</span>
            <p className="text-sm text-white/90 mt-0.5">{proposal.minimumTotalHours}</p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid={`button-approve-proposal-${proposal.id}`}
            >
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowReject(true)}
              className="border-red-500/20 text-red-400 hover:bg-red-500/10"
              data-testid={`button-reject-proposal-${proposal.id}`}
            >
              <X className="w-4 h-4 mr-1.5" />
              Reject
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject "{proposal.title}"?</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Optional reason (shared with the intern)..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            data-testid={`input-reject-proposal-reason-${proposal.id}`}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              data-testid={`button-confirm-reject-proposal-${proposal.id}`}
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Reject Proposal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ProjectProposalsPanel() {
  const [expanded, setExpanded] = useState(true);
  const { data: projects = [], isLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: interns = [] } = useQuery<Intern[]>({ queryKey: ["/api/interns"] });

  const internNameById = new Map(interns.map((i) => [i.id, i.name]));
  const proposals = projects.filter((p) => p.status === "pending_approval");

  if (!isLoading && proposals.length === 0) return null;

  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm" data-testid="project-proposals-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.04] transition-colors rounded-xl"
        data-testid="button-toggle-proposals"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-[#6D5EF5]" />
          <h2 className="text-lg font-semibold text-white">Project Proposals</h2>
          {proposals.length > 0 && (
            <Badge className="bg-[#6D5EF5] text-white border-none ml-1" data-testid="badge-pending-proposals-count">{proposals.length} pending</Badge>
          )}
        </div>
        {expanded ? <ChevronDown className="w-5 h-5 text-white/40" /> : <ChevronRight className="w-5 h-5 text-white/40" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-2">
          {isLoading ? (
            <div className="text-sm text-white/40 py-6 text-center">Loading proposals...</div>
          ) : (
            proposals.map((p) => <ProposalRow key={p.id} proposal={p} internName={internNameById.get(p.internId) || "Unknown"} />)
          )}
        </div>
      )}
    </div>
  );
}
