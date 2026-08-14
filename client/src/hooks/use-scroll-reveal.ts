import { useEffect } from "react";

// Adds .is-visible to every [data-reveal]/[data-reveal-lg] element once it
// scrolls into view, and leaves it visible (no re-hiding on scroll back up)
// — a single settle-in per element, matching apple.com's product-page
// scroll feel.
export function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal], [data-reveal-lg]");
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

    // Safety net: a large instantaneous scroll jump (End key, scrollbar-
    // track click, a deep link landing mid-page) can move the viewport past
    // an element's band in a single frame, so the IntersectionObserver
    // never sees it cross into view and it would otherwise stay invisible
    // forever. On scroll, anything not yet revealed that's now entirely
    // above the viewport has already been passed by the user — reveal it
    // immediately (no animation needed off-screen) rather than leave it
    // permanently hidden.
    let ticking = false;
    const catchUp = () => {
      elements.forEach((el) => {
        if (el.classList.contains("is-visible")) return;
        if (el.getBoundingClientRect().bottom < 0) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      });
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(catchUp);
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
