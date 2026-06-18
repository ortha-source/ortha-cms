import { collection, joinTableOf, single } from './define';
import { f } from '../fields';
import type { AnyContentType } from '../types/content-type';

/** A throwaway relation target — relation thunks aren't resolved by define(). */
const stub = (): AnyContentType => ({}) as AnyContentType;

describe('collection() / single() validation', () => {
    it('rejects a non-snake_case name', () => {
        expect(() =>
            collection('Bad-Name', { fields: { title: f.text() } })
        ).toThrow(/snake_case/);
    });

    it('rejects a type with no fields', () => {
        expect(() => collection('empty', { fields: {} })).toThrow(
            /no fields/
        );
    });

    it('rejects a field that collides with an envelope column', () => {
        expect(() =>
            collection('post', { fields: { status: f.text() } })
        ).toThrow(/envelope column/);
    });

    it('rejects two fields that map to the same column', () => {
        expect(() =>
            collection('post', {
                fields: { tagList: f.text(), tag_list: f.text() }
            })
        ).toThrow(/both map to column "tag_list"/);
    });

    it('rejects a field that collides with a single relation FK column', () => {
        expect(() =>
            collection('post', {
                fields: {
                    author: f.relation({ to: stub }),
                    authorId: f.text()
                }
            })
        ).toThrow(/both map to column "author_id"/);
    });

    it('rejects a required single relation with onDelete "set null"', () => {
        expect(() =>
            collection('post', {
                fields: {
                    author: f.relation({
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
                    author: f.relation({
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
            single('home', { path: 'home', fields: { title: f.text() } })
        ).toThrow(/must start with "\/"/);
    });
});

describe('joinTableOf()', () => {
    const tag = collection('tag', { fields: { name: f.text() } });
    const post = collection('post', {
        fields: {
            title: f.text(),
            tags: f.relation({ to: () => tag, many: true })
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
