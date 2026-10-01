import { Fragment, useEffect, useRef, useState } from "react";
import { Sparkles, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Dot, Kbd } from "@/components/kit";
import { AppFrame, MockChip } from "./primitives";
import { SAMPLE_MANAGER, SAMPLE_PULSE_QUESTION, SAMPLE_PULSE_REPLY, SAMPLE_PULSE_SUGGESTIONS, type PulseSegment } from "./sample-data";

const segLen = (s: PulseSegment) => (s.kind === "text" ? s.text.length : s.label.length);
const TOTAL = SAMPLE_PULSE_REPLY.reduce((n, s) => n + segLen(s), 0);

function reducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A scripted demo of Pulse Chat. The reply "streams" in with a small
 * typewriter once the panel scrolls into view, the way a real answer streams
 * over SSE when an AI key is configured. With prefers-reduced-motion the full
 * reply renders immediately. Nothing here calls the server.
 */
export function PulseMock({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(() => (reducedMotion() ? TOTAL : 0));
  const [started, setStarted] = useState(() => reducedMotion());

  useEffect(() => {
    if (started) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") { setStarted(true); return; }
    const io = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setStarted(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started || count >= TOTAL) return;
    let n = 0;
    const id = window.setInterval(() => {
      n += 2 + Math.floor(Math.random() * 3); // uneven chunks, like tokens
      if (n >= TOTAL) { setCount(TOTAL); window.clearInterval(id); } else setCount(n);
    }, 24);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const done = count >= TOTAL;

  // Render the visible prefix of the reply, chips included once reached.
  let cursor = 0;
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < SAMPLE_PULSE_REPLY.length; i++) {
    const s = SAMPLE_PULSE_REPLY[i];
    const start = cursor;
    cursor += segLen(s);
    if (count <= start) break;
    if (s.kind === "chip") nodes.push(<MockChip key={i} kind={s.ref} label={s.label} className="mx-0.5" />);
    else nodes.push(<Fragment key={i}>{s.text.slice(0, Math.max(0, count - start))}</Fragment>);
  }

  return (
    <div ref={ref}>
      <AppFrame active="Pulse" label="Sample Pulse Chat: the manager asks what needs attention and Pulse replies with three items, each linking a task or person." caption={<>Sample conversation. {done ? "The reply above was scripted for this page." : "Reply is being typed for demonstration."}</>} className={className}>
        <div className="panel flex min-h-[380px] flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 hairline-b">
            <span className="inline-flex items-center gap-1.5 t-section"><Sparkles className="h-3.5 w-3.5 text-pulse" />Pulse</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3"><Dot tone="pulse" />Answers from workspace data</span>
          </div>

          <div className="flex-1 space-y-4 px-3 py-4 text-[13px]">
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PULSE_SUGGESTIONS.map((s) => (
                <span key={s} className={cn("rounded-md border px-2 py-1 text-[11.5px]", s === SAMPLE_PULSE_QUESTION ? "border-pulse/30 bg-pulse-soft text-pulse" : "border-line bg-surface text-ink-2")}>{s}</span>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <div className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-ink">{SAMPLE_PULSE_QUESTION}</div>
              <Avatar name={SAMPLE_MANAGER} size="sm" className="mt-0.5" />
            </div>

            <div className="flex gap-2">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pulse-soft text-pulse"><Sparkles className="h-3 w-3" /></span>
              <div className="min-w-0 flex-1 whitespace-pre-wrap leading-[1.6] text-ink-2 [&_span]:whitespace-normal" aria-live="off">
                {started && (
                  <span className={cn(!done && "caret")}>{nodes}</span>
                )}
                {!started && <span className="text-ink-4">…</span>}
                {done && <div className="mt-2.5 text-[11px] text-ink-3">3 references · answered from live tasks and sessions</div>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-line bg-surface-2 px-3 py-2">
            <span className="flex-1 truncate rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12px] text-ink-4">Ask about your team…</span>
            <Kbd><CornerDownLeft className="h-3 w-3" /></Kbd>
          </div>
        </div>
      </AppFrame>
    </div>
  );
}
