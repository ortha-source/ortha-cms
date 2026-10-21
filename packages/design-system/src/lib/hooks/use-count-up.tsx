import * as React from 'react';
import { prefersReducedMotion } from './use-reduced-motion';

/** Options for {@link useCountUp}. */
export type CountUpOptions = {
    /** How long the count runs, in milliseconds. Defaults to 600. */
    duration?: number;
};

const DEFAULT_DURATION = 600;

/**
 * Whether a JavaScript count can run here at all. No `requestAnimationFrame`
 * or `matchMedia` (SSR, a bare jsdom) means no way to animate or no way to ask
 * whether the reader wants it; a hidden tab would freeze the count mid-way; and
 * `prefers-reduced-motion` asked for none. Each answers "show the number".
 */
function canAnimate(): boolean {
    if (typeof window === 'undefined') return false;
    if (typeof window.requestAnimationFrame !== 'function') return false;
    if (typeof window.matchMedia !== 'function') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    return !prefersReducedMotion();
}

/** Fast out of the gate, settling gently onto the figure. */
function easeOutCubic(progress: number): number {
    return 1 - (1 - progress) ** 3;
}

/** Decimal places in `value`, so an integer never counts through fractions. */
function decimalsOf(value: number): number {
    if (Number.isInteger(value)) return 0;
    const [, fraction = ''] = String(value).split('.');
    return Math.min(fraction.length, 6);
}

/**
 * A number that counts from where it was to `target` — from 0 on mount — over
 * `duration` with an ease-out curve, one `requestAnimationFrame` at a time.
 * Returns the figure to *draw*; intermediate values keep the target's
 * precision, so `42` counts through integers.
 *
 * It is a visual flourish and nothing more. The returned value is in between
 * for most of a second, so it must never be what assistive technology reads —
 * pair it with the final value in an `sr-only` span ({@link CountUp} does).
 * And it snaps straight to `target` under `prefers-reduced-motion: reduce`, in
 * a hidden tab (including one hidden mid-count), and wherever the browser APIs
 * it needs are missing.
 *
 * A change of `target` mid-count continues from the figure on screen rather
 * than jumping back to the old start.
 */
export function useCountUp(
    target: number,
    { duration = DEFAULT_DURATION }: CountUpOptions = {}
): number {
    const [shown, setShown] = React.useState(() =>
        Number.isFinite(target) && canAnimate() ? 0 : target
    );
    const shownRef = React.useRef(shown);

    React.useEffect(() => {
        const from = shownRef.current;
        const show = (value: number) => {
            shownRef.current = value;
            setShown(value);
        };

        if (
            from === target ||
            !Number.isFinite(target) ||
            !Number.isFinite(from) ||
            duration <= 0 ||
            !canAnimate()
        ) {
            show(target);
            return;
        }

        const factor = 10 ** decimalsOf(target);
        let frame = 0;
        let start: number | undefined;

        const tick = (now: number) => {
            start ??= now;
            const progress = Math.min(1, (now - start) / duration);
            if (progress >= 1) {
                show(target);
                return;
            }
            const value = from + (target - from) * easeOutCubic(progress);
            show(Math.round(value * factor) / factor);
            frame = window.requestAnimationFrame(tick);
        };
        frame = window.requestAnimationFrame(tick);

        // A background tab stops delivering frames, so the count would sit
        // half-way until the reader came back. Finish it instead.
        const onVisibilityChange = () => {
            if (!document.hidden) return;
            window.cancelAnimationFrame(frame);
            show(target);
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            window.cancelAnimationFrame(frame);
            document.removeEventListener(
                'visibilitychange',
                onVisibilityChange
            );
        };
    }, [target, duration]);

    return shown;
}
