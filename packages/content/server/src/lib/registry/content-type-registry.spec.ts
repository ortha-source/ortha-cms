import { collection, single } from '../collection/define';
import { field } from '../fields';
import { ContentTypeRegistry } from './content-type-registry';
import type { AnyContentType } from '../types/content-type';

const author = collection('author', { fields: { name: field.text() } });
const tag = collection('tag', { fields: { name: field.text() } });
const post = collection('post', {
    fields: {
        title: field.text({ required: true }),
        author: field.relation({ to: () => author, onDelete: 'restrict' }),
        tags: field.relation({ to: () => tag, many: true })
    }
});
const home = single('home', {
    path: '/',
    description: 'Landing',
    fields: { headline: field.text() }
});

describe('ContentTypeRegistry', () => {
    it('throws on duplicate type names', () => {
        const dup = collection('author', { fields: { name: field.text() } });
        expect(() => new ContentTypeRegistry([author, dup])).toThrow(
            /Duplicate content type "author"/
        );
    });

    it('throws when a relation targets an unregistered type', () => {
        // `post` references `author` and `tag`, but only `post` is registered.
        expect(() => new ContentTypeRegistry([post])).toThrow(
            /not registered with ContentPlugin/
        );
    });

    it('constructs when every relation target is registered', () => {
        expect(
            () => new ContentTypeRegistry([author, tag, post, home])
        ).not.toThrow();
    });

    describe('serialization', () => {
        const registry = new ContentTypeRegistry([author, tag, post, home]);

        it('summarizes every type, carrying single()-only path', () => {
            const summaries = registry.summaries();
            expect(summaries.map((s) => s.name).sort()).toEqual([
                'author',
                'home',
                'post',
                'tag'
            ]);
            expect(summaries.find((s) => s.name === 'home')).toMatchObject({
                kind: 'single',
                path: '/',
                description: 'Landing'
            });
        });

        it('reports onDelete + unique for a single relation but omits them for a many relation', () => {
            const fields = registry.serialize('post')!.fields;
            const byName = Object.fromEntries(fields.map((x) => [x.name, x]));

            expect(byName['author'].relation).toEqual({
                to: 'author',
                many: false,
                onDelete: 'restrict',
                unique: false
            });
            expect(byName['tags'].relation).toEqual({
                to: 'tag',
                many: true
            });
            expect(byName['tags'].relation?.onDelete).toBeUndefined();
            expect(byName['tags'].relation?.unique).toBeUndefined();
        });

        it('returns undefined for an unknown type', () => {
            expect(registry.serialize('nope')).toBeUndefined();
        });

        it('carries the i18n flag on summaries and localized on fields', () => {
            const doc = collection('doc', {
                i18n: true,
                fields: {
                    title: field.text({ localized: true }),
                    slug: field.text()
                }
            });
            const reg = new ContentTypeRegistry([doc]);
            expect(reg.summaries()[0].i18n).toBe(true);
            const fields = reg.serialize('doc')!.fields;
            const byName = Object.fromEntries(fields.map((x) => [x.name, x]));
            expect(byName['title'].localized).toBe(true);
            // Omitted (not false) for a non-localized field.
            expect(byName['slug'].localized).toBeUndefined();
        });

        it('reports i18n false on a non-localized type', () => {
            expect(
                registry.summaries().find((s) => s.name === 'post')?.i18n
            ).toBe(false);
        });

        it('serializes a single relation to an i18n target as localized (per-locale)', () => {
            const locAuthor = collection('loc_author', {
                i18n: true,
                fields: { name: field.text() }
            });
            const plainTag = collection('plain_tag', {
                fields: { name: field.text() }
            });
            // An i18n owner relating to an i18n target (per-locale) and to a
            // non-i18n target (stays shared).
            const locPost = collection('loc_post', {
                i18n: true,
                fields: {
                    title: field.text({ localized: true }),
                    author: field.relation({ to: () => locAuthor }),
                    tag: field.relation({ to: () => plainTag })
                }
            });
            const reg = new ContentTypeRegistry([locAuthor, plainTag, locPost]);
            const byName = Object.fromEntries(
                reg.serialize('loc_post')!.fields.map((x) => [x.name, x])
            );
            // Relation → i18n target: derived localized.
            expect(byName['author'].localized).toBe(true);
            // Relation → non-i18n target: stays shared (omitted).
            expect(byName['tag'].localized).toBeUndefined();
        });

        it('does not derive localized for a relation on a non-i18n owner', () => {
            const locTarget = collection('loc_target', {
                i18n: true,
                fields: { name: field.text() }
            });
            // Non-i18n owner → the localized flag is meaningless (no siblings).
            const plainOwner = collection('plain_owner', {
                fields: { ref: field.relation({ to: () => locTarget }) }
            });
            const reg = new ContentTypeRegistry([locTarget, plainOwner]);
            const byName = Object.fromEntries(
                reg.serialize('plain_owner')!.fields.map((x) => [x.name, x])
            );
            expect(byName['ref'].localized).toBeUndefined();
        });
    });

    it('exposes get()/all() over the registration set', () => {
        const registry = new ContentTypeRegistry([author, tag]);
        expect(registry.get('tag')).toBe(tag as AnyContentType);
        expect(registry.all()).toHaveLength(2);
        expect(registry.get('missing')).toBeUndefined();
    });

    describe('inverse (two-way) relations', () => {
        // story.cats (owning, many-to-many) ⇄ cat.stories (inverse).
        const cat = collection('cat', {
            fields: {
                name: field.text(),
                stories: field.relationInverse({
                    of: () => story,
                    field: 'cats'
                })
            }
        });
        const story = collection('story', {
            fields: {
                title: field.text({ required: true }),
                cats: field.relation({ to: () => cat, many: true })
            }
        });

        it('constructs when the inverse mirrors a real owning relation', () => {
            expect(
                () => new ContentTypeRegistry([cat, story])
            ).not.toThrow();
        });

        it('serializes the back-reference marker', () => {
            const registry = new ContentTypeRegistry([cat, story]);
            const fields = registry.serialize('cat')!.fields;
            const byName = Object.fromEntries(fields.map((x) => [x.name, x]));
            expect(byName['stories'].relation).toEqual({
                to: 'story',
                many: true,
                inverse: { field: 'cats' }
            });
        });

        it('throws when the inverse targets a non-relation field', () => {
            const bad = collection('bad', {
                fields: {
                    // story.title is text, not a relation.
                    oops: field.relationInverse({
                        of: () => story,
                        field: 'title'
                    })
                }
            });
            expect(
                () => new ContentTypeRegistry([cat, story, bad])
            ).toThrow(/not a storage-owning relation field/);
        });
    });
});
