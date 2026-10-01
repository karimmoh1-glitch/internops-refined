import { Play, Square, Upload, Code2, Globe, Moon, CircleDashed } from "lucide-react";
import { Avatar, Timeline, TimelineItem } from "@/components/kit";
import { AppFrame, Marker } from "./primitives";
import { SAMPLE_PEOPLE, SAMPLE_REPLAY, type SampleReplayEvent } from "./sample-data";

function iconFor(e: SampleReplayEvent) {
  if (e.marker === "UNKNOWN") return <CircleDashed />;
  if (e.marker === "OBSERVED") return e.title.startsWith("Idle") ? <Moon /> : e.title.startsWith("Chrome") ? <Globe /> : <Code2 />;
  if (e.title === "Shift started") return <Play />;
  if (e.title === "Shift ended") return <Square />;
  return <Upload />;
}

const TONE = { OBSERVED: "work", SYSTEM: "neutral", UNKNOWN: "warn" } as const;

/** Workday Replay: one session, in order, with provenance on every entry. */
export function ReplayMock({ className }: { className?: string }) {
  return (
    <AppFrame active="Work" label="Sample Workday Replay for Maya R.: a timeline from shift start at 09:02 to shift end at 11:45, with observed app segments, an idle reading, a 22-minute gap marked unknown, and system events for task started and submitted." caption="Sample session. Every entry is marked OBSERVED, SYSTEM or UNKNOWN — nothing in between is inferred." className={className}>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 hairline-b">
          <div className="flex items-center gap-2.5">
            <Avatar name={SAMPLE_PEOPLE.maya} size="sm" />
            <div>
              <div className="text-[13px] font-semibold text-ink">Workday Replay · {SAMPLE_PEOPLE.maya}</div>
              <div className="t-num text-[11px] text-ink-3">Today · 09:02 – 11:45 · 2h 43m</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-3">
            <span className="t-num">Observed <span className="text-ink">2h 02m</span></span>
            <span className="t-num">Idle <span className="text-ink">6m</span></span>
            <span className="t-num">Unknown <span className="text-ink">22m</span></span>
          </div>
        </div>
        <div className="px-4 py-4">
          <Timeline className="space-y-3.5">
            {SAMPLE_REPLAY.map((e) => (
              <TimelineItem
                key={e.time + e.title}
                tone={TONE[e.marker]}
                icon={iconFor(e)}
                title={<span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px]"><span className={e.marker === "UNKNOWN" ? "text-ink-2" : "font-medium"}>{e.title}</span><Marker kind={e.marker} /></span>}
                meta={<span>{e.time}{e.duration && <span className="text-ink-4"> · {e.duration}</span>}</span>}
              >
                {e.detail && <span className="text-[12px] text-ink-3">{e.detail}</span>}
              </TimelineItem>
            ))}
          </Timeline>
        </div>
      </div>
    </AppFrame>
  );
}
