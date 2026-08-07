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
});
