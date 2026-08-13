import { useEffect } from "react";

// Adds .is-visible to every [data-reveal] element once it scrolls into
// view, and leaves it visible (no re-hiding on scroll back up) — a single
// settle-in per element, matching apple.com's product-page scroll feel.
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
