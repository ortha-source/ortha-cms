import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_RESET_SLOT, runSessionResets } from './index';

describe('runSessionResets', () => {
    afterEach(() => {
        SESSION_RESET_SLOT._reset();
        vi.restoreAllMocks();
    });

    it('runs every contribution, in registration order', () => {
        const order: string[] = [];
        SESSION_RESET_SLOT._register([
            { id: 'a', reset: () => order.push('a') },
            { id: 'b', reset: () => order.push('b') }
        ]);

        runSessionResets();

        expect(order).toEqual(['a', 'b']);
    });

    // One plugin failing to let go must not leave the next plugin's state in
    // place for the incoming account.
    it('keeps going past a reset that throws', () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const after = vi.fn();
        SESSION_RESET_SLOT._register([
            {
                id: 'broken',
                reset: () => {
                    throw new Error('nope');
                }
            },
            { id: 'after', reset: after }
        ]);

        expect(() => runSessionResets()).not.toThrow();
        expect(after).toHaveBeenCalledOnce();
        expect(error).toHaveBeenCalledOnce();
    });

    it('does nothing when no plugin holds session state', () => {
        expect(() => runSessionResets()).not.toThrow();
    });
});
