import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CountUp } from '../components/ui/count-up';
import { useCountUp } from './use-count-up';
import { REDUCED_MOTION_QUERY } from './use-reduced-motion';

/**
 * The count-up is decoration over a fact, and the two halves pinned here are
 * the ones no page test can stage: a reader who asked for less motion (the e2e
 * harness does not emulate it) gets the figure on the first frame, and the
 * figure assistive technology reads is never one of the in-between ones.
 *
 * Frames are driven by hand — a queued `requestAnimationFrame` flushed at a
 * chosen timestamp — so "half-way" is a moment the test picks, not a race.
 */
let queue: FrameRequestCallback[] = [];
const originalRaf = window.requestAnimationFrame;
const originalCancel = window.cancelAnimationFrame;
const originalMatchMedia = window.matchMedia;

function setReducedMotion(reduced: boolean) {
    window.matchMedia = ((query: string) => ({
        matches: reduced && query === REDUCED_MOTION_QUERY,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}

/** Run every queued frame at `time` ms. */
function flushFrame(time: number) {
    const pending = queue;
    queue = [];
    act(() => {
        for (const callback of pending) callback(time);
    });
}

/** Every value the probe drew, in render order — index 0 is the first frame. */
const drawn: number[] = [];

function Probe({ target }: { target: number }) {
    const value = useCountUp(target);
    drawn.push(value);
    return <span data-testid="out">{value}</span>;
}

const out = () => Number(screen.getByTestId('out').textContent);

beforeEach(() => {
    queue = [];
    drawn.length = 0;
    window.requestAnimationFrame = (callback) => {
        queue.push(callback);
        return queue.length;
    };
    window.cancelAnimationFrame = () => {
        queue = [];
    };
    setReducedMotion(false);
});

afterEach(() => {
    window.requestAnimationFrame = originalRaf;
    window.cancelAnimationFrame = originalCancel;
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
});

describe('useCountUp', () => {
    it('counts from 0 through whole numbers to the target, easing out', () => {
        render(<Probe target={42} />);
        expect(drawn[0]).toBe(0);

        flushFrame(0);
        flushFrame(300);
        const halfway = out();
        expect(Number.isInteger(halfway)).toBe(true);
        // Ease-out: past the linear midpoint by half-time, short of the end.
        expect(halfway).toBeGreaterThan(21);
        expect(halfway).toBeLessThan(42);

        flushFrame(600);
        expect(out()).toBe(42);
        expect(queue).toHaveLength(0);
    });

    it('continues from the figure on screen when the target changes', () => {
        const { rerender } = render(<Probe target={100} />);
        flushFrame(0);
        flushFrame(300);
        const reached = out();

        rerender(<Probe target={10} />);
        flushFrame(1000);
        // The new count starts where the old one was, not back at 0.
        expect(out()).toBe(reached);
        flushFrame(1600);
        expect(out()).toBe(10);
    });

    it('draws the final value on the first frame under reduced motion', () => {
        setReducedMotion(true);
        render(<Probe target={42} />);

        expect(drawn[0]).toBe(42);
        expect(queue).toHaveLength(0);
    });

    it('draws the final value on the first frame without requestAnimationFrame', () => {
        // @ts-expect-error — a bare jsdom has no rAF at all.
        window.requestAnimationFrame = undefined;
        render(<Probe target={42} />);

        expect(drawn[0]).toBe(42);
    });

    it('draws the final value on the first frame in a hidden tab', () => {
        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        render(<Probe target={42} />);

        expect(drawn[0]).toBe(42);
        expect(queue).toHaveLength(0);
    });

    it('finishes at once when the tab is hidden mid-count', () => {
        render(<Probe target={42} />);
        flushFrame(0);
        flushFrame(100);
        expect(out()).toBeLessThan(42);

        vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        act(() => {
            document.dispatchEvent(new Event('visibilitychange'));
        });
        expect(out()).toBe(42);
    });
});

describe('CountUp', () => {
    const format = (value: number) =>
        new Intl.NumberFormat('en-US').format(value);

    it('exposes only the final value to assistive technology while counting', () => {
        const { container } = render(
            <span>
                <CountUp value={1234} format={format} />
            </span>
        );
        flushFrame(0);
        flushFrame(200);

        const moving = container.querySelector('[aria-hidden="true"]');
        expect(moving?.textContent).not.toBe('1,234');
        // The final figure, formatted, is in the document the whole time —
        // and it is the only text a screen reader is not told to skip.
        expect(screen.getByText('1,234').className).toContain('sr-only');
    });

    it('settles into a single plain text node once it lands', () => {
        const { container } = render(
            <span data-testid="value">
                <CountUp value={1234} format={format} />
            </span>
        );
        flushFrame(0);
        flushFrame(600);

        expect(container.querySelector('[aria-hidden]')).toBeNull();
        expect(container.querySelector('.sr-only')).toBeNull();
        expect(screen.getByTestId('value').textContent).toBe('1,234');
    });

    it('renders the formatted final value straight away under reduced motion', () => {
        setReducedMotion(true);
        render(
            <span data-testid="value">
                <CountUp value={1234} format={format} />
            </span>
        );

        expect(screen.getByTestId('value').textContent).toBe('1,234');
        expect(screen.getByTestId('value').children).toHaveLength(0);
    });
});
