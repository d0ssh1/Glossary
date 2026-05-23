import { useEffect, useState } from 'react';

/** Reactively returns whether `window.matchMedia(query)` matches. SSR-safe. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    // Sync immediately in case `query` changed between renders. We do this in a
    // microtask to avoid the cascading-render warning from react-hooks/set-state-in-effect.
    queueMicrotask(() => setMatches(mql.matches));
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}
