import { describe, expect, it } from 'vitest';
import { SYNC_VALUE_MAX_LENGTH, formatSyncValue } from './index';

describe('formatSyncValue', () => {
    it('prints what reads as a value', () => {
        expect(formatSyncValue('news')).toBe('news');
        expect(formatSyncValue(7)).toBe('7');
        expect(formatSyncValue(false)).toBe('false');
        expect(formatSyncValue(['red', 'blue'])).toBe('red, blue');
    });

    it('prints an empty value as empty, for the row to show as a dash', () => {
        expect(formatSyncValue(null)).toBe('');
        expect(formatSyncValue(undefined)).toBe('');
        expect(formatSyncValue('')).toBe('');
    });

    it('declines what nobody compares by eye', () => {
        expect(formatSyncValue({ type: 'doc', content: [] })).toBeNull();
        expect(
            formatSyncValue('x'.repeat(SYNC_VALUE_MAX_LENGTH + 1))
        ).toBeNull();
        expect(formatSyncValue([1, 2])).toBeNull();
    });
});
