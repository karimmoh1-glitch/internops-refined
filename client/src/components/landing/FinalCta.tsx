import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container, SectionTitle } from "./SectionHeading";
import { Reveal } from "./Reveal";

export function FinalCta() {
  return (
    <section className="border-t border-line py-24 md:py-32" aria-labelledby="cta-title">
      <Container>
        <Reveal className="mx-auto flex max-w-2xl flex-col items-center text-center">
          <SectionTitle className="text-balance"><span id="cta-title">See what your team is <span className="t-serif italic font-normal">actually</span> working on.</span></SectionTitle>
          <p className="mt-4 max-w-[48ch] text-balance text-[15.5px] leading-[1.6] text-ink-2">Request access to your workspace. A manager approves the request and you are in.</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg"><Link href="/signup">Request access<ArrowRight /></Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Sign in</Link></Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
