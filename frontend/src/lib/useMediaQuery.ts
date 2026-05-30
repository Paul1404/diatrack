import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render when it changes.
 *
 * Used for layout decisions that can't be expressed in CSS alone, e.g.
 * rendering a card list instead of a table on small screens.
 */
export function useMediaQuery(query: string): boolean {
  const getMatch = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    // Sync immediately in case the query changed between render and effect.
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Convenience wrapper: true on phone-sized viewports (matches the CSS breakpoint). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)');
}
