import { cn } from "@/lib/utils";
import { Dot, StatusBadge } from "@/components/kit";
import { MockButton, MockChip, SampleTimer } from "./primitives";

/** The intern's Work Mode card on the web: the live timer, the current task, the Companion link. */
export function WorkModeCard({ className }: { className?: string }) {
  return (
    <div role="img" aria-label="Sample Work Mode card: a session is active with a live timer, the current task is Ship onboarding email, and the Companion is connected." className={cn("panel pop p-4 text-left", className)}>
      <div aria-hidden>
        <div className="flex items-center justify-between">
          <span className="t-label">Work Mode</span>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-work"><Dot tone="work" pulse />Working</span>
        </div>
        <div className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink"><SampleTimer /></div>
        <div className="mt-1 text-[11.5px] text-ink-3">Started 09:02 from the Companion</div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="t-label mb-1.5">Current task</div>
          <div className="flex flex-wrap items-center gap-2">
            <MockChip kind="task" label="Ship onboarding email" />
            <StatusBadge status="in_progress" />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11.5px]">
          <span className="inline-flex items-center gap-1.5 text-ink-2"><Dot tone="ok" />Companion connected</span>
          <span className="text-ink-3">last report 3s ago</span>
        </div>

        <MockButton variant="outline" size="sm" className="mt-4 w-full">End shift</MockButton>
      </div>
    </div>
  );
}
