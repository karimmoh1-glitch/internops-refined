import { Link } from "wouter";
import { cn } from "@/lib/utils";
import LogoMark, { Wordmark } from "@/components/logo-mark";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  { title: "Product", links: [{ label: "Companion", href: "/download" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }] },
  { title: "Account", links: [{ label: "Log in", href: "/login" }, { label: "Sign up", href: "/signup" }] },
  { title: "Contact", links: [{ label: "Get in touch", href: "/contact" }] },
];

export function PublicFooter({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn("border-t border-line bg-bg", className)}>
      <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-6 lg:px-8 py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-[1.4fr_repeat(3,minmax(0,1fr))]">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-2 rounded-md" aria-label="InternOps home">
              <LogoMark size={24} />
              <Wordmark size={14} />
            </Link>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-ink-3">
              Internship operations in one workspace: tasks, projects, Work Mode and honest shift reports.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title} className="min-w-0">
              <div className="t-label mb-3">{col.title}</div>
              <ul className="space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-[13px] text-ink-2 hover:text-ink transition-colors">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-xs text-ink-3">
          <span>© {year} InternOps</span>
          <span>Data is processed by the operator of this deployment.</span>
        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
