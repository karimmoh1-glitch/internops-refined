import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type Tone, toneClasses } from "./status";

export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <ol className={cn("relative ml-2 border-l border-line pl-5 space-y-5", className)}>{children}</ol>;
}

export function TimelineItem({ icon, tone = "neutral", title, meta, children, className }: { icon?: ReactNode; tone?: Tone; title: ReactNode; meta?: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <li className={cn("relative", className)}>
      <span className={cn("absolute -left-[29px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-bg [&_svg]:h-2.5 [&_svg]:w-2.5", toneClasses[tone].bg, toneClasses[tone].text)}>
        {icon ?? <span className={cn("h-1.5 w-1.5 rounded-full", toneClasses[tone].dot)} />}
      </span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <div className="text-[13px] text-ink">{title}</div>
        {meta && <div className="text-xs t-num text-ink-3 shrink-0">{meta}</div>}
      </div>
      {children && <div className="mt-1 text-[13px] text-ink-2">{children}</div>}
    </li>
  );
}
