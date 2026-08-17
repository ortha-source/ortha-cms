import * as React from 'react';

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

/** Whether the viewport is currently below the breakpoint, right now. */
function matchesMobile(): boolean {
    // `matchMedia` is absent under SSR and in a bare jsdom, and the answer
    // there is "not mobile" rather than a crash.
    if (typeof window === 'undefined' || !window.matchMedia) {
        return false;
    }
    return window.matchMedia(MOBILE_QUERY).matches;
}

/**
 * True below the single 768px breakpoint (768 itself is desktop). Read during
 * render by `Sidebar` — which mounts a desktop panel or a Sheet on the strength
 * of it — so the value has to be right on the **first** frame. It used to start
 * `undefined` and be filled in from an effect, so a phone got one frame of the
 * desktop layout before the correction.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState<boolean>(matchesMobile);

    React.useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) {
            return;
        }
        const mql = window.matchMedia(MOBILE_QUERY);
        const onChange = (event: MediaQueryListEvent) =>
            setIsMobile(event.matches);
        mql.addEventListener('change', onChange);
        // Re-read in case the viewport moved between the first render and here.
        setIsMobile(mql.matches);
        return () => mql.removeEventListener('change', onChange);
    }, []);

    return isMobile;
}
