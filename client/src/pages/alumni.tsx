import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Search, Award, CheckCircle2, Printer } from "lucide-react";
import { SimplePageSkeleton } from "@/components/dashboard-skeleton";

interface AlumniRecord {
  internshipStartedAt: string | null;
  internshipEndedAt: string;
  totalTasksCompleted: number;
  totalTasksAssigned: number;
  skillTagCounts: { tag: string; count: number }[];
  completionBadgeAwarded: boolean;
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
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Alumni() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const { data: alumni = [], isLoading } = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return alumni;
    return alumni.filter((a) =>
      a.name.toLowerCase().includes(q) ||
      a.alumniRecord.skillTagCounts.some((s) => s.tag.toLowerCase().includes(q))
    );
  }, [alumni, search]);

  if (isLoading) {
    return <SimplePageSkeleton rows={4} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2" data-testid="text-alumni-title">
              <GraduationCap className="w-6 h-6 text-white/60" />
              Alumni
            </h1>
            <p className="text-white/50 text-sm mt-1">Interns whose internship has formally ended</p>
          </div>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or skill..."
              className="pl-9"
              data-testid="input-search-alumni"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/[0.08] rounded-xl bg-card">
            <GraduationCap className="w-8 h-8 text-white/30 mx-auto mb-2" />
            <p className="text-white/50 font-medium">{alumni.length === 0 ? "No alumni yet" : "No matches"}</p>
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-white/[0.08] shadow-sm divide-y divide-white/[0.06]">
            {filtered.map((a) => (
              <div
                key={a.id}
                role="button"
                tabIndex={0}
                onClick={() => setLocation(`/interns/${a.id}`)}
                onKeyDown={(e) => { if (e.key === "Enter") setLocation(`/interns/${a.id}`); }}
                className="w-full text-left p-4 flex items-center gap-4 hover:bg-white/[0.03] transition-colors cursor-pointer"
                data-testid={`row-alumnus-${a.id}`}
              >
                <div className="w-10 h-10 bg-[#6D5EF5]/15 rounded-full flex items-center justify-center text-[#6D5EF5] font-semibold shrink-0">
                  {a.name[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white truncate">{a.name}</span>
                    {a.alumniRecord.completionBadgeAwarded && (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1">
                        <Award className="w-3 h-3" />
                        Completed
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/40 mt-0.5">
                    {formatDate(a.alumniRecord.internshipStartedAt)} — {formatDate(a.alumniRecord.internshipEndedAt)}
                  </p>
                  {a.alumniRecord.skillTagCounts.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {a.alumniRecord.skillTagCounts.slice(0, 5).map(({ tag }) => (
                        <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-white/60 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {a.alumniRecord.totalTasksCompleted}/{a.alumniRecord.totalTasksAssigned} tasks
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setLocation(`/alumni/${a.id}/certificate`); }}
                  className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
                  title="View certificate"
                  data-testid={`button-certificate-${a.id}`}
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
