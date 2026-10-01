import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PublicNav } from "./PublicNav";
import { PublicFooter } from "./PublicFooter";

/** Frame for public content pages (download, legal, contact, profiles). */
export function PublicShell({ children, className, width = "default" }: { children: ReactNode; className?: string; width?: "default" | "narrow" }) {
  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <PublicNav />
      <main className={cn("mx-auto w-full flex-1 px-4 sm:px-6 lg:px-8 pb-16", width === "narrow" ? "max-w-3xl" : "max-w-[1120px]", className)}>
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicHeader({ eyebrow, title, description, actions }: { eyebrow?: ReactNode; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="pt-10 md:pt-14 pb-8">
      {eyebrow && <div className="t-label mb-2">{eyebrow}</div>}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="t-page text-[1.625rem] md:text-[1.875rem]">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

/** Long-form text (privacy, terms). Keeps the product's type scale. */
export function LegalArticle({ children, updated }: { children: ReactNode; updated?: string }) {
  return (
    <article className={cn(
      "max-w-[68ch] text-[14px] leading-[1.65] text-ink-2",
      "[&_h2]:t-section [&_h2]:text-ink [&_h2]:mt-8 [&_h2]:mb-2",
      "[&_p]:mb-3 [&_ul]:mb-3 [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:list-disc [&_li]:pl-0.5",
      "[&_strong]:text-ink [&_strong]:font-medium [&_a]:text-accent [&_a]:underline-offset-2 [&_a:hover]:underline",
    )}>
      {updated && <div className="t-meta mb-6">Last updated {updated}</div>}
      {children}
    </article>
  );
}

export default PublicShell;
