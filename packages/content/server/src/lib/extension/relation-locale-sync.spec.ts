import { collection } from '../collection/define';
import { field } from '../fields';
import {
    RELATION_LOCALE_SYNC,
    isJoinBackedRelation,
    isPerLocaleField,
    relationLocaleSync
} from './relation-locale-sync';
import type { AnyContentType } from '../types/content-type';

/** A plain, non-localized target — `tag` has no locales of its own. */
const tag = collection('tag', { fields: { name: field.text() } });

/** A localized target: each of its rows is one language of the same record. */
const author = collection('author', {
    i18n: true,
    fields: { name: field.text() }
});

const article = collection('article', {
    i18n: true,
    fields: {
        title: field.text({ localized: true }),
        subtitle: field.text(),
        // single → non-localized target
        primaryTag: field.relation({ to: () => tag }),
        // single → localized target
        writer: field.relation({ to: () => author }),
        // many → non-localized target
        tags: field.relation({ to: () => tag, many: true }),
        // many → localized target
        writers: field.relation({ to: () => author, many: true }),
        // opted out
        featuredTag: field.relation({ to: () => tag, syncAcrossLocales: false }),
        // opted out via the `localized` alias
        localTag: field.relation({ to: () => tag, localized: true }),
        // the inverse side owns no storage
        related: field.relationInverse({
            of: (): AnyContentType => article,
            field: 'tags'
        })
    }
});

/** A type with no locales at all — every relation on it is inert. */
const plain = collection('plain', {
    fields: {
        tag: field.relation({ to: () => tag }),
        tags: field.relation({ to: () => tag, many: true })
    }
});

const modeOf = (type: typeof article | typeof plain, name: string) =>
    relationLocaleSync(type, type.fields[name]);

describe('relationLocaleSync', () => {
    it('shares a relation whose target has no locales', () => {
        // One tag row is the record for every language, so every sibling holds
        // the same id — cardinality makes no difference to that.
        expect(modeOf(article, 'primaryTag')).toBe(RELATION_LOCALE_SYNC.Shared);
        expect(modeOf(article, 'tags')).toBe(RELATION_LOCALE_SYNC.Shared);
    });

    it('mirrors a relation whose target is itself localized', () => {
        // Each sibling has to name the target's row in its OWN language; a
        // shared id here would be a cross-locale link.
        expect(modeOf(article, 'writer')).toBe(RELATION_LOCALE_SYNC.Mirrored);
        expect(modeOf(article, 'writers')).toBe(RELATION_LOCALE_SYNC.Mirrored);
    });

    it('does not propagate a relation the author opted out of', () => {
        expect(modeOf(article, 'featuredTag')).toBe(RELATION_LOCALE_SYNC.None);
    });

    it('reads localized: true on a relation as the opt-out', () => {
        // The two say the same thing, so `localized` sets the default rather
        // than being honoured as a second, separate flag.
        expect(modeOf(article, 'localTag')).toBe(RELATION_LOCALE_SYNC.None);
    });

    it('never propagates from the inverse side', () => {
        // An inverse reuses the owning side's rows, so syncing from both ends
        // would write the same links twice.
        expect(modeOf(article, 'related')).toBe(RELATION_LOCALE_SYNC.None);
    });

    it('is inert on a type with no locale siblings', () => {
        expect(modeOf(plain, 'tag')).toBe(RELATION_LOCALE_SYNC.None);
        expect(modeOf(plain, 'tags')).toBe(RELATION_LOCALE_SYNC.None);
    });

    it('is None for a field that is not a relation', () => {
        expect(relationLocaleSync(article, article.fields['title'])).toBe(
            RELATION_LOCALE_SYNC.None
        );
    });
});

describe('isPerLocaleField', () => {
    it('is true for an explicitly localized scalar', () => {
        expect(isPerLocaleField(article, article.fields['title'])).toBe(true);
    });

    it('is false for an unmarked scalar', () => {
        expect(isPerLocaleField(article, article.fields['subtitle'])).toBe(
            false
        );
    });

    it('is false for a shared relation — every sibling holds the same id', () => {
        expect(isPerLocaleField(article, article.fields['primaryTag'])).toBe(
            false
        );
        expect(isPerLocaleField(article, article.fields['tags'])).toBe(false);
    });

    it('is true for a mirrored relation, which is per-locale AND propagated', () => {
        // The two are not in tension: the id differs per row precisely so that
        // every row points at the right translation.
        expect(isPerLocaleField(article, article.fields['writer'])).toBe(true);
        expect(relationLocaleSync(article, article.fields['writer'])).toBe(
            RELATION_LOCALE_SYNC.Mirrored
        );
    });

    it('is true for a relation that does not propagate', () => {
        expect(isPerLocaleField(article, article.fields['featuredTag'])).toBe(
            true
        );
    });

    it('is false for an inverse, which stores nothing of its own', () => {
        expect(isPerLocaleField(article, article.fields['related'])).toBe(
            false
        );
    });

    it('is false for any relation on a type with no locales', () => {
        expect(isPerLocaleField(plain, plain.fields['tag'])).toBe(false);
    });
});

describe('isJoinBackedRelation', () => {
    it('is true only for an owning many-relation', () => {
        expect(isJoinBackedRelation(article.fields['tags'])).toBe(true);
        expect(isJoinBackedRelation(article.fields['primaryTag'])).toBe(false);
    });

    it('excludes the inverse, which owns no writable link from its side', () => {
        expect(isJoinBackedRelation(article.fields['related'])).toBe(false);
    });

    it('is false for a non-relation field', () => {
        expect(isJoinBackedRelation(article.fields['title'])).toBe(false);
    });
});
