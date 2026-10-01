import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Mail, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Page, PageHeader } from "@/components/kit";
import { InternsTab } from "@/components/people/interns-tab";
import { ManagersTab } from "@/components/people/managers-tab";
import { ApplicationsTab } from "@/components/people/applications-tab";
import { AlumniTab } from "@/components/people/alumni-tab";
import { InviteDialog } from "@/components/people/invite-dialog";
import { AddInternDialog } from "@/components/people/add-intern-dialog";
import { type Alumnus, type Application, type InternRow, type Manager, isOpenApplication } from "@/components/people/types";

type Tab = "interns" | "managers" | "applications" | "alumni";
const TABS: Tab[] = ["interns", "managers", "applications", "alumni"];

export default function PeoplePage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const tabParam = params.get("tab");
  const tab: Tab = TABS.includes(tabParam as Tab) ? (tabParam as Tab) : "interns";
  const [invite, setInvite] = useState(false);
  const [add, setAdd] = useState(false);

  // `/people?invite=1` (command palette, onboarding) opens the dialog once
  // and drops the flag so a refresh doesn't reopen it.
  useEffect(() => {
    if (params.get("invite") === "1") {
      setInvite(true);
      const next = new URLSearchParams(params); next.delete("invite");
      const qs = next.toString();
      navigate(`/people${qs ? `?${qs}` : ""}`, { replace: true });
    }
  }, [params, navigate]);

  // Lightweight counts for the tab strip. Each tab owns its own full query;
  // these just share the cache.
  const interns = useQuery<InternRow[]>({ queryKey: ["/api/interns"] });
  const managers = useQuery<Manager[]>({ queryKey: ["/api/managers"] });
  const applications = useQuery<Application[]>({ queryKey: ["/api/applications"] });
  const alumni = useQuery<Alumnus[]>({ queryKey: ["/api/alumni"] });
  const alumniIds = new Set((alumni.data ?? []).map((a) => a.id));
  const counts: Record<Tab, number | undefined> = {
    interns: interns.data ? interns.data.filter((i) => !alumniIds.has(i.id)).length : undefined,
    managers: managers.data?.length,
    applications: applications.data ? applications.data.filter(isOpenApplication).length : undefined,
    alumni: alumni.data?.length,
  };
  const labels: Record<Tab, string> = { interns: "Interns", managers: "Managers", applications: "Applications", alumni: "Alumni" };

  return (
    <Page width="wide">
      <PageHeader title="People" description="Everyone in the workspace: who's working, who needs a nudge, and who's waiting to join."
        actions={<>
          <Button variant="outline" size="sm" onClick={() => setInvite(true)}><Mail className="h-4 w-4" />Invite</Button>
          <Button size="sm" onClick={() => setAdd(true)}><UserPlus className="h-4 w-4" />Add intern</Button>
        </>}>
        <nav className="mt-4 -mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="People sections">
          {TABS.map((t) => {
            const active = t === tab;
            const n = counts[t];
            const attention = t === "applications" && (n ?? 0) > 0;
            return (
              <Link key={t} href={t === "interns" ? "/people" : `/people?tab=${t}`} aria-current={active ? "page" : undefined}
                className={cn("-mb-px inline-flex h-9 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium transition-colors", active ? "border-accent text-ink" : "border-transparent text-ink-3 hover:text-ink")}>
                {labels[t]}
                {n !== undefined && <span className={cn("t-num rounded-full px-1.5 min-w-[18px] h-[18px] text-[10.5px] font-semibold inline-flex items-center justify-center", attention ? "bg-warn-soft text-warn" : "bg-surface-2 text-ink-3")}>{n}</span>}
              </Link>
            );
          })}
        </nav>
      </PageHeader>

      <div key={tab} className="anim-fade pt-5">
        {tab === "interns" && <InternsTab onInvite={() => setInvite(true)} onAdd={() => setAdd(true)} />}
        {tab === "managers" && <ManagersTab />}
        {tab === "applications" && <ApplicationsTab />}
        {tab === "alumni" && <AlumniTab />}
      </div>

      <InviteDialog open={invite} onOpenChange={setInvite} />
      <AddInternDialog open={add} onOpenChange={setAdd} />
    </Page>
  );
}
