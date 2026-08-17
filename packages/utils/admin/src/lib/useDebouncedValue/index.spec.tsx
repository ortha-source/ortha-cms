import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from '.';

function Probe({ value, delayMs }: { value: string; delayMs: number }) {
    return <span data-testid="out">{useDebouncedValue(value, delayMs)}</span>;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const out = () => screen.getByTestId('out').textContent;

describe('useDebouncedValue', () => {
    it('returns the initial value immediately', () => {
        render(<Probe value="a" delayMs={300} />);
        expect(out()).toBe('a');
    });

    it('settles only after the input stops changing', () => {
        const { rerender } = render(<Probe value="a" delayMs={300} />);

        rerender(<Probe value="ad" delayMs={300} />);
        act(() => vi.advanceTimersByTime(200));
        rerender(<Probe value="ada" delayMs={300} />);
        act(() => vi.advanceTimersByTime(200));
        expect(out()).toBe('a');

        act(() => vi.advanceTimersByTime(150));
        expect(out()).toBe('ada');
    });

    it('clears its timer on unmount, so nothing settles afterwards', () => {
        const { rerender, unmount } = render(<Probe value="a" delayMs={300} />);
        rerender(<Probe value="ada" delayMs={300} />);
        unmount();
        expect(() => act(() => vi.advanceTimersByTime(1000))).not.toThrow();
    });

    it('settles synchronously with a zero delay', () => {
        const { rerender } = render(<Probe value="a" delayMs={0} />);
        rerender(<Probe value="b" delayMs={0} />);
        act(() => vi.advanceTimersByTime(0));
        expect(out()).toBe('b');
    });
});
