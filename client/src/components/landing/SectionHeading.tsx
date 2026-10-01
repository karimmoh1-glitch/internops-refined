import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("t-label text-accent", className)}>{children}</div>;
}

export function SectionTitle({ children, className, as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return <Tag className={cn("text-[1.75rem] leading-[1.1] tracking-[-0.03em] md:text-[2.25rem]", className)}>{children}</Tag>;
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[15.5px] leading-[1.6] text-ink-2 md:text-[16.5px]", className)}>{children}</p>;
}

/** Page-width container shared by every landing section. */
export function Container({ children, className, wide = false }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8", wide ? "max-w-[1240px]" : "max-w-[1120px]", className)}>{children}</div>;
}
