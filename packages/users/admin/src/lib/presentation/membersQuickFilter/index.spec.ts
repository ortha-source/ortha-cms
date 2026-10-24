import { describe, expect, it } from 'vitest';
import { quickFilterCount, quickFilterFrom, quickFilterParams } from '.';

const COUNTS = { everyone: 7, active: 5, admins: 2, invited: 1, disabled: 1 };

describe('members quick filters', () => {
    it('maps each chip to the list parameter it stands for', () => {
        expect(quickFilterParams('everyone')).toEqual({});
        expect(quickFilterParams('admins')).toEqual({ role: 'admin' });
        expect(quickFilterParams('invited')).toEqual({ status: 'pending' });
        expect(quickFilterParams('disabled')).toEqual({ status: 'disabled' });
    });

    it('reads an unknown or missing URL value as everyone', () => {
        expect(quickFilterFrom(null)).toBe('everyone');
        expect(quickFilterFrom('owners')).toBe('everyone');
        expect(quickFilterFrom('invited')).toBe('invited');
    });

    it('counts each chip from the directory totals', () => {
        expect(quickFilterCount('everyone', COUNTS)).toBe(7);
        expect(quickFilterCount('admins', COUNTS)).toBe(2);
        expect(quickFilterCount('invited', COUNTS)).toBe(1);
    });
});
