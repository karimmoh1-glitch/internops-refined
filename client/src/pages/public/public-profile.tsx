import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Award, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { SkillCount } from "@shared/skills";
import { Button } from "@/components/ui/button";
import { Avatar, Pill, Skeleton, EmptyState } from "@/components/kit";
import { PublicShell } from "@/components/public/PublicShell";

interface PublicProfile {
  name: string;
  completionBadge: boolean;
  memberSince: number | null;
  completedTasks: { title: string; completedAt: string | null }[];
  skillTags: SkillCount[];
}

export default function PublicProfilePage({ slug }: { slug: string }) {
  const profile = useQuery<PublicProfile>({
    queryKey: ["public-intern", slug],
    queryFn: () => api<PublicProfile>("GET", `/api/public/interns/${encodeURIComponent(slug)}`),
    retry: false,
  });

  if (profile.isLoading) {
    return (
      <PublicShell width="narrow">
        <div className="pt-10 md:pt-14 space-y-4" aria-busy aria-label="Loading profile">
          <div className="panel p-5 flex items-center gap-4">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3.5 w-28" /></div>
          </div>
          <div className="panel p-5 space-y-3"><Skeleton className="h-3.5 w-16" /><div className="flex gap-2"><Skeleton className="h-5 w-16" /><Skeleton className="h-5 w-20" /><Skeleton className="h-5 w-14" /></div></div>
          <div className="panel p-5 space-y-3"><Skeleton className="h-3.5 w-28" />{[0, 1, 2].map((i) => <Skeleton key={i} className="h-4 w-full" />)}</div>
        </div>
      </PublicShell>
    );
  }

  if (profile.error || !profile.data) {
    return (
      <PublicShell width="narrow">
        <div className="pt-10 md:pt-14">
          <div className="panel">
            <EmptyState
              title="This profile isn't available"
              description={(profile.error as Error)?.message || "It may have been turned off, or the link is wrong."}
              action={<Button asChild variant="outline" size="sm"><Link href="/">Go to InternOps</Link></Button>}
            />
          </div>
        </div>
      </PublicShell>
    );
  }

  const p = profile.data;

  return (
    <PublicShell width="narrow">
      <div className="pt-10 md:pt-14 space-y-4 anim-stagger">
        <header className="panel p-5 flex flex-wrap items-center gap-4">
          <Avatar name={p.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="t-page truncate">{p.name}</h1>
              {p.completionBadge && <Pill tone="ok" icon={<Award className="h-3 w-3" />}>Completed internship</Pill>}
            </div>
            <p className="mt-0.5 text-[13px] text-ink-3">
              {p.memberSince ? <>On InternOps since <span className="t-num">{p.memberSince}</span></> : "On InternOps"}
            </p>
          </div>
        </header>

        {p.skillTags.length > 0 && (
          <section className="panel p-5" aria-labelledby="skills">
            <h2 id="skills" className="t-label mb-3">Skills from approved work</h2>
            <ul className="flex flex-wrap gap-1.5">
              {p.skillTags.map(({ tag, count }) => (
                <li key={tag}>
                  <Pill tone="neutral">{tag}<span className="t-num text-ink-3">{count}</span></Pill>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel" aria-labelledby="work">
          <div className="flex items-center justify-between gap-3 px-5 py-3 hairline-b">
            <h2 id="work" className="t-section">Approved work</h2>
            <span className="t-num text-xs text-ink-3">{p.completedTasks.length}</span>
          </div>
          {p.completedTasks.length === 0 ? (
            <EmptyState compact title="No approved tasks yet" description="Tasks appear here once a manager approves them." />
          ) : (
            <ol className="divide-y divide-line">
              {p.completedTasks.map((t, i) => (
                <li key={i} className="flex items-start justify-between gap-3 px-5 py-2.5">
                  <span className="flex min-w-0 items-start gap-2 text-[13px] text-ink">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />
                    <span className="min-w-0 break-words">{t.title}</span>
                  </span>
                  {t.completedAt && <time dateTime={new Date(t.completedAt).toISOString()} className="t-num shrink-0 text-xs text-ink-3">{formatDate(t.completedAt, { month: "short", day: "numeric", year: "numeric" })}</time>}
                </li>
              ))}
            </ol>
          )}
        </section>

        <p className="text-xs text-ink-3">
          This page is shared by {p.name} and shows only approved tasks and their skill tags.
        </p>
      </div>
    </PublicShell>
  );
}
