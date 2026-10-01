import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import LogoMark from "@/components/logo-mark";

export default function NotFound() {
  return (
    <div className="relative min-h-dvh bg-bg flex flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] grid-dots mask-fade-b opacity-70" />
      <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center anim-fade-up">
        <Link href="/" className="mb-6 rounded-md" aria-label="InternOps home"><LogoMark size={32} /></Link>
        <div className="t-label mb-2">404</div>
        <h1 className="t-page">Page not found</h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ink-3">This page doesn't exist, or it moved.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button asChild><Link href="/"><ArrowLeft />Back to InternOps</Link></Button>
          <Button asChild variant="outline"><Link href="/login">Log in</Link></Button>
        </div>
        <p className="mt-8 text-xs text-ink-3">
          <Link href="/download" className="hover:text-ink">Companion</Link>
          <span className="mx-2 text-ink-4">·</span>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <span className="mx-2 text-ink-4">·</span>
          <Link href="/contact" className="hover:text-ink">Contact</Link>
        </p>
      </main>
    </div>
  );
}
