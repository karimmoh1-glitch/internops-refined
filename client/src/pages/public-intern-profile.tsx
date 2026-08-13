import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { parseErrorMessage } from "@/lib/api-error";
import { aggregateSkillTags } from "@shared/skills";
import { Loader2, Award, Sparkles, CheckCircle2 } from "lucide-react";
import LogoMark from "@/components/logo-mark";

interface PublicProfile {
  name: string;
  completionBadge: boolean;
  memberSince: number | null;
  completedTasks: { title: string; completedAt: string | null }[];
  skillTags: ReturnType<typeof aggregateSkillTags>;
}

interface PublicInternProfileProps {
  slug: string;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PublicInternProfile({ slug }: PublicInternProfileProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/interns/${slug}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await parseErrorMessage(res, "This profile isn't available"));
        return res.json();
      })
      .then(setProfile)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0A09] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#0B0A09] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-white/50 font-medium">{error || "This profile isn't available"}</p>
          <Link href="/" className="text-sm text-[#6D5EF5] mt-3 inline-block">Go to InternOps</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A09]">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <Link href="/" className="flex items-center gap-2 mb-8 w-fit" data-testid="link-home">
          <LogoMark size={28} />
          <span className="font-heading font-semibold text-white">InternOps</span>
        </Link>

        <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#6D5EF5]/15 rounded-full flex items-center justify-center text-[#6D5EF5] font-semibold text-2xl shrink-0">
              {profile.name[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2" data-testid="text-public-profile-name">
                {profile.name}
                {profile.completionBadge && (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1" data-testid="badge-completion">
                    <Award className="w-3 h-3" />
                    Completed
                  </Badge>
                )}
              </h1>
              {profile.memberSince && (
                <p className="text-sm text-white/50">On InternOps since {profile.memberSince}</p>
              )}
            </div>
          </div>
        </div>

        {profile.skillTags.length > 0 && (
          <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white/60" />
              Skills
            </h2>
            <div className="flex flex-wrap gap-2" data-testid="section-public-skills">
              {profile.skillTags.map(({ tag, count }) => (
                <Badge key={tag} variant="secondary" data-testid={`badge-public-skill-${tag}`}>
                  {tag} · {count}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#141110] rounded-xl border border-white/[0.08] shadow-sm p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-white/60" />
            Completed Work
          </h2>
          {profile.completedTasks.length === 0 ? (
            <p className="text-sm text-white/40">No completed tasks yet.</p>
          ) : (
            <ul className="space-y-3" data-testid="list-public-completed-tasks">
              {profile.completedTasks.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3 text-sm" data-testid={`row-public-task-${i}`}>
                  <span className="text-white/90">{t.title}</span>
                  <span className="text-white/40 shrink-0">{formatDate(t.completedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
