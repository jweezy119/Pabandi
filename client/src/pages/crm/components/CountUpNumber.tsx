import { useState, useEffect, useRef } from 'react';

export default function CountUpNumber({
  end,
  duration = 800,
}: {
  end: number | string;
  duration?: number;
}) {
  const numericEnd = typeof end === 'string' ? parseInt(end, 10) || 0 : end;
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const startTime = useRef<number>(0);

  useEffect(() => {
    startTime.current = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(numericEnd * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [numericEnd, duration]);

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  );
}
