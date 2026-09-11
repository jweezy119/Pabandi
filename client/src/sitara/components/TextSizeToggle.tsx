// Sitara OS — readability (text-size) preference.
// Older eyes, bright sunlight, small screens: three sizes, persisted,
// applied to the root so the whole app scales proportionally.
import { useState } from 'react';

const KEY = 'sitara:text-size';
const SIZES = [16, 18, 20] as const;

export function currentTextSize(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return SIZES.includes(v as any) ? v : 16;
  } catch {
    return 16;
  }
}

export function applyTextSize(px: number) {
  // Tailwind sizes are root-rems, so the scale lives on <html> while Sitara
  // is mounted (reset on unmount — the main app is untouched).
  document.documentElement.style.fontSize = px === 16 ? '' : `${px}px`;
  try {
    localStorage.setItem(KEY, String(px));
  } catch {
    /* private mode */
  }
}

export function resetTextSize() {
  document.documentElement.style.fontSize = '';
}

export function useTextSize() {
  const [size, setSize] = useState(currentTextSize);
  const cycle = () => {
    const i = SIZES.indexOf(size as any);
    const next = SIZES[(i + 1) % SIZES.length];
    setSize(next);
    applyTextSize(next);
  };
  return { size, cycle };
}

export default function TextSizeToggle({ dark = false }: { dark?: boolean }) {
  const { size, cycle } = useTextSize();
  return (
    <button
      onClick={cycle}
      title={`Text size: ${size === 16 ? 'normal' : size === 18 ? 'large' : 'largest'} — tap to change`}
      aria-label="Change text size"
      className={`shrink-0 h-9 px-2.5 rounded-lg text-sm font-bold border transition-colors ${
        dark
          ? 'border-slate-700 text-slate-300 active:bg-slate-800'
          : 'border-slate-200 text-slate-600 active:bg-slate-100'
      }`}
    >
      A{size > 16 ? '+' : ''}{size > 18 ? '+' : ''}
    </button>
  );
}
