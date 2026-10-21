import * as React from 'react';

/** The media query a reader sets to ask for less motion. */
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the reader has asked for less motion, right now. `false` where
 * `matchMedia` does not exist (SSR, a bare jsdom) — the question has no answer
 * there, and callers that animate from JavaScript should check that they *can*
 * animate separately (see {@link useCountUp}).
 */
export function prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * `prefers-reduced-motion: reduce`, as React state that follows the setting
 * while the page is open. For motion that CSS cannot reach — a JavaScript
 * animation, or a library's inline `transition` style (dnd-kit's sortable
 * glide), which a `motion-reduce:` class can never override.
 *
 * Read during render from the first frame, like {@link useIsMobile}, so a
 * reader who asked for less motion never gets one frame of it.
 */
export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = React.useState(prefersReducedMotion);

    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;
        const mql = window.matchMedia(REDUCED_MOTION_QUERY);
        const onChange = (event: MediaQueryListEvent) =>
            setReduced(event.matches);
        mql.addEventListener('change', onChange);
        setReduced(mql.matches);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return reduced;
}
