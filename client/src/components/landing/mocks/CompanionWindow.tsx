import { cn } from "@/lib/utils";
import { Dot } from "@/components/kit";
import { MockButton, SampleTimer } from "./primitives";

const OBSERVED = [
  { label: "App", value: "VS Code" },
  { label: "Window", value: "routes.ts — internops" },
  { label: "Document", value: "routes.ts" },
  { label: "Browser host", value: "—" },
];

/** The desktop Companion (macOS / Windows), 380px wide, mid-shift. */
export function CompanionWindow({ className }: { className?: string }) {
  return (
    <figure className={cn("m-0 w-full max-w-[380px]", className)}>
      <div role="img" aria-label="Sample Companion window: status Working with a live timer, the current task, the observed foreground app VS Code with window title routes.ts, and a connected status." className="panel pop overflow-hidden text-left">
        <div aria-hidden>
          <div className="relative flex h-9 items-center justify-center border-b border-line bg-surface-2">
            <span className="absolute left-3 flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
              <span className="h-2.5 w-2.5 rounded-full bg-line-strong" />
            </span>
            <span className="text-[11px] font-medium text-ink-3">InternOps Companion</span>
          </div>

          <div className="p-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-work">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-work work-ring" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-work" />
                </span>
                Working
              </span>
              <span className="text-[20px] font-semibold leading-none tracking-[-0.02em] text-ink"><SampleTimer /></span>
            </div>

            <div className="mt-3 rounded-md border border-line bg-surface-2 px-3 py-2">
              <div className="t-label mb-0.5">Task</div>
              <div className="text-[13px] font-medium text-ink">Ship onboarding email</div>
            </div>

            <div className="mt-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="t-label">Observed now</span>
                <span className="text-[10.5px] text-ink-4">reports every 15s</span>
              </div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
                {OBSERVED.map((o) => (
                  <div key={o.label} className="contents">
                    <dt className="text-ink-3">{o.label}</dt>
                    <dd className={cn("truncate", o.value === "—" ? "text-ink-4" : "text-ink")}>{o.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[11.5px]">
              <span className="inline-flex items-center gap-1.5 text-ink-2"><Dot tone="ok" />Connected</span>
              <span className="text-ink-3">last report 3s ago</span>
            </div>

            <MockButton variant="outline" size="sm" className="mt-3 w-full">End shift</MockButton>
          </div>

          <div className="border-t border-line bg-surface-2 px-4 py-2 text-[10.5px] leading-snug text-ink-3">
            Observes only while Working. Never keystrokes, clipboard, screenshots or full URLs.
          </div>
        </div>
      </div>
      <figcaption className="t-meta mt-3">Sample Companion window. Timer and readings are illustrative.</figcaption>
    </figure>
  );
}
