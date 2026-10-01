import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import LogoMark, { Wordmark } from "@/components/logo-mark";
import { Button } from "@/components/ui/button";

// "Product" is a plain anchor on purpose: a fragment link lets the browser
// handle the scroll natively whether we're already on the landing page or not.
const LINKS: { label: string; href: string; plain?: boolean }[] = [
  { label: "Product", href: "/#product", plain: true },
  { label: "Companion", href: "/download" },
];

export function PublicNav({ className }: { className?: string }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const { user, ready } = useAuth();

  useEffect(() => { setOpen(false); }, [location]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const signedIn = ready && !!user;

  // Plain function (not a nested component) so links don't remount on every render.
  const navLink = ({ label, href, plain }: { label: string; href: string; plain?: boolean }, mobile = false) => {
    const active = !plain && location === href;
    const cls = cn(
      "rounded-md font-medium transition-colors",
      mobile ? "flex h-10 items-center px-3 text-[14px]" : "h-8 px-2.5 inline-flex items-center text-[13px]",
      active ? "text-ink bg-surface-2" : "text-ink-2 hover:text-ink hover:bg-surface-2",
    );
    return plain ? <a key={href} href={href} className={cls}>{label}</a> : <Link key={href} href={href} className={cls} aria-current={active ? "page" : undefined}>{label}</Link>;
  };

  return (
    <header className={cn("sticky top-0 z-40 bg-bg/75 backdrop-blur-md supports-[backdrop-filter]:bg-bg/60", className)}>
      <div className="mx-auto flex h-14 w-full max-w-[1120px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 rounded-md" aria-label="InternOps home">
          <LogoMark size={26} />
          <Wordmark size={15} />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Public">
          {LINKS.map((l) => navLink(l))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {signedIn ? (
            <Button asChild size="sm"><Link href="/">Open InternOps</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button>
              <Button asChild size="sm"><Link href="/signup">Get started</Link></Button>
            </>
          )}
        </div>

        <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="public-mobile-menu" onClick={() => setOpen((o) => !o)}>
          {open ? <X /> : <Menu />}
        </Button>
      </div>

      {open && (
        <div id="public-mobile-menu" className="md:hidden border-t border-line bg-surface anim-fade">
          <nav className="mx-auto flex w-full max-w-[1120px] flex-col gap-0.5 px-3 py-3" aria-label="Public">
            {LINKS.map((l) => navLink(l, true))}
            <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
              {signedIn ? (
                <Button asChild><Link href="/">Open InternOps</Link></Button>
              ) : (
                <>
                  <Button asChild variant="outline"><Link href="/login">Log in</Link></Button>
                  <Button asChild><Link href="/signup">Get started</Link></Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export default PublicNav;
