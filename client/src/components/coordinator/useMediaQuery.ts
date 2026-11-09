import { useEffect, useState } from 'react';

/**
 * Tracks a media query and re-renders on change.
 *
 * Needed because the inspector has two genuinely different presentations — a
 * persistent pane on a wide screen, a full-screen sheet on a phone — and the
 * difference is not just cosmetic: on mobile the sheet must not be in the tab
 * order while it is closed. CSS alone can hide it visually but cannot remove
 * it from the accessibility tree, so the component needs to know.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);

    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
