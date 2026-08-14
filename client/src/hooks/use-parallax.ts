import { useEffect, useRef } from "react";

// Lightweight scroll parallax for decorative layers only — never applied to
// text or interactive elements, since a shifting hitbox/readable line would
// hurt usability far more than the effect helps. rAF-throttled so it never
// runs more than once per frame; disabled entirely under reduced-motion.
export function useParallax<T extends HTMLElement>(speed = 0.15) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let ticking = false;
    const update = () => {
      const rect = el.parentElement?.getBoundingClientRect();
      const offset = rect ? rect.top : 0;
      el.style.transform = `translate3d(0, ${offset * speed}px, 0)`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [speed]);

  return ref;
}
