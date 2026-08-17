import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Award, GraduationCap } from "lucide-react";

interface AlumniRecord {
  internshipStartedAt: string | null;
  internshipEndedAt: string;
  totalTasksCompleted: number;
  totalTasksAssigned: number;
  skillTagCounts: { tag: string; count: number }[];
  completionBadgeAwarded: boolean;
  finalNarrative: string | null;
}

interface Alumnus {
  id: string;
  name: string;
  email: string;
  alumniAt: string;
  alumniRecord: AlumniRecord;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Unknown";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function AlumniCertificate({ internId }: { internId: string }) {
  const [, setLocation] = useLocation();
  const { data: alumni = [], isLoading } = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });
  const { data: dashboard } = useQuery<any>({ queryKey: ["/api/dashboard"] });
  const companyName = dashboard?.company?.name || "the organization";

  const alumnus = alumni.find((a) => a.id === internId);

  if (isLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-10 text-center text-white/40">Loading...</div>;
  }

  if (!alumnus) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-white/50 font-medium">Alumnus not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => setLocation("/alumni")}>Back to Alumni</Button>
      </div>
    );
  }

  const record = alumnus.alumniRecord;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6" data-print-hide>
          <Button variant="ghost" size="sm" className="-ml-2 text-white/50" onClick={() => setLocation(`/interns/${internId}`)} data-testid="button-back-to-profile">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Profile
          </Button>
          <Button onClick={() => window.print()} data-testid="button-print-certificate">
            <Printer className="w-4 h-4 mr-1.5" />
            Print / Save as PDF
          </Button>
        </div>

        {/* Certificate — deliberately light-background regardless of app
            theme, since it's meant to be printed or handed to someone
            outside the product. */}
        <div className="certificate-print bg-white text-zinc-900 rounded-2xl border border-zinc-200 shadow-2xl p-10 sm:p-14" data-testid="certificate-content">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#6D5EF5]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <GraduationCap className="w-7 h-7 text-[#6D5EF5]" />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">Certificate of Completion</p>
            <h1 className="text-3xl font-bold font-heading text-zinc-900 mt-3" data-testid="text-certificate-name">{alumnus.name}</h1>
            <p className="text-sm text-zinc-500 mt-1">has successfully completed an internship with</p>
            <p className="text-lg font-semibold text-zinc-800 mt-0.5">{companyName}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 py-6 border-y border-zinc-200">
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Internship Period</p>
              <p className="text-sm font-medium text-zinc-800 mt-0.5">
                {formatDate(record.internshipStartedAt)} &ndash; {formatDate(record.internshipEndedAt)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-zinc-500">Tasks Completed</p>
              <p className="text-sm font-medium text-zinc-800 mt-0.5">
                {record.totalTasksCompleted} of {record.totalTasksAssigned} assigned
              </p>
            </div>
          </div>

          {record.skillTagCounts.length > 0 && (
            <div className="py-6 border-b border-zinc-200">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Skills Demonstrated</p>
              <div className="flex flex-wrap gap-2">
                {record.skillTagCounts.map(({ tag, count }) => (
                  <span key={tag} className="text-xs font-medium bg-zinc-100 text-zinc-700 rounded-full px-3 py-1">
                    {tag}{count > 1 ? ` (${count})` : ""}
                  </span>
                ))}
              </div>
            </div>
          )}

          {record.finalNarrative && (
            <div className="py-6 border-b border-zinc-200">
              <p className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Summary of Accomplishments</p>
              <p className="text-sm text-zinc-700 leading-relaxed whitespace-pre-wrap" data-testid="text-certificate-narrative">{record.finalNarrative}</p>
            </div>
          )}

          {record.completionBadgeAwarded && (
            <div className="flex items-center justify-center gap-2 pt-6 text-emerald-600">
              <Award className="w-4 h-4" />
              <span className="text-sm font-semibold">Awarded Completion Badge</span>
            </div>
          )}

          <p className="text-center text-xs text-zinc-400 mt-8">
            Issued {formatDate(alumnus.alumniAt || record.internshipEndedAt)} &middot; {companyName}
          </p>
        </div>
      </div>
    </div>
  );
}
