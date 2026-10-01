import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { ChevronRight } from "lucide-react";

export function Page({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: "default" | "wide" | "narrow" | "full" }) {
  const w = width === "wide" ? "max-w-[1400px]" : width === "narrow" ? "max-w-3xl" : width === "full" ? "max-w-none" : "max-w-[1120px]";
  return <div className={cn("mx-auto w-full px-4 sm:px-6 lg:px-8 pb-24 md:pb-12", w, className)}>{children}</div>;
}

export function PageHeader({ title, description, actions, crumbs, eyebrow, className, children }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: { label: string; href?: string }[]; eyebrow?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <header className={cn("pt-6 md:pt-8 pb-5", className)}>
      {crumbs && crumbs.length > 0 && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-ink-3" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? <Link href={c.href} className="hover:text-ink transition-colors">{c.label}</Link> : <span className="text-ink-2">{c.label}</span>}
              {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </nav>
      )}
      {eyebrow && <div className="t-label mb-1.5">{eyebrow}</div>}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="t-page">{title}</h1>
          {description && <p className="mt-1 text-[13px] text-ink-3 max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function Section({ title, description, actions, children, className, flush = false, id }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean; id?: string }) {
  return (
    <section id={id} className={cn("panel overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 hairline-b">
          <div className="min-w-0">
            {title && <h2 className="t-section">{title}</h2>}
            {description && <p className="text-xs text-ink-3 mt-0.5">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function SectionLabel({ children, className, right }: { children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between mb-2.5", className)}>
      <span className="t-label">{children}</span>
      {right}
    </div>
  );
}
