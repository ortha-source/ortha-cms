import { UnprocessableEntityException } from '@nestjs/common';
import { collection } from '../../../collection/define';
import { field } from '../../../fields';
import type { AnyContentType } from '../../../types/content-type';
import { assertSameLocale } from './relation-link.service';

/**
 * `assertSameLocale` is the whole cross-locale link rule, extracted so both the
 * join-table paths and the single-FK path apply one implementation. Pure — no
 * DB, no Nest container — so the rule itself is asserted here and the e2e is
 * left to prove it is actually *reached* from each write path.
 */
const localized: AnyContentType = collection('localized_tag', {
    i18n: true,
    fields: { name: field.text() }
});

const plain: AnyContentType = collection('plain_tag', {
    fields: { name: field.text() }
});

/** A target row as the existence probe returns it. */
function row(id: string, locale?: string): Record<string, unknown> {
    return locale === undefined ? { id } : { id, locale };
}

describe('assertSameLocale', () => {
    it('accepts targets in the source’s own locale', () => {
        expect(() =>
            assertSameLocale(
                [row('a', 'en'), row('b', 'en')],
                localized,
                'tags',
                'en'
            )
        ).not.toThrow();
    });

    it('rejects a target in another locale, naming both sides [content:I-19]', () => {
        let caught: UnprocessableEntityException | undefined;
        try {
            assertSameLocale([row('a', 'de')], localized, 'tags', 'en');
        } catch (error) {
            caught = error as UnprocessableEntityException;
        }

        expect(caught).toBeInstanceOf(UnprocessableEntityException);
        const body = caught?.getResponse() as {
            issues: { field: string; message: string }[];
        };
        expect(body.issues).toHaveLength(1);
        expect(body.issues[0].field).toBe('tags');
        // The message has to carry the locale the caller needs and the id that
        // was wrong — "invalid relation" would leave them guessing which of a
        // batch of ids to fix.
        expect(body.issues[0].message).toContain('"en"');
        expect(body.issues[0].message).toContain('"a"');
        expect(body.issues[0].message).toContain('"de"');
    });

    it('reports every offending target, not just the first', () => {
        let caught: UnprocessableEntityException | undefined;
        try {
            assertSameLocale(
                [row('a', 'en'), row('b', 'de'), row('c', 'fr')],
                localized,
                'tags',
                'en'
            );
        } catch (error) {
            caught = error as UnprocessableEntityException;
        }
        const body = caught?.getResponse() as { issues: unknown[] };
        expect(body.issues).toHaveLength(2);
    });

    it('is a no-op when the source is not localized', () => {
        // A non-i18n owner passes `undefined` — it has no locale, so there is
        // nothing for a target to disagree with.
        expect(() =>
            assertSameLocale([row('a', 'de')], localized, 'tags', undefined)
        ).not.toThrow();
    });

    it('is a no-op when the target type is not localized', () => {
        // A shared target (an author, an SEO record) is legitimately linked from
        // every translation of a record — that is the point of not localizing it.
        expect(() =>
            assertSameLocale([row('a')], plain, 'author', 'en')
        ).not.toThrow();
    });
});
