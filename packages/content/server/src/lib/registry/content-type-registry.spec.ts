import { collection, single } from '../collection/define';
import { f } from '../fields';
import { ContentTypeRegistry } from './content-type-registry';
import type { AnyContentType } from '../types/content-type';

const author = collection('author', { fields: { name: f.text() } });
const tag = collection('tag', { fields: { name: f.text() } });
const post = collection('post', {
    fields: {
        title: f.text({ required: true }),
        author: f.relation({ to: () => author, onDelete: 'restrict' }),
        tags: f.relation({ to: () => tag, many: true })
    }
});
const home = single('home', {
    path: '/',
    description: 'Landing',
    fields: { headline: f.text() }
});

describe('ContentTypeRegistry', () => {
    it('throws on duplicate type names', () => {
        const dup = collection('author', { fields: { name: f.text() } });
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

        it('reports onDelete for a single relation but omits it for a many relation', () => {
            const fields = registry.serialize('post')!.fields;
            const byName = Object.fromEntries(fields.map((x) => [x.name, x]));

            expect(byName['author'].relation).toEqual({
                to: 'author',
                many: false,
                onDelete: 'restrict'
            });
            expect(byName['tags'].relation).toEqual({
                to: 'tag',
                many: true
            });
            expect(byName['tags'].relation?.onDelete).toBeUndefined();
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
});
