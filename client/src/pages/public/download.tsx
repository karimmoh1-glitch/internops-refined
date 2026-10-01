import { Link } from "wouter";
import { Download, Check, X, Apple, Monitor, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/kit";
import { PublicShell, PublicHeader } from "@/components/public/PublicShell";
import { COMPANION_VERSION, COMPANION_DOWNLOADS } from "./companion-release";

const RECORDS = [
  "Foreground application name",
  "Window title",
  "Document or file name, when the app exposes it",
  "Browser hostname only (never the full URL)",
  "Idle seconds",
  "Timestamps",
];
const NEVER = ["Keystrokes", "Clipboard contents", "Screenshots or screen recordings", "Message content", "Full URLs or page content"];

const STEPS = [
  { title: "Start Work Mode", body: "On the web app or in the Companion. Nothing is observed before this." },
  { title: "Observed activity", body: "While Work Mode is on, the Companion records the signals listed below and sends them to your workspace." },
  { title: "End Shift", body: "Stop Work Mode. Observation stops immediately." },
  { title: "Report", body: "A factual shift report is built from what was observed. Gaps stay marked as unknown." },
  { title: "Workday Replay", body: "You and your manager can replay the shift as a timeline, with the same evidence." },
];

export default function DownloadPage() {
  return (
    <PublicShell>
      <PublicHeader
        eyebrow="InternOps Companion"
        title="The Companion desktop app"
        description="A small desktop app for Work Mode. It observes which apps and documents are in front of you during a shift, so your shift report is based on evidence rather than memory."
        actions={<Pill tone="neutral" className="t-num">v{COMPANION_VERSION}</Pill>}
      />

      <section aria-labelledby="dl-heading" className="mb-10">
        <h2 id="dl-heading" className="t-label mb-3">Download</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {COMPANION_DOWNLOADS.map((d, i) => {
            const Icon = d.platform === "macOS" ? Apple : Monitor;
            return (
              <a
                key={d.id}
                href={d.url}
                className={cn("panel group flex items-center gap-3 p-4 transition-colors hover:bg-surface-2", i === 0 && "border-accent/40")}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2 group-hover:text-ink">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{d.platform}</span>
                  <span className="block text-xs text-ink-3 truncate">{d.detail} · .{d.file}</span>
                </span>
                <Download className="h-4 w-4 shrink-0 text-ink-3 group-hover:text-accent" aria-hidden />
              </a>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">Releases are hosted on GitHub. Version {COMPANION_VERSION}.</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section aria-labelledby="first-launch" className="panel p-5">
          <h2 id="first-launch" className="t-section mb-3">First launch</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"><Apple className="h-4 w-4 text-ink-3" />macOS</div>
              <p className="text-[13px] leading-relaxed text-ink-2">
                This build is not code-signed, so macOS will block a normal double-click. Open the .dmg, drag the app to Applications, then <strong className="font-medium text-ink">right-click the app and choose Open</strong>. You only need to do this the first time.
              </p>
            </div>
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-ink"><Monitor className="h-4 w-4 text-ink-3" />Windows</div>
              <p className="text-[13px] leading-relaxed text-ink-2">
                The Windows build is a .zip. Unzip it anywhere and run <strong className="font-medium text-ink">InternOps Companion</strong> from the extracted folder.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="signin" className="panel p-5">
          <h2 id="signin" className="t-section mb-2">Signing in</h2>
          <p className="text-[13px] leading-relaxed text-ink-2">The Companion uses the same account as the web app. Work Mode started in either place shows up in both.</p>
          <Button asChild variant="outline" size="sm" className="mt-3"><Link href="/login">Log in<ArrowRight /></Link></Button>
        </section>
      </div>

      <section aria-labelledby="how" className="mt-4 panel p-5">
        <h2 id="how" className="t-section mb-4">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="min-w-0">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="t-num flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-[11px] font-medium text-ink-2">{i + 1}</span>
                <span className="text-sm font-medium text-ink">{s.title}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-ink-3">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="records" className="mt-4 panel p-5">
        <div className="mb-4">
          <h2 id="records" className="t-section">What the Companion records</h2>
          <p className="mt-1 text-[13px] text-ink-3">Only while Work Mode is on. Off shift, nothing is observed or sent.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <div className="t-label mb-2 text-ok">Observed</div>
            <ul className="space-y-1.5">
              {RECORDS.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[13px] text-ink-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok" aria-hidden />{r}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="t-label mb-2 text-danger">Never</div>
            <ul className="space-y-1.5">
              {NEVER.map((r) => (
                <li key={r} className="flex items-start gap-2 text-[13px] text-ink-2"><X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />{r}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="mt-4 text-xs text-ink-3">
          Full details in the <Link href="/privacy" className="text-accent underline-offset-2 hover:underline">privacy policy</Link>.
        </p>
      </section>
    </PublicShell>
  );
}
