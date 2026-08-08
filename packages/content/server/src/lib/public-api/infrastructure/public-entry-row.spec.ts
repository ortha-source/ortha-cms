import { collection, single } from '../../collection/define';
import { field } from '../../fields';
import { toPublicEntry } from './public-entry-row';

const CREATED = new Date('2026-01-01T00:00:00.000Z');
const UPDATED = new Date('2026-02-01T00:00:00.000Z');
const PUBLISHED = new Date('2026-03-01T00:00:00.000Z');

/** The envelope columns every generated row carries. */
const envelope = {
    id: 'entry-1',
    workspaceId: 'ws-1',
    createdAt: CREATED,
    updatedAt: UPDATED
};

const author = collection('pub_author', {
    fields: { name: field.text({}) }
});

const tag = collection('pub_tag', { fields: { name: field.text({}) } });

const post = collection('pub_post', {
    publishable: true,
    paranoid: true,
    fields: {
        title: field.text({}),
        views: field.number({}),
        labels: field.multiselect({ options: ['a', 'b'] as const }),
        cover: field.media({}),
        // Owning single relation: a plain FK column, so it rides `values`.
        author: field.relation({ to: () => author }),
        // Owning many-relation: links live in a join table — no column.
        tags: field.relation({ to: () => tag, many: true }),
        // Inverse: reuses the owning side's storage — no column either.
        related: field.relationInverse({ of: () => post, field: 'author' })
    }
});

const homePage = single('pub_home', {
    path: '/',
    fields: { heading: field.text({}) }
});

describe('toPublicEntry', () => {
    it('projects the envelope and every pure-value field', () => {
        const entry = toPublicEntry(post, {
            ...envelope,
            status: 'published',
            publishedAt: PUBLISHED,
            deletedAt: null,
            title: 'Hello',
            views: 12,
            labels: ['a'],
            cover: 'asset-1',
            author: 'author-1'
        });

        // Exact equality, so a reference field leaking back in fails here.
        expect(entry).toEqual({
            id: 'entry-1',
            createdAt: CREATED.toISOString(),
            updatedAt: UPDATED.toISOString(),
            publishedAt: PUBLISHED.toISOString(),
            values: {
                title: 'Hello',
                views: 12,
                // `multiselect` is a plain jsonb bag of the entry's own data,
                // not a reference — it stays.
                labels: ['a']
            }
        });
    });

    it('omits every relation, whatever its cardinality', () => {
        const entry = toPublicEntry(post, {
            ...envelope,
            status: 'published',
            publishedAt: PUBLISHED,
            title: 'Hello',
            author: 'author-1'
        });

        // Owning single (an FK column that *is* on the row), owning many (a
        // join table), and inverse (the owning side's storage) alike.
        expect(entry.values).not.toHaveProperty('author');
        expect(entry.values).not.toHaveProperty('tags');
        expect(entry.values).not.toHaveProperty('related');
    });

    it('omits media fields', () => {
        const entry = toPublicEntry(post, {
            ...envelope,
            status: 'published',
            publishedAt: PUBLISHED,
            title: 'Hello',
            cover: 'asset-1'
        });

        // An asset id in the media plugin's store — nothing here resolves it.
        expect(entry.values).not.toHaveProperty('cover');
    });

    it('never exposes the workspace, the status, or the tombstone', () => {
        const entry = toPublicEntry(post, {
            ...envelope,
            status: 'published',
            publishedAt: PUBLISHED,
            deletedAt: null,
            title: 'Hello'
        });

        expect(entry).not.toHaveProperty('workspaceId');
        expect(entry).not.toHaveProperty('status');
        expect(entry).not.toHaveProperty('deletedAt');
        expect(entry.values).not.toHaveProperty('workspaceId');
    });

    it('reads an unset field back as null, not a missing key', () => {
        const entry = toPublicEntry(post, {
            ...envelope,
            status: 'published',
            publishedAt: PUBLISHED,
            title: null,
            views: null,
            labels: null,
            cover: null,
            author: null
        });

        expect(entry.values).toEqual({
            title: null,
            views: null,
            labels: null
        });
    });

    it('narrows values to a field selection, keeping the whole envelope', () => {
        const entry = toPublicEntry(
            post,
            {
                ...envelope,
                status: 'published',
                publishedAt: PUBLISHED,
                title: 'Hello',
                views: 12
            },
            new Set(['title'])
        );

        expect(entry.values).toEqual({ title: 'Hello' });
        // The envelope is not selectable — `id` in particular is what makes an
        // entry addressable, so a selection can never drop it.
        expect(entry.id).toBe('entry-1');
        expect(entry.publishedAt).toBe(PUBLISHED.toISOString());
    });

    it('omits an unselected field rather than reporting it as null', () => {
        // The row genuinely lacks the column (the query never selected it).
        // Emitting `views: null` would read as "this entry has no views"
        // instead of "you didn't ask for it".
        const entry = toPublicEntry(
            post,
            {
                ...envelope,
                status: 'published',
                publishedAt: PUBLISHED,
                title: 'Hello'
            },
            new Set(['title'])
        );

        expect(entry.values).not.toHaveProperty('views');
    });

    it('omits publishedAt on a non-publishable type', () => {
        const entry = toPublicEntry(homePage, {
            ...envelope,
            heading: 'Welcome'
        });

        expect(entry).not.toHaveProperty('publishedAt');
        expect(entry.values).toEqual({ heading: 'Welcome' });
    });

    it('carries the locale and its translation group on an i18n type', () => {
        const localized = collection('pub_localized', {
            i18n: true,
            fields: { title: field.text({ localized: true }) }
        });

        const entry = toPublicEntry(localized, {
            ...envelope,
            locale: 'fr',
            localeGroupId: 'group-1',
            title: 'Bonjour'
        });

        expect(entry.locale).toBe('fr');
        expect(entry.localeGroupId).toBe('group-1');
    });
});
