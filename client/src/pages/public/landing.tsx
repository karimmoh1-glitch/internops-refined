import { useEffect } from "react";
import { PublicNav } from "@/components/public/PublicNav";
import { PublicFooter } from "@/components/public/PublicFooter";
import { Hero, Problem, FeatureStories, PrivacyBoundary, MoreStrip, FinalCta } from "@/components/landing";

const TITLE = "InternOps — The operating system for intern teams";

export default function Landing() {
  useEffect(() => {
    const prev = document.title;
    document.title = TITLE;
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <PublicNav />
      <main className="flex-1">
        <Hero />
        <Problem />
        <FeatureStories />
        <PrivacyBoundary />
        <MoreStrip />
        <FinalCta />
      </main>
      <PublicFooter />
    </div>
  );
}
