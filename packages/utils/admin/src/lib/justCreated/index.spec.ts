import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markJustCreated, useJustCreated } from './index';

describe('useJustCreated', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it('answers true for a marked id, in its own scope only', () => {
        const tokens = renderHook(() => useJustCreated('tokens'));
        const members = renderHook(() => useJustCreated('members'));

        act(() => markJustCreated('tokens', 't1'));

        expect(tokens.result.current('t1')).toBe(true);
        expect(tokens.result.current('t2')).toBe(false);
        expect(members.result.current('t1')).toBe(false);
    });

    it('forgets the mark after a few seconds', () => {
        const { result } = renderHook(() => useJustCreated('webhooks'));
        act(() => markJustCreated('webhooks', 'w1'));
        expect(result.current('w1')).toBe(true);

        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(result.current('w1')).toBe(false);
    });
});
