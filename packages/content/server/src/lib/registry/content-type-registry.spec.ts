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
