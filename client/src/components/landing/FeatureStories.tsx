import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Container, Eyebrow, Lede, SectionTitle } from "./SectionHeading";
import { Reveal } from "./Reveal";
import { CompanionWindow, PulseMock, ReplayMock, SignalsMock, TasksMock } from "./mocks";
import { WorkingChip } from "./mocks/primitives";

interface Story {
  id: string;
  index: string;
  name: string;
  title: string;
  lede: ReactNode;
  points: string[];
  mock: ReactNode;
}

const STORIES: Story[] = [
  {
    id: "manage",
    index: "01",
    name: "Manage",
    title: "Assign work. Review it properly.",
    lede: "Every task moves through one lifecycle: To do, In progress, In review, Changes requested, Approved. Each submission and every comment stays on the task, so the second round is read next to the first.",
    points: [
      "Submission history with the reviewer's notes on each version",
      "Projects start from an AI-drafted week-by-week plan a manager reviews before anyone begins",
      "Comments live on the task, not in a thread somewhere else",
    ],
    mock: <TasksMock />,
  },
  {
    id: "work",
    index: "02",
    name: "Work",
    title: "Start a shift. The whole app knows.",
    lede: (
      <>
        An intern starts Work Mode on the web or in the desktop Companion. A live timer runs and every screen shows <WorkingChip withTimer={false} className="mx-0.5 h-6 align-middle" />. The Companion reports the foreground app, window title, document name and browser hostname, and only while the shift is on.
      </>
    ),
    points: [
      "Companion for macOS and Windows",
      "Never keystrokes, clipboard, screenshots or full URLs",
      "Ending the shift ends collection; late reports are rejected by the server",
    ],
    mock: <CompanionWindow className="mx-auto" />,
  },
  {
    id: "understand",
    index: "03",
    name: "Understand",
    title: "Replay the day as it happened.",
    lede: "Workday Replay is the chronological record of one session: shift start, tasks started and submitted, observed app segments, idle readings, gaps where the Companion saw nothing, and the end of shift with its reason.",
    points: [
      "Every entry is marked OBSERVED, SYSTEM or UNKNOWN",
      "Gaps say \"No Companion observation\" instead of guessing",
      "Idle is a reading, not a verdict",
    ],
    mock: <ReplayMock />,
  },
  {
    id: "act",
    index: "04",
    name: "Act",
    title: "Signals with evidence, not opinions.",
    lede: "Manager Signals flag the conditions the data can show: overdue, blocked, waiting on review, stalled, no recent session, heavy workload. Each one carries its evidence and the action that resolves it. None of them judges effort.",
    points: [
      "Every signal names the task, the person and the dates behind it",
      "Approvals and plan proposals queue in the same place",
      "Snooze or dismiss; the same condition never reappears twice",
    ],
    mock: <SignalsMock />,
  },
  {
    id: "ask",
    index: "05",
    name: "Ask",
    title: "Ask the workspace a question.",
    lede: "Pulse Chat answers from the real data: who is working right now, what needs attention, what changed today. Every answer links the tasks, people and sessions it mentions.",
    points: [
      "Streams the answer when an AI key is configured",
      "Without one, answers deterministically from the data and says so",
      "References only point at records that exist",
    ],
    mock: <PulseMock />,
  },
];

// Tailwind needs the literal class names to exist in source.
const COPY_ROW = ["xl:row-start-1", "xl:row-start-2", "xl:row-start-3", "xl:row-start-4", "xl:row-start-5"];

/**
 * From `xl` up the five mocks share one grid area in the right column and
 * stick near the middle of the viewport; the copy scrolls past on the left
 * and whichever block sits in the middle band of the viewport decides which
 * mock is visible. Below `xl` (and for assistive tech, which reads the DOM)
 * each story is simply its copy followed by its mock.
 */
export function FeatureStories() {
  const [active, setActive] = useState(0);
  const copyRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || typeof window.matchMedia !== "function") return;
    const pinned = window.matchMedia("(min-width: 1280px)");
    let io: IntersectionObserver | null = null;

    const connect = () => {
      io?.disconnect();
      io = null;
      if (!pinned.matches) return;
      io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const i = Number((entry.target as HTMLElement).dataset.story);
          if (!Number.isNaN(i)) setActive(i);
        }
      }, { rootMargin: "-40% 0px -40% 0px", threshold: 0 });
      for (const el of copyRefs.current) if (el) io.observe(el);
    };

    connect();
    pinned.addEventListener("change", connect);
    return () => { io?.disconnect(); pinned.removeEventListener("change", connect); };
  }, []);

  return (
    <section id="product" className="scroll-mt-16 border-t border-line py-20 md:py-28" aria-labelledby="product-title">
      <Container wide>
        <Reveal className="max-w-2xl">
          <Eyebrow>The product</Eyebrow>
          <SectionTitle className="mt-3"><span id="product-title">Five views of the same work.</span></SectionTitle>
          <Lede className="mt-4">Tasks, shifts, replays, signals and answers all read from one record. Change something anywhere and every view reflects it.</Lede>
        </Reveal>

        <div className="mt-14 grid gap-x-12 gap-y-10 md:mt-16 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] xl:gap-y-0">
          {STORIES.map((story, i) => {
            const isActive = i === active;
            return [
              <article
                key={`${story.id}-copy`}
                id={story.id}
                ref={(el) => { copyRefs.current[i] = el; }}
                data-story={i}
                aria-labelledby={`${story.id}-title`}
                className={cn("scroll-mt-24 xl:col-start-1 xl:flex xl:min-h-[80vh] xl:flex-col xl:justify-center xl:py-10", COPY_ROW[i], i > 0 && "pt-6 md:pt-10 xl:pt-10")}
              >
                <Reveal className="max-w-[48ch]">
                  <Eyebrow className={cn("transition-colors duration-300", !isActive && "xl:text-ink-3")}>
                    <span className="t-num mr-2 text-ink-4">{story.index}</span>{story.name}
                  </Eyebrow>
                  <SectionTitle className="mt-3"><span id={`${story.id}-title`}>{story.title}</span></SectionTitle>
                  <Lede className="mt-4">{story.lede}</Lede>
                  <ul className="mt-5 space-y-2 text-[14px] text-ink-2">
                    {story.points.map((p) => (
                      <li key={p} className="flex gap-2.5">
                        <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </Reveal>
              </article>,
              <div
                key={`${story.id}-mock`}
                className={cn(
                  "min-w-0 xl:col-start-2 xl:row-start-1 xl:row-span-5 xl:self-start xl:sticky xl:top-[max(5rem,calc(50vh-300px))]",
                  "transition-opacity duration-300 ease-out",
                  isActive ? "xl:z-10" : "xl:invisible xl:opacity-0",
                  i < STORIES.length - 1 && "pb-10 md:pb-16 xl:pb-0",
                )}
              >
                <Reveal>{story.mock}</Reveal>
              </div>,
            ];
          })}
        </div>
      </Container>
    </section>
  );
}
