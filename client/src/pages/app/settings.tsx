import { useEffect, type ComponentType } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Page, PageHeader } from "@/components/kit";
import { SECTIONS, type SectionKey, SettingsList, SettingsNav } from "@/components/settings/SettingsNav";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { WorkspaceSection } from "@/components/settings/WorkspaceSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { CompanionSection } from "@/components/settings/CompanionSection";
import { PrivacySection } from "@/components/settings/PrivacySection";
import { AppearanceSection } from "@/components/settings/AppearanceSection";
import { AccountSection } from "@/components/settings/AccountSection";

const CONTENT: Record<SectionKey, ComponentType> = {
  profile: ProfileSection,
  workspace: WorkspaceSection,
  notifications: NotificationsSection,
  security: SecuritySection,
  companion: CompanionSection,
  privacy: PrivacySection,
  appearance: AppearanceSection,
  account: AccountSection,
};

// /settings                 → desktop: Profile; mobile: the section list
// /settings?section=<key>   → that section (mobile gets a back link)
export default function SettingsPage() {
  const { user } = useAuth();
  const search = useSearch();
  const [, setLocation] = useLocation();

  const sections = SECTIONS.filter((s) => !s.adminOnly || user?.role === "admin");
  const param = new URLSearchParams(search).get("section");
  const requested = sections.find((s) => s.key === param) ?? null;
  const active: SectionKey = requested?.key ?? "profile";
  const explicit = requested !== null;

  // An unknown or unauthorised section (an intern opening ?section=workspace)
  // falls back to Profile rather than a dead page.
  useEffect(() => {
    if (param && !requested) setLocation("/settings?section=profile", { replace: true });
  }, [param, requested, setLocation]);

  useEffect(() => { window.scrollTo({ top: 0 }); }, [active]);

  if (!user) return null;
  const Content = CONTENT[active];
  const current = sections.find((s) => s.key === active)!;

  return (
    <Page>
      <PageHeader title="Settings" description="Your profile, security, the Companion, and how InternOps looks." className={cn(explicit && "max-md:hidden")} />

      <div className="md:grid md:grid-cols-[200px_minmax(0,1fr)] md:gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Desktop rail */}
        <SettingsNav sections={sections} active={active} className="hidden md:flex md:sticky md:top-20 md:self-start" />

        {/* Mobile list — the first screen of Settings on a phone */}
        <SettingsList sections={sections} className={cn("md:hidden", explicit && "hidden")} />

        <div className={cn("min-w-0", !explicit && "max-md:hidden")}>
          <div className="mb-4 flex items-center gap-1 md:hidden">
            <Link href="/settings" className="inline-flex h-8 items-center gap-1.5 rounded-md pr-2 text-[13px] font-medium text-ink-2 hover:text-ink">
              <ArrowLeft className="h-4 w-4" />Settings
            </Link>
            <span className="text-ink-4">/</span>
            <span className="text-[13px] text-ink-3">{current.label}</span>
          </div>
          <div key={active} className="anim-fade-up pt-1 md:pt-0">
            <Content />
          </div>
        </div>
      </div>
    </Page>
  );
}
