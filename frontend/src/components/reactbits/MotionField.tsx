import { lazy, Suspense, useSyncExternalStore } from 'react';
import styles from './MotionField.module.css';

const DotGrid = lazy(() => import('./DotGrid'));
const query = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const preference = window.matchMedia?.(query);
  preference?.addEventListener('change', onChange);
  return () => preference?.removeEventListener('change', onChange);
}

function motionAllowed() {
  return window.matchMedia?.(query).matches === false;
}

export default function MotionField({ className }: { className?: string }) {
  const animate = useSyncExternalStore(subscribe, motionAllowed, () => false);

  return (
    <div className={`${styles.field} ${className ?? ''}`} aria-hidden="true">
      {animate && (
        <Suspense fallback={null}>
          <DotGrid
            dotSize={2.2} gap={16} baseColor="#8b918a" activeColor="#d1f4ad"
            opacity={0.71} proximity={85} fade={0.2} dpr={1}
            intro={false} clickShock={false}
          />
        </Suspense>
      )}
      <div className={styles.sweep} />
    </div>
  );
}
