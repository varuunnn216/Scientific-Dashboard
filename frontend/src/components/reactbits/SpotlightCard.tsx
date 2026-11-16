import { useRef, useState, type ReactNode, type MouseEvent } from 'react';
import styles from './SpotlightCard.module.css';

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  spotlightColor?: string;
  as?: 'article' | 'section' | 'div';
}

export default function SpotlightCard({
  children,
  className = '',
  spotlightColor = 'rgba(255, 255, 255, 0.07)',
  as: Component = 'div',
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, active: false });

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      active: true,
    });
  };

  const handleMouseLeave = () => {
    setCoords((prev) => ({ ...prev, active: false }));
  };

  return (
    <Component
      ref={cardRef as never}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`${styles.card} ${className}`}
      style={{
        ['--spotlight-x' as string]: `${coords.x}px`,
        ['--spotlight-y' as string]: `${coords.y}px`,
        ['--spotlight-color' as string]: spotlightColor,
        ['--spotlight-opacity' as string]: coords.active ? '1' : '0',
      }}
    >
      <div className={styles.spotlight} aria-hidden="true" />
      <div className={styles.content}>{children}</div>
    </Component>
  );
}
