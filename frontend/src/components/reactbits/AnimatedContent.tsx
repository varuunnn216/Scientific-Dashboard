import type { ReactNode } from 'react';
import styles from './AnimatedContent.module.css';

interface AnimatedContentProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

export default function AnimatedContent({
  children,
  delayMs = 0,
  className = '',
}: AnimatedContentProps) {
  return (
    <div
      className={`${styles.animated} ${className}`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {children}
    </div>
  );
}
