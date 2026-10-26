import { describe, expect, it } from 'vitest';
import { shortNameOf } from '.';

describe('shortNameOf', () => {
    it('takes the first word of a display name', () => {
        expect(shortNameOf({ name: 'Grace Hopper', email: 'grace@x.io' })).toBe(
            'Grace'
        );
    });

    it('keeps a pending member’s address whole', () => {
        expect(
            shortNameOf({ name: 'lena@growth.io', email: 'lena@growth.io' })
        ).toBe('lena@growth.io');
    });
});
