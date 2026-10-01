import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Award, FileBadge, GraduationCap, RotateCcw, Search } from "lucide-react";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, ErrorState, Pill, Section, SkeletonRows } from "@/components/kit";
import { ActionConfirm, type PendingAction } from "./confirm";
import { useInternActions } from "./use-intern-actions";
import type { Alumnus } from "./types";

export function AlumniTab() {
  const alumni = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });
  const { reactivateAlumnus } = useInternActions();
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const all = alumni.data ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return all;
    return all.filter((a) => a.name.toLowerCase().includes(s) || a.email.toLowerCase().includes(s) || a.alumniRecord.skillTagCounts.some((t) => t.tag.toLowerCase().includes(s)));
  }, [alumni.data, q]);

  return (
    <Section title="Alumni" description="Interns whose internship has formally ended. Their record is a snapshot taken at that moment." flush
      actions={(alumni.data?.length ?? 0) > 0 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or skill" className="h-8 w-44 pl-8 text-[13px]" aria-label="Search alumni" />
        </div>
      )}>
      {alumni.isLoading ? <div className="p-4"><SkeletonRows rows={3} /></div> :
        alumni.error ? <ErrorState compact message={(alumni.error as Error).message} onRetry={() => void alumni.refetch()} /> :
        (alumni.data ?? []).length === 0 ? (
          <EmptyState compact icon={<GraduationCap />} title="No alumni yet"
            description="When an internship ends, open the intern's profile and choose “Transition to alumni”. Their stats, skills, and narrative are frozen into a record and a certificate." />
        ) : list.length === 0 ? (
          <EmptyState compact title="No matches" description={`Nothing matches “${q.trim()}”.`} action={<Button variant="outline" size="sm" onClick={() => setQ("")}>Clear search</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((a) => {
              const r = a.alumniRecord;
              return (
                <li key={a.id} className="relative flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3 row-hover">
                  <Avatar name={a.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/people/${a.id}`} className="truncate text-[13.5px] font-medium text-ink hover:underline underline-offset-2 before:absolute before:inset-0">{a.name}</Link>
                      {r.completionBadgeAwarded && <Pill tone="ok" icon={<Award className="h-3 w-3" />}>Completion badge</Pill>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-3">
                      {r.internshipStartedAt ? formatDate(r.internshipStartedAt, { month: "short", day: "numeric", year: "numeric" }) : "Start unknown"} – {formatDate(r.internshipEndedAt, { month: "short", day: "numeric", year: "numeric" })}
                      <span className="mx-1.5 text-ink-4">·</span>
                      <span className="t-num">{r.totalTasksCompleted}/{r.totalTasksAssigned}</span> tasks completed
                    </p>
                    {r.skillTagCounts.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {r.skillTagCounts.slice(0, 5).map((s) => <Pill key={s.tag} tone="neutral">{s.tag}</Pill>)}
                        {r.skillTagCounts.length > 5 && <span className="text-[11px] text-ink-3">+{r.skillTagCounts.length - 5}</span>}
                      </div>
                    )}
                  </div>
                  <div className="relative z-10 flex items-center gap-1">
                    <Button asChild variant="ghost" size="sm"><Link href={`/alumni/${a.id}/certificate`}><FileBadge className="h-3.5 w-3.5" />Certificate</Link></Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm({
                      title: `Reopen ${a.name}'s internship?`,
                      description: "They can sign in again as an active intern. The alumni record stays on file.",
                      confirmLabel: "Reactivate",
                      run: () => reactivateAlumnus.mutateAsync({ id: a.id, name: a.name }),
                    })}><RotateCcw className="h-3.5 w-3.5" />Reactivate</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      <ActionConfirm action={confirm} onClose={() => setConfirm(null)} />
    </Section>
  );
}
