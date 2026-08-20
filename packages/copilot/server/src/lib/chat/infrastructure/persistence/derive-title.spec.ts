import { deriveTitle } from './derive-title';

describe('deriveTitle', () => {
    it('uses a short message as-is', () => {
        expect(deriveTitle('Find the launch posts')).toBe(
            'Find the launch posts'
        );
    });

    it('trims surrounding whitespace', () => {
        expect(deriveTitle('  hello  ')).toBe('hello');
    });

    it('collapses newlines so a title never renders as multiple lines', () => {
        expect(deriveTitle('first line\n\nsecond line')).toBe(
            'first line second line'
        );
    });

    it('returns null for an empty or whitespace-only message', () => {
        expect(deriveTitle('')).toBeNull();
        expect(deriveTitle('   \n\t ')).toBeNull();
    });

    it('truncates a long message at a word boundary', () => {
        const title = deriveTitle(
            'Which articles mention the spring launch and were updated in the last two weeks'
        );

        expect(title).toBe(
            'Which articles mention the spring launch and were updated…'
        );
        expect(title?.length).toBeLessThanOrEqual(61);
    });

    // A word-boundary cut is only worth it if it doesn't throw away the budget.
    it('hard-cuts a single very long word rather than truncating to nothing', () => {
        const title = deriveTitle(`short ${'x'.repeat(100)}`);

        expect(title).toBe(`short ${'x'.repeat(54)}…`);
    });

    it('keeps a message of exactly the limit whole, with no ellipsis', () => {
        const exact = 'a'.repeat(60);

        expect(deriveTitle(exact)).toBe(exact);
        // One over is the first character that truncates.
        expect(deriveTitle('a'.repeat(61))).toBe(`${'a'.repeat(60)}…`);
    });

    // The word-boundary rule is `lastSpace > MAX * 0.6`, i.e. > 36. Both sides
    // of that threshold are worth pinning: it is the whole of what stops a long
    // first word from truncating the title to nothing, and it is an inequality
    // one refactor away from being an off-by-one.
    it('cuts at a space past 36 characters, and hard-cuts one at 36', () => {
        // The 61-character message's only space sits at index 37 — past the
        // threshold, so the cut happens there and the tail is dropped.
        const late = `${'a'.repeat(37)} ${'b'.repeat(23)}`;
        expect(deriveTitle(late)).toBe(`${'a'.repeat(37)}…`);

        // Move it one character earlier, to index 36, and it is no longer
        // "most of the budget" — the clip is hard at 60 instead.
        const early = `${'a'.repeat(36)} ${'b'.repeat(24)}`;
        expect(deriveTitle(early)).toBe(`${'a'.repeat(36)} ${'b'.repeat(23)}…`);
    });
});
