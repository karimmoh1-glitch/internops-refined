import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import LogoMark from "@/components/logo-mark";

export default function LegalPageLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#09090b]">
      <nav className="bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold font-heading text-white no-underline" data-testid="link-home">
            <LogoMark size={32} />
            InternOps
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors no-underline">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold font-heading text-white mb-2" data-testid="text-legal-title">{title}</h1>
        <p className="text-zinc-500 text-sm mb-10">Last updated: {updated}</p>
        <div className="prose prose-invert prose-zinc max-w-none space-y-6 text-zinc-300 [&_h2]:text-white [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-zinc-400 [&_li]:text-sm [&_li]:text-zinc-400 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </main>
    </div>
  );
}
