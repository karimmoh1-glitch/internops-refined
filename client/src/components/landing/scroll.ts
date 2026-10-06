import { useEffect, useRef } from "react";

/** True when the visitor has asked for reduced motion. Safe to call during render. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Moves an element a few pixels against the scroll direction so layered
 * panels read at different depths. `speed` is pixels per scrolled pixel and
 * `max` caps the travel, so the effect ends a short way down the page.
 *
 * Cost: one passive scroll listener, one write per animation frame and only
 * when the value changed, transform only (no layout). Under
 * prefers-reduced-motion the hook attaches nothing and the element stays put.
 */
export function useParallax<T extends HTMLElement>(speed: number, max = 24) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let frame = 0;
    let last = Number.NaN;
    const update = () => {
      frame = 0;
      const y = Math.min(max, Math.round(window.scrollY * speed * 2) / 2);
      if (y === last) return;
      last = y;
      el.style.transform = y === 0 ? "" : `translate3d(0, ${-y}px, 0)`;
    };
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update); };

    window.addEventListener("scroll", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      el.style.transform = "";
    };
  }, [speed, max]);

  return ref;
}
