import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, Printer } from "lucide-react";
import LogoMark from "@/components/logo-mark";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Page, Skeleton } from "@/components/kit";
import type { Alumnus, Dashboard } from "@/components/people/types";

const longDate = (d: string | null | undefined) => (d ? formatDate(d, { month: "long", day: "numeric", year: "numeric" }) : "Unknown");

// Printable certificate built only from the alumni record snapshot. In
// print the app chrome is hidden (data-print-hide in the shell) and the
// certificate forces a light sheet regardless of the chosen theme.
export default function CertificatePage({ id }: { id: string }) {
  const alumni = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });
  const dashboard = useQuery<Dashboard>({ queryKey: ["/api/dashboard"] });
  const alumnus = alumni.data?.find((a) => a.id === id);
  const company = dashboard.data?.company?.name ?? "the organization";

  return (
    <Page width="narrow" className="print:max-w-none print:px-0">
      <style>{`
        @media print {
          @page { margin: 14mm; }
          :root { color-scheme: light; }
          [data-print-root] { position: absolute; left: 0; top: 0; width: 100%; padding: 0; margin: 0; }
          [data-cert] { background: white; color: black; border: none; box-shadow: none; border-radius: 0; }
          [data-cert] * { color: inherit; }
          [data-cert-muted] { color: rgb(90 90 90); }
          [data-cert-rule] { border-color: rgb(200 200 200); }
          [data-cert-chip] { background: rgb(240 240 240); color: black; }
        }
      `}</style>

      <div data-print-root>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-6 md:pt-8 pb-5" data-print-hide>
          <Button asChild variant="ghost" size="sm" className="-ml-2"><Link href={alumnus ? `/people/${id}` : "/people?tab=alumni"}><ArrowLeft className="h-4 w-4" />{alumnus ? "Back to profile" : "Back to alumni"}</Link></Button>
          {alumnus && <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" />Print or save as PDF</Button>}
        </div>

        {alumni.isLoading ? (
          <div className="panel p-10 space-y-6" aria-busy>
            <div className="flex flex-col items-center gap-3"><Skeleton className="h-12 w-12 rounded-full" /><Skeleton className="h-3 w-40" /><Skeleton className="h-8 w-64" /><Skeleton className="h-3 w-52" /></div>
            <Skeleton className="h-16" /><Skeleton className="h-24" />
          </div>
        ) : alumni.error ? (
          <ErrorState message={(alumni.error as Error).message} onRetry={() => void alumni.refetch()} />
        ) : !alumnus ? (
          <EmptyState title="No alumni record for this person" description="Certificates exist only for interns whose internship was transitioned to alumni. Active interns don't have one yet."
            action={<Button asChild variant="outline" size="sm"><Link href={`/people/${id}`}>Open profile</Link></Button>} />
        ) : (() => {
          const r = alumnus.alumniRecord;
          return (
            <article data-cert className="panel lift px-8 py-10 sm:px-14 sm:py-14" aria-label={`Certificate of completion for ${alumnus.name}`}>
              <header className="text-center">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center"><LogoMark size={40} /></div>
                <p data-cert-muted className="t-label tracking-[0.2em]">Certificate of Completion</p>
                <h1 className="t-serif mt-4 text-4xl text-ink sm:text-5xl">{alumnus.name}</h1>
                <p data-cert-muted className="mt-3 text-[13px] text-ink-3">has completed an internship with</p>
                <p className="mt-1 text-lg font-semibold text-ink">{company}</p>
              </header>

              <dl data-cert-rule className="mt-10 grid gap-6 border-y border-line py-6 sm:grid-cols-2">
                <div>
                  <dt data-cert-muted className="t-label">Internship period</dt>
                  <dd className="mt-1 text-[13.5px] font-medium text-ink">{r.internshipStartedAt ? longDate(r.internshipStartedAt) : "Start date not recorded"} – {longDate(r.internshipEndedAt)}</dd>
                </div>
                <div>
                  <dt data-cert-muted className="t-label">Tasks completed</dt>
                  <dd className="mt-1 text-[13.5px] font-medium text-ink"><span className="t-num">{r.totalTasksCompleted}</span> of <span className="t-num">{r.totalTasksAssigned}</span> assigned</dd>
                </div>
              </dl>

              {r.skillTagCounts.length > 0 && (
                <section data-cert-rule className="border-b border-line py-6">
                  <h2 data-cert-muted className="t-label mb-2.5">Skills demonstrated</h2>
                  <ul className="flex flex-wrap gap-1.5">
                    {r.skillTagCounts.map((s) => <li key={s.tag} data-cert-chip className="rounded-sm border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink">{s.tag}{s.count > 1 && <span data-cert-muted className="t-num ml-1 text-ink-3">×{s.count}</span>}</li>)}
                  </ul>
                </section>
              )}

              {r.finalNarrative && (
                <section data-cert-rule className="border-b border-line py-6">
                  <h2 data-cert-muted className="t-label mb-2.5">Summary of work</h2>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink-2">{r.finalNarrative}</p>
                </section>
              )}

              {r.completionBadgeAwarded && (
                <p className="mt-6 flex items-center justify-center gap-2 text-[13px] font-semibold text-ok"><Award className="h-4 w-4" />Completion badge awarded</p>
              )}

              <footer data-cert-muted className="mt-8 text-center text-xs text-ink-3">
                Issued {longDate(alumnus.alumniAt || r.internshipEndedAt)} · {company} · Generated by InternOps from the internship record
              </footer>
            </article>
          );
        })()}
      </div>
    </Page>
  );
}
