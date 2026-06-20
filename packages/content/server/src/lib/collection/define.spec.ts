import { collection, joinTableOf, single } from './define';
import { field } from '../fields';
import type { AnyContentType } from '../types/content-type';

/** A throwaway relation target — relation thunks aren't resolved by define(). */
const stub = (): AnyContentType => ({}) as AnyContentType;

describe('collection() / single() validation', () => {
    it('rejects a non-snake_case name', () => {
        expect(() =>
            collection('Bad-Name', { fields: { title: field.text() } })
        ).toThrow(/snake_case/);
    });

    it('rejects a type with no fields', () => {
        expect(() => collection('empty', { fields: {} })).toThrow(
            /no fields/
        );
    });

    it('rejects a field that collides with an envelope column', () => {
        expect(() =>
            collection('post', { fields: { status: field.text() } })
        ).toThrow(/envelope column/);
    });

    it('rejects two fields that map to the same column', () => {
        expect(() =>
            collection('post', {
                fields: { tagList: field.text(), tag_list: field.text() }
            })
        ).toThrow(/both map to column "tag_list"/);
    });

    it('rejects a field that collides with a single relation FK column', () => {
        expect(() =>
            collection('post', {
                fields: {
                    author: field.relation({ to: stub }),
                    authorId: field.text()
                }
            })
        ).toThrow(/both map to column "author_id"/);
    });

    it('rejects a required single relation with onDelete "set null"', () => {
        expect(() =>
            collection('post', {
                fields: {
                    author: field.relation({
                        to: stub,
                        required: true,
                        onDelete: 'set null'
                    })
                }
            })
        ).toThrow(/required but its onDelete is 'set null'/);
    });

    it('allows a required single relation with onDelete "restrict"', () => {
        expect(() =>
            collection('post', {
                fields: {
                    author: field.relation({
                        to: stub,
                        required: true,
                        onDelete: 'restrict'
                    })
                }
            })
        ).not.toThrow();
    });

    it('requires a single() path to start with "/"', () => {
        expect(() =>
            single('home', { path: 'home', fields: { title: field.text() } })
        ).toThrow(/must start with "\/"/);
    });

    it('reserves published_at — an author cannot define that field', () => {
        expect(() =>
            collection('post', { fields: { publishedAt: field.datetime() } })
        ).toThrow(/envelope column/);
    });

    it('reserves deleted_at — an author cannot define that field', () => {
        expect(() =>
            collection('post', { fields: { deletedAt: field.datetime() } })
        ).toThrow(/envelope column/);
    });
});

describe('content-type metadata (publishable / paranoid)', () => {
    /** Generated tables expose their columns as own properties. */
    const cols = (type: AnyContentType) =>
        type.table as unknown as Record<string, unknown>;

    it('defaults both flags to false and adds no extra columns', () => {
        const post = collection('post', { fields: { title: field.text() } });
        expect(post.publishable).toBe(false);
        expect(post.paranoid).toBe(false);
        expect(cols(post).publishedAt).toBeUndefined();
        expect(cols(post).deletedAt).toBeUndefined();
    });

    it('publishable adds a published_at column', () => {
        const post = collection('post', {
            publishable: true,
            fields: { title: field.text() }
        });
        expect(post.publishable).toBe(true);
        expect(cols(post).publishedAt).toBeDefined();
        expect(cols(post).deletedAt).toBeUndefined();
    });

    it('paranoid adds a deleted_at column', () => {
        const post = collection('post', {
            paranoid: true,
            fields: { title: field.text() }
        });
        expect(post.paranoid).toBe(true);
        expect(cols(post).deletedAt).toBeDefined();
        expect(cols(post).publishedAt).toBeUndefined();
    });

    it('applies to single() too', () => {
        const home = single('home', {
            path: '/',
            publishable: true,
            paranoid: true,
            fields: { title: field.text() }
        });
        expect(cols(home).publishedAt).toBeDefined();
        expect(cols(home).deletedAt).toBeDefined();
    });
});

describe('joinTableOf()', () => {
    const tag = collection('tag', { fields: { name: field.text() } });
    const post = collection('post', {
        fields: {
            title: field.text(),
            tags: field.relation({ to: () => tag, many: true })
        }
    });

    it('returns the generated join table for a many-relation', () => {
        expect(joinTableOf(post, 'tags')).toBe(post.joinTables['tags']);
    });

    it('throws for a field with no join table', () => {
        expect(() => joinTableOf(post, 'title')).toThrow(
            /no join table for many-relation "title"/
        );
    });
});
