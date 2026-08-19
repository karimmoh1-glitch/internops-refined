import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Check, X, Copy, ExternalLink, ChevronDown, ChevronRight,
  Github, Linkedin, Globe, Loader2, Inbox,
} from "lucide-react";

export interface Application {
  id: string;
  name: string;
  email: string;
  skills: string | null;
  motivation: string | null;
  githubUrl: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  status: string;
  dismissedAt: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  needs_information: "Needs Info",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  under_review: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-white/10 text-white/50 border-white/[0.08]",
  needs_information: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

export function ApplicationRow({ application }: { application: Application }) {
  const [expanded, setExpanded] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["/api/interns"] });
  };

  const approveMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/applications/${application.id}/approve`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Application approved", description: `${application.name} can now log in as an intern.` });
    },
    onError: (error: any) => toast({ title: "Couldn't approve", description: error.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/applications/${application.id}/reject`, { notes: rejectNotes.trim() || undefined }),
    onSuccess: () => {
      invalidate();
      setShowReject(false);
      toast({ title: "Application rejected" });
    },
    onError: (error: any) => toast({ title: "Couldn't reject", description: error.message, variant: "destructive" }),
  });

  const dismissMutation = useMutation({
    mutationFn: async () => apiRequest("POST", `/api/applications/${application.id}/dismiss`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Dismissed", description: "Still visible in Application History." });
    },
    onError: (error: any) => toast({ title: "Couldn't dismiss", description: error.message, variant: "destructive" }),
  });

  const isPending = application.status === "pending" || application.status === "under_review" || application.status === "needs_information";

  return (
    <div className="border border-white/[0.08] rounded-lg" data-testid={`application-${application.id}`}>
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.04] transition-colors rounded-lg">
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? <ChevronDown className="w-4 h-4 text-white/40 shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate" data-testid={`text-applicant-name-${application.id}`}>{application.name}</p>
            <p className="text-xs text-white/50 truncate">{application.email} &middot; {formatDate(application.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`${STATUS_COLORS[application.status]} text-xs font-medium`}>
            {STATUS_LABELS[application.status] || application.status}
          </Badge>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); dismissMutation.mutate(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); dismissMutation.mutate(); } }}
            className="text-white/30 hover:text-white/70 transition-colors p-1 -m-1 rounded"
            title="Dismiss from dashboard"
            data-testid={`button-dismiss-application-${application.id}`}
          >
            <X className="w-4 h-4" />
          </span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/[0.06] pt-3">
          {application.skills && (
            <div><span className="text-xs font-medium text-white/50 uppercase tracking-wide">Skills</span><p className="text-sm text-white/90 mt-0.5">{application.skills}</p></div>
          )}
          {application.motivation && (
            <div><span className="text-xs font-medium text-white/50 uppercase tracking-wide">Why they want to join</span><p className="text-sm text-white/90 mt-0.5">{application.motivation}</p></div>
          )}
          <div className="flex items-center gap-3 flex-wrap">
            {application.githubUrl && (
              <a href={application.githubUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
                <Github className="w-3.5 h-3.5" />GitHub<ExternalLink className="w-3 h-3" />
              </a>
            )}
            {application.linkedinUrl && (
              <a href={application.linkedinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
                <Linkedin className="w-3.5 h-3.5" />LinkedIn<ExternalLink className="w-3 h-3" />
              </a>
            )}
            {application.portfolioUrl && (
              <a href={application.portfolioUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">
                <Globe className="w-3.5 h-3.5" />Portfolio<ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          {isPending && (
            <div className="flex items-center gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                data-testid={`button-approve-application-${application.id}`}
              >
                {approveMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Check className="w-4 h-4 mr-1.5" />}
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowReject(true)}
                className="border-red-500/20 text-red-400 hover:bg-red-500/10"
                data-testid={`button-reject-application-${application.id}`}
              >
                <X className="w-4 h-4 mr-1.5" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {application.name}'s application?</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Optional internal note (not shared with the applicant)..."
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={3}
            data-testid={`input-reject-notes-${application.id}`}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              data-testid={`button-confirm-reject-${application.id}`}
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ApplicationsPanel({ companyId, onViewHistory }: { companyId: string | null; onViewHistory?: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allApplications = [], isLoading } = useQuery<Application[]>({ queryKey: ["/api/applications"] });
  const { data: dashboard } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  // Dismissed applications stay out of this at-a-glance panel to keep it
  // tidy — they're never deleted, just moved to the full history page.
  const applications = allApplications.filter((a) => !a.dismissedAt);
  const dismissedCount = allApplications.length - applications.length;

  const acceptingApplications = dashboard?.company?.acceptingApplications ?? false;
  const companySlug = dashboard?.company?.slug;

  const toggleAcceptingMutation = useMutation({
    mutationFn: async (accepting: boolean) => apiRequest("PUT", "/api/company/accepting-applications", { accepting }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    },
    onError: (error: any) => toast({ title: "Couldn't update setting", description: error.message, variant: "destructive" }),
  });

  const applyLink = companySlug ? `${window.location.origin}/apply/${companySlug}` : "";
  const pendingCount = applications.filter((a) => a.status === "pending" || a.status === "under_review" || a.status === "needs_information").length;

  const copyLink = () => {
    navigator.clipboard.writeText(applyLink);
    toast({ title: "Link copied" });
  };

  return (
    <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm" data-testid="applications-section">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.04] transition-colors rounded-xl"
        data-testid="button-toggle-applications"
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#6D5EF5]" />
          <h2 className="text-lg font-semibold text-white">Applications</h2>
          {pendingCount > 0 && (
            <Badge className="bg-[#6D5EF5] text-white border-none ml-1" data-testid="badge-pending-applications-count">{pendingCount} pending</Badge>
          )}
        </div>
        {expanded ? <ChevronDown className="w-5 h-5 text-white/40" /> : <ChevronRight className="w-5 h-5 text-white/40" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4">
          <div className="bg-background border border-white/[0.06] rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Switch
                checked={acceptingApplications}
                onCheckedChange={(v) => toggleAcceptingMutation.mutate(v)}
                disabled={toggleAcceptingMutation.isPending}
                data-testid="switch-accepting-applications"
              />
              <div>
                <p className="text-sm font-medium text-white/90">Accepting applications</p>
                <p className="text-xs text-white/50">{acceptingApplications ? "Your public application page is live." : "Turn on to open your public application page."}</p>
              </div>
            </div>
            {acceptingApplications && applyLink && (
              <div className="flex items-center gap-2 bg-card border border-white/[0.08] rounded-lg px-3 py-1.5">
                <code className="text-xs text-white/60 max-w-[220px] truncate" data-testid="text-apply-link">{applyLink}</code>
                <button onClick={copyLink} className="text-white/40 hover:text-white/80" data-testid="button-copy-apply-link">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-sm text-white/40 py-6 text-center">Loading applications...</div>
          ) : applications.length === 0 ? (
            <div className="text-center py-8">
              <Inbox className="w-8 h-8 text-white/30 mx-auto mb-2" />
              <p className="text-sm text-white/50">{allApplications.length === 0 ? "No applications yet." : "All caught up — nothing new to review."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {applications.map((app) => <ApplicationRow key={app.id} application={app} />)}
            </div>
          )}

          {onViewHistory && (
            <button
              onClick={onViewHistory}
              className="w-full text-center text-xs text-white/40 hover:text-white/70 transition-colors pt-1"
              data-testid="button-view-application-history"
            >
              View Application History{allApplications.length > 0 ? ` (${allApplications.length})` : ""}{dismissedCount > 0 ? ` · ${dismissedCount} dismissed` : ""} →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
