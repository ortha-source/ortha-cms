import {
    isValidSegment,
    validateSegment,
    SEGMENT_ISSUE,
    SEGMENT_TAGS_MAX
} from './validation';

/** A draft with nothing wrong with it. */
const good = { key: 'acme', label: 'Acme Corp', tags: ['acme'] };

describe('validateSegment', () => {
    it('accepts a well-formed draft', () => {
        expect(isValidSegment(validateSegment(good))).toBe(true);
    });

    it('reports every bad field at once, not just the first', () => {
        const issues = validateSegment({
            key: 'Acme Corp',
            label: '  ',
            tags: []
        });
        expect(issues.key).toBe(SEGMENT_ISSUE.Malformed);
        expect(issues.label).toBe(SEGMENT_ISSUE.Required);
    });

    describe('key', () => {
        it('refuses spaces and capitals — it is also the default reader tag', () => {
            expect(validateSegment({ ...good, key: 'Acme Corp' }).key).toBe(
                SEGMENT_ISSUE.Malformed
            );
            expect(validateSegment({ ...good, key: 'ACME' }).key).toBe(
                SEGMENT_ISSUE.Malformed
            );
        });

        it('refuses a leading separator', () => {
            expect(validateSegment({ ...good, key: '-acme' }).key).toBe(
                SEGMENT_ISSUE.Malformed
            );
        });

        it('accepts the separators a real identifier uses', () => {
            for (const key of [
                'acme-corp',
                'acme_corp',
                'acme.corp',
                'plan2'
            ]) {
                expect(validateSegment({ ...good, key }).key).toBeUndefined();
            }
        });

        it('catches the collision the server answers 409 for', () => {
            expect(validateSegment(good, ['acme']).key).toBe(
                SEGMENT_ISSUE.Duplicate
            );
        });

        /** Editing sends no key, so there is nothing to check. */
        it('is not checked when absent', () => {
            expect(
                validateSegment({ label: 'Acme', tags: [] }, ['acme']).key
            ).toBeUndefined();
        });
    });

    describe('tags', () => {
        it('drops blanks rather than refusing them', () => {
            // What a trailing newline in a pasted list produces.
            expect(
                validateSegment({ ...good, tags: ['acme', '', '  '] }).tags
            ).toBeUndefined();
        });

        it('refuses the same tag twice', () => {
            expect(
                validateSegment({ ...good, tags: ['acme', 'acme'] }).tags
            ).toBe(SEGMENT_ISSUE.Duplicate);
        });

        it('refuses more than the cap', () => {
            const tags = Array.from(
                { length: SEGMENT_TAGS_MAX + 1 },
                (_, index) => `tag-${index}`
            );
            expect(validateSegment({ ...good, tags }).tags).toBe(
                SEGMENT_ISSUE.TooMany
            );
        });

        it('accepts an empty list — the key becomes the tag', () => {
            expect(validateSegment({ ...good, tags: [] }).tags).toBeUndefined();
        });
    });
});
