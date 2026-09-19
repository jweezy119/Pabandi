import { useState, useRef, useEffect } from 'react';

export function useSwipe(onSwipeLeft?: () => void, onSwipeRight?: () => void, threshold = 50) {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [translateX, setTranslateX] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (translateX === 0) return;
    const timer = setTimeout(() => setTranslateX(0), 300);
    return () => clearTimeout(timer);
  }, [translateX]);

  const onTouchStart = (e: React.TouchEvent) => setTouchEnd(null);
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(e.targetTouches[0].clientX);
    if (touchStart && touchEnd) {
      setTranslateX(touchEnd - touchStart);
    }
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchEnd - touchStart;
    if (distance > threshold && onSwipeRight) onSwipeRight();
    else if (distance < -threshold && onSwipeLeft) onSwipeLeft();
    setTouchStart(null);
    setTouchEnd(null);
  };

  return { ref, translateX, onTouchStart, onTouchMove, onTouchEnd };
}
