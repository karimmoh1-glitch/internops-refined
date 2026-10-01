import type { ReactNode } from "react";
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
  flip?: boolean;
  narrowMock?: boolean;
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
    flip: true,
    narrowMock: true,
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
    flip: true,
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

function StoryBlock({ story }: { story: Story }) {
  return (
    <article id={story.id} className="scroll-mt-20" aria-labelledby={`${story.id}-title`}>
      <div className={cn("grid items-center gap-10 lg:gap-16", story.narrowMock ? "lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)]" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]")}>
        <Reveal className={cn("max-w-[48ch]", story.flip && "lg:order-2")}>
          <Eyebrow><span className="t-num mr-2 text-ink-4">{story.index}</span>{story.name}</Eyebrow>
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
        <Reveal delay={60} className={cn("min-w-0", story.flip && "lg:order-1")}>{story.mock}</Reveal>
      </div>
    </article>
  );
}

export function FeatureStories() {
  return (
    <section id="product" className="scroll-mt-16 border-t border-line py-20 md:py-28" aria-labelledby="product-title">
      <Container>
        <Reveal className="max-w-2xl">
          <Eyebrow>The product</Eyebrow>
          <SectionTitle className="mt-3"><span id="product-title">Five views of the same work.</span></SectionTitle>
          <Lede className="mt-4">Tasks, shifts, replays, signals and answers all read from one record. Change something anywhere and every view reflects it.</Lede>
        </Reveal>
        <div className="mt-16 space-y-24 md:mt-20 md:space-y-32">
          {STORIES.map((s) => <StoryBlock key={s.id} story={s} />)}
        </div>
      </Container>
    </section>
  );
}
