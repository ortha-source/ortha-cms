import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './use-mobile';

/**
 * QA ORT-49 · F56, EC-12, EC-29 — the single 768px breakpoint.
 *
 * The artifact claims the hook "is initialised from `matchMedia`, so there is
 * no `undefined` first frame". It was not: state started `undefined` and was
 * filled in from an effect, so the *first* render always reported desktop and
 * `Sidebar` mounted its desktop panel for a frame on a phone.
 */
/** Every value the hook returned, in render order — index 0 is the first frame. */
const frames: boolean[] = [];

function Probe() {
    const isMobile = useIsMobile();
    frames.push(isMobile);
    return <span data-testid="out">{String(isMobile)}</span>;
}

const out = () => screen.getByTestId('out').textContent;

function setViewport(width: number) {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: width
    });
    window.matchMedia = ((query: string) => ({
        matches: width < 768,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false
    })) as typeof window.matchMedia;
}

beforeEach(() => {
    frames.length = 0;
});

afterEach(() => setViewport(1024));

describe('useIsMobile', () => {
    it('reports desktop above the breakpoint', () => {
        setViewport(1024);
        render(<Probe />);
        expect(out()).toBe('false');
    });

    // EC-12 — the query is `(max-width: 767px)`, so 768 is desktop.
    it('treats exactly 768px as desktop', () => {
        setViewport(768);
        render(<Probe />);
        expect(out()).toBe('false');
    });

    it('reports mobile below the breakpoint', () => {
        setViewport(500);
        render(<Probe />);
        expect(out()).toBe('true');
    });

    // The value that decides whether `Sidebar` mounts a desktop panel or a
    // Sheet is read during render, not after the effects — so the *first*
    // frame is the one that matters. It reported desktop on every device.
    it('reports mobile on the very first frame, before any effect runs', () => {
        setViewport(500);
        render(<Probe />);
        expect(frames[0]).toBe(true);
    });

    // EC-29 — jsdom without a polyfill, and any environment where the API is
    // absent, must render rather than throw.
    it('falls back to desktop when matchMedia is unavailable', () => {
        setViewport(500);
        const original = window.matchMedia;
        // @ts-expect-error deliberately removing the API under test
        delete window.matchMedia;

        try {
            expect(() => render(<Probe />)).not.toThrow();
        } finally {
            window.matchMedia = original;
        }
    });

    it('subscribes to the media query and unsubscribes on unmount', () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        window.matchMedia = ((query: string) => ({
            matches: false,
            media: query,
            onchange: null,
            addEventListener,
            removeEventListener,
            addListener: () => undefined,
            removeListener: () => undefined,
            dispatchEvent: () => false
        })) as typeof window.matchMedia;

        const { unmount } = render(<Probe />);
        expect(addEventListener).toHaveBeenCalledWith(
            'change',
            expect.any(Function)
        );

        unmount();
        expect(removeEventListener).toHaveBeenCalledWith(
            'change',
            expect.any(Function)
        );
    });
});
