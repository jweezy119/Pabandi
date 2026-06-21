import { useEffect, useRef } from 'react';

/**
 * Attaches an IntersectionObserver to the returned ref.
 * When the element enters the viewport, adds the `in-view` class
 * which triggers the `.reveal` CSS transition defined in index.css.
 *
 * Usage:
 *   const ref = useScrollReveal();
 *   <section ref={ref} className="reveal"> ... </section>
 *
 * For staggered children, wrap with className="reveal-group" and
 * add className="reveal" to each child.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>(
  margin = '-80px',
  once = true,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            if (once) observer.unobserve(entry.target);
          } else if (!once) {
            entry.target.classList.remove('in-view');
          }
        });
      },
      { rootMargin: margin },
    );

    // Observe the element itself (for single-element reveals)
    if (el.classList.contains('reveal')) {
      observer.observe(el);
    }

    // Also observe any .reveal children (for reveal-group stagger)
    el.querySelectorAll('.reveal').forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [margin, once]);

  return ref;
}
