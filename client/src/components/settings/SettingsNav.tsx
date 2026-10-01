import { Link } from "wouter";
import { ChevronRight, User, Building2, Bell, ShieldCheck, MonitorSmartphone, Eye, SunMoon, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type SectionKey = "profile" | "workspace" | "notifications" | "security" | "companion" | "privacy" | "appearance" | "account";

export interface SectionDef { key: SectionKey; label: string; description: string; icon: typeof User; adminOnly?: boolean }

export const SECTIONS: SectionDef[] = [
  { key: "profile", label: "Profile", description: "Your name, role and public page", icon: User },
  { key: "workspace", label: "Workspace", description: "Applications, GitHub and people", icon: Building2, adminOnly: true },
  { key: "notifications", label: "Notifications", description: "What reaches you, and where", icon: Bell },
  { key: "security", label: "Security", description: "Password, devices and activity", icon: ShieldCheck },
  { key: "companion", label: "Companion", description: "The desktop app for Work Mode", icon: MonitorSmartphone },
  { key: "privacy", label: "Privacy", description: "What Work Mode records", icon: Eye },
  { key: "appearance", label: "Appearance", description: "Light, dark or system", icon: SunMoon },
  { key: "account", label: "Account", description: "Sessions and sign out", icon: LogOut },
];

export function sectionHref(key: SectionKey): string { return `/settings?section=${key}`; }

// Desktop: a compact vertical rail that stays put while the content scrolls.
export function SettingsNav({ sections, active, className }: { sections: SectionDef[]; active: SectionKey; className?: string }) {
  return (
    <nav className={cn("flex flex-col gap-0.5", className)} aria-label="Settings sections">
      {sections.map((s) => {
        const on = s.key === active;
        return (
          <Link key={s.key} href={sectionHref(s.key)} aria-current={on ? "page" : undefined}
            className={cn("group flex h-8 items-center gap-2.5 rounded-md border px-2 text-[13px] font-medium transition-colors",
              on ? "border-line bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "border-transparent text-ink-2 hover:bg-surface/70 hover:text-ink")}>
            <s.icon className={cn("h-4 w-4 shrink-0", on ? "text-accent" : "text-ink-3 group-hover:text-ink-2")} strokeWidth={on ? 2.25 : 2} />
            <span className="truncate">{s.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Mobile: a stacked list that is the first screen of Settings.
export function SettingsList({ sections, className }: { sections: SectionDef[]; className?: string }) {
  return (
    <nav className={cn("panel overflow-hidden divide-y divide-line", className)} aria-label="Settings sections">
      {sections.map((s) => (
        <Link key={s.key} href={sectionHref(s.key)} className="flex items-center gap-3 px-4 py-3 row-hover">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-3"><s.icon className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-medium text-ink">{s.label}</span>
            <span className="block truncate text-[12px] text-ink-3">{s.description}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-4" />
        </Link>
      ))}
    </nav>
  );
}
