import { Link } from "wouter";
import { Check, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Group, Row, SectionHeader } from "./primitives";

const RECORDED: { what: string; why: string }[] = [
  { what: "Foreground app name", why: "e.g. “Visual Studio Code” — which tool was in front." },
  { what: "Window title", why: "The title bar text, so a replay can say which file or page was open." },
  { what: "Document name", why: "When the app exposes one — a filename, not its contents." },
  { what: "Browser hostname only", why: "“github.com”, never the path, query or page content." },
  { what: "Idle seconds", why: "How long since the last keyboard or mouse input — a number, not what was pressed." },
  { what: "Timestamps", why: "When each observation was made, so they line up with your shift." },
];

const NEVER = ["Keystrokes or what you type", "Clipboard contents", "Screenshots or screen recording", "Full URLs, search terms or page content", "Anything while Work Mode is off", "Anything from a device without the Companion"];

export function PrivacySection() {
  return (
    <div className="space-y-5">
      <SectionHeader
        title="Privacy"
        description="A plain statement of what Work Mode records. If something isn't listed here, it isn't collected."
        actions={<Button asChild variant="outline" size="sm"><Link href="/privacy">Full privacy notice<ArrowRight className="h-3.5 w-3.5" /></Link></Button>}
      />

      <Group title="Recorded during Work Mode" description="Only while a shift is running and the Companion is signed in. Each field is sent as-is; nothing is inferred on the device.">
        <ul className="divide-y divide-line">
          {RECORDED.map((r) => (
            <li key={r.what} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ok-soft text-ok"><Check className="h-3 w-3" strokeWidth={3} /></span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-medium text-ink">{r.what}</span>
                <span className="block text-[12.5px] text-ink-3">{r.why}</span>
              </span>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Never recorded">
        <ul className="grid gap-x-6 gap-y-2 px-4 py-3 sm:grid-cols-2">
          {NEVER.map((line) => (
            <li key={line} className="flex items-center gap-2.5 text-[13px] text-ink-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-3"><X className="h-3 w-3" strokeWidth={3} /></span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Who sees it" footer="Replays mark Companion data as observed, task links as likely, and gaps as unknown. Nothing is phrased as a conclusion about how hard you worked.">
        <Row label="You" description="Every observation, in your own shift replays." />
        <Row label="Managers in your workspace" description="The same replays, plus signals derived from them — like a long idle stretch during a shift." />
        <Row label="Nobody else" description="Nothing is shared outside the workspace, and your public profile never includes activity." />
      </Group>
    </div>
  );
}
