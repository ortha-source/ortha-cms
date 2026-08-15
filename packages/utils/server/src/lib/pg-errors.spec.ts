import {
    isForeignKeyViolation,
    isUniqueViolation,
    violatedConstraint
} from './pg-errors';

/** A driver error as `pg` shapes it. */
const pgError = (code: string, constraint?: string) =>
    Object.assign(new Error('duplicate key value violates unique constraint'), {
        code,
        ...(constraint === undefined ? {} : { constraint })
    });

describe('violatedConstraint', () => {
    it('names the index a unique violation tripped', () => {
        // The whole reason this exists: a localized content table carries both
        // a `(locale_group_id, locale)` pair and a per-locale one-to-one index,
        // and reporting either as the other sends the caller to fix something
        // that is not wrong.
        expect(
            violatedConstraint(
                pgError('23505', 'content_article_seo_locale_unique')
            )
        ).toBe('content_article_seo_locale_unique');
    });

    it('finds it through a wrapping `cause` chain', () => {
        // Drizzle has wrapped driver errors differently across versions, so the
        // walk is defensive rather than reading the top-level error only.
        const wrapped = Object.assign(new Error('Failed query'), {
            cause: Object.assign(new Error('inner'), {
                cause: pgError('23505', 'content_post_group_locale_unique')
            })
        });
        expect(violatedConstraint(wrapped)).toBe(
            'content_post_group_locale_unique'
        );
    });

    it('returns an empty string for a violation the driver did not attribute', () => {
        // Distinguishable from `undefined`, so one call answers both "is this a
        // unique violation?" and "which one?" without a second pass.
        expect(violatedConstraint(pgError('23505'))).toBe('');
    });

    it('is undefined for any other Postgres error', () => {
        // 23503 is a foreign-key violation — a different failure with a
        // different answer, and it must not be mapped to a unique message.
        expect(violatedConstraint(pgError('23503', 'some_fk'))).toBeUndefined();
    });

    it('is undefined for a non-Postgres error, null, and undefined', () => {
        expect(violatedConstraint(new Error('boom'))).toBeUndefined();
        expect(violatedConstraint(null)).toBeUndefined();
        expect(violatedConstraint(undefined)).toBeUndefined();
    });

    it('stops walking rather than looping on a self-referential cause', () => {
        // A cycle in the chain must not hang the request that is trying to
        // report the failure.
        const looped: { cause?: unknown } = {};
        looped.cause = looped;
        expect(violatedConstraint(looped)).toBeUndefined();
    });
});

describe('isUniqueViolation', () => {
    it('is true for a 23505, attributed or not', () => {
        expect(isUniqueViolation(pgError('23505', 'idx'))).toBe(true);
        expect(isUniqueViolation(pgError('23505'))).toBe(true);
    });

    it('is false for anything else', () => {
        expect(isUniqueViolation(pgError('23503'))).toBe(false);
        expect(isUniqueViolation(new Error('boom'))).toBe(false);
        expect(isUniqueViolation(undefined)).toBe(false);
    });
});

describe('isForeignKeyViolation', () => {
    it('recognises a foreign-key violation', () => {
        // The `ON DELETE RESTRICT` case: something still references the row.
        // It is a refusal the caller can act on, not a server fault.
        expect(
            isForeignKeyViolation(
                pgError('23503', 'content_article_author_id_fkey')
            )
        ).toBe(true);
    });

    it('finds it through a wrapping `cause` chain', () => {
        const wrapped = Object.assign(new Error('Failed query'), {
            cause: pgError('23503', 'content_article_author_id_fkey')
        });
        expect(isForeignKeyViolation(wrapped)).toBe(true);
    });

    it('is false for a unique violation and for a non-Postgres error', () => {
        // The two must not collapse into one another: a duplicate key and a
        // still-referenced row need different answers.
        expect(isForeignKeyViolation(pgError('23505', 'some_unique'))).toBe(
            false
        );
        expect(isForeignKeyViolation(new Error('boom'))).toBe(false);
        expect(isForeignKeyViolation(null)).toBe(false);
        expect(isForeignKeyViolation(undefined)).toBe(false);
    });
});
