import { Link } from "wouter";
import { Download, MonitorDot, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/kit";
import { Group, Row, SectionHeader } from "./primitives";
import { DeviceRow, DevicesSkeleton, isCompanionDevice, isUnrecognisedDevice, useDevices } from "./devices";
import { sectionHref } from "./SettingsNav";

export function CompanionSection() {
  const devices = useDevices();
  const companions = devices.active.filter(isCompanionDevice);
  const unrecognised = devices.active.filter(isUnrecognisedDevice);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Companion"
        description="A small desktop app that runs alongside Work Mode so your shift replay reflects what was actually in front of you."
        actions={<Button asChild size="sm"><Link href="/download"><Download className="h-3.5 w-3.5" />Get the Companion</Link></Button>}
      />

      <Group title="What it does" description="The Companion observes, it never acts. It sends a few fields a minute while Work Mode is on, and nothing when it's off.">
        <ul className="space-y-2 px-4 py-3">
          {[
            "Notes which app and document are in front, and whether you're idle.",
            "Only while Work Mode is on. Ending a shift stops it immediately.",
            "Shows up in your replay as observed activity — never as a judgement about what you worked on.",
            "Signs in with your normal account and appears below as a device you can sign out at any time.",
          ].map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[13px] text-ink-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-work" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <Row label="Exactly what gets recorded" description="The full list, including what is never collected." control={<Button asChild variant="ghost" size="sm"><Link href={sectionHref("privacy")}>Privacy<ArrowRight className="h-3.5 w-3.5" /></Link></Button>} />
      </Group>

      <Group title="Your Companion" description="Companion sign-ins on this account.">
        {devices.isLoading ? (
          <DevicesSkeleton rows={1} />
        ) : devices.error ? (
          <ErrorState compact message={(devices.error as Error).message} onRetry={() => devices.refetch()} />
        ) : companions.length === 0 ? (
          <EmptyState
            compact
            icon={<MonitorDot />}
            title="No Companion connected yet"
            description="Install it, sign in with this account and start Work Mode. It appears here on its first check-in."
            action={<Button asChild variant="outline" size="sm"><Link href="/download"><Download className="h-3.5 w-3.5" />Download</Link></Button>}
          />
        ) : (
          companions.map((d) => <DeviceRow key={d.id} device={d} />)
        )}
        {unrecognised.length > 0 && (
          <div className="px-4 py-3 text-[12.5px] leading-relaxed text-ink-3">
            {unrecognised.length === 1 ? "One signed-in device" : `${unrecognised.length} signed-in devices`} couldn't be identified by browser or platform. If one of them is the Companion, rename it to include “Companion” under <Link href={sectionHref("security")} className="text-accent hover:underline">Security → Devices</Link> and it will show here.
          </div>
        )}
      </Group>
    </div>
  );
}
