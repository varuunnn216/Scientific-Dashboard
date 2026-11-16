import { useEffect, useState, type RefObject } from 'react';

export function useContainerWidth(ref: RefObject<HTMLElement | null>, fallbackWidth = 600): number {
  const [width, setWidth] = useState<number>(fallbackWidth);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const measured = el.getBoundingClientRect().width;
      if (measured > 0) {
        setWidth(Math.round(measured));
      }
    };

    update();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => update());
      observer.observe(el);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [ref]);

  return width;
}
