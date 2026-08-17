import { describe, expect, it } from 'vitest';

import { cn } from './utils';

/** QA ORT-49 · F1 — the class merge every component's `className` prop rides on. */
describe('cn', () => {
    it('lets the later Tailwind class win a conflict', () => {
        expect(cn('px-4', 'px-8')).toBe('px-8');
    });

    it('drops falsy entries and flattens arrays', () => {
        expect(cn(undefined, false, 'a', ['b'])).toBe('a b');
    });

    it('keeps non-conflicting classes from both sides', () => {
        expect(cn('rounded-md px-4', 'px-8')).toBe('rounded-md px-8');
    });

    it('returns an empty string when handed nothing', () => {
        expect(cn()).toBe('');
    });
});
