import { Bell, Users, MessageSquare, GraduationCap, Command, FolderKanban } from "lucide-react";
import { Kbd } from "@/components/kit";
import { Container, Eyebrow } from "./SectionHeading";
import { Reveal } from "./Reveal";

const ITEMS = [
  { icon: Bell, title: "Notifications", body: "Assignments, review decisions and mentions, in the app." },
  { icon: Users, title: "People", body: "The roster with live status: working, idle, last session." },
  { icon: MessageSquare, title: "Messages", body: "Channels and direct messages next to the work." },
  { icon: FolderKanban, title: "Projects", body: "Week-by-week plans, drafted by AI and approved by a manager." },
  { icon: GraduationCap, title: "Alumni", body: "Records and certificates when an internship ends." },
  { icon: Command, title: "Command palette", body: <>Jump to any task, person or project with <Kbd className="mx-0.5">⌘K</Kbd>.</> },
];

export function MoreStrip() {
  return (
    <section className="border-t border-line py-16 md:py-20" aria-labelledby="more-title">
      <Container>
        <Reveal>
          <Eyebrow>Also in the workspace</Eyebrow>
          <h2 id="more-title" className="mt-3 text-[1.375rem] leading-tight tracking-[-0.02em]">The rest of the day, in the same place.</h2>
        </Reveal>
        <Reveal delay={60}>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {ITEMS.map((it) => (
              <li key={it.title} className="bg-surface p-5">
                <it.icon className="h-4 w-4 text-ink-3" aria-hidden />
                <div className="mt-3 text-[14px] font-medium text-ink">{it.title}</div>
                <p className="mt-1 text-[13px] leading-[1.55] text-ink-2">{it.body}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      </Container>
    </section>
  );
}
