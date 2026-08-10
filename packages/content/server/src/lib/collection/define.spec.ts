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

    it('rejects a many-relation with unique: true', () => {
        expect(() =>
            collection('post', {
                fields: {
                    tags: field.relation({ to: stub, many: true, unique: true })
                }
            })
        ).toThrow(/unique: true with .*many: true/);
    });

    it('allows a unique single relation (one-to-one)', () => {
        const post = collection('post', {
            fields: { seo: field.relation({ to: stub, unique: true }) }
        });
        expect(post.fields.seo.relation?.unique).toBe(true);
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

describe('content-type i18n metadata', () => {
    /** Generated tables expose their columns as own properties. */
    const cols = (type: AnyContentType) =>
        type.table as unknown as Record<string, unknown>;

    it('defaults i18n to false and adds no locale columns', () => {
        const post = collection('post', { fields: { title: field.text() } });
        expect(post.i18n).toBe(false);
        expect(cols(post).locale).toBeUndefined();
        expect(cols(post).localeGroupId).toBeUndefined();
    });

    it('i18n adds locale + locale_group_id columns', () => {
        const post = collection('post', {
            i18n: true,
            fields: { title: field.text() }
        });
        expect(post.i18n).toBe(true);
        expect(cols(post).locale).toBeDefined();
        expect(cols(post).localeGroupId).toBeDefined();
    });

    it('reserves locale and locale_group_id as field names', () => {
        expect(() =>
            collection('post', {
                i18n: true,
                fields: { locale: field.text() }
            })
        ).toThrow(/envelope column/);
        expect(() =>
            collection('post', {
                i18n: true,
                fields: { localeGroupId: field.text() }
            })
        ).toThrow(/envelope column/);
    });

    it('rejects a localized field on a non-i18n type', () => {
        expect(() =>
            collection('post', {
                fields: { title: field.text({ localized: true }) }
            })
        ).toThrow(/localized, but the type does not set i18n/);
    });

    it('carries localized on the field spec of an i18n type', () => {
        const post = collection('post', {
            i18n: true,
            fields: {
                title: field.text({ localized: true }),
                slug: field.text()
            }
        });
        expect(post.fields.title.localized).toBe(true);
        // Omitted (not false) when unset.
        expect(post.fields.slug.localized).toBeUndefined();
    });

    it('applies to single() too', () => {
        const home = single('home', {
            path: '/',
            i18n: true,
            fields: { title: field.text({ localized: true }) }
        });
        expect(cols(home).locale).toBeDefined();
        expect(cols(home).localeGroupId).toBeDefined();
    });
});

describe('media fields', () => {
    /** A generated column's SQL type (`uuid`, `jsonb`, …). */
    const sqlType = (type: AnyContentType, col: string) =>
        (
            (type.table as unknown as Record<string, { getSQLType(): string }>)[
                col
            ]
        ).getSQLType();

    it('field.media() normalizes multiple (default false) + accept', () => {
        const single = field.media();
        expect(single.type).toBe('media');
        expect(single.multiple).toBe(false);
        expect(single.accept).toBeUndefined();

        const many = field.media({
            multiple: true,
            accept: { kinds: ['image'], mimeTypes: ['image/png'] }
        });
        expect(many.multiple).toBe(true);
        expect(many.accept).toEqual({
            kinds: ['image'],
            mimeTypes: ['image/png']
        });
    });

    it('rejects an unknown media kind at define time', () => {
        expect(() =>
            // @ts-expect-error — an invalid kind must fail at build, not runtime.
            field.media({ accept: { kinds: ['picture'] } })
        ).toThrow(/Invalid media kind/);
    });

    it('a single media field is a uuid column (no FK, no join table)', () => {
        const post = collection('post', {
            fields: { cover: field.media() }
        });
        expect(sqlType(post, 'cover')).toBe('uuid');
        expect(Object.keys(post.joinTables ?? {})).not.toContain('cover');
    });

    it('a multiple media field is a jsonb column', () => {
        const post = collection('post', {
            fields: { gallery: field.media({ multiple: true }) }
        });
        expect(sqlType(post, 'gallery')).toBe('jsonb');
    });

    it('a required media field is NOT NULL on a non-publishable type', () => {
        const post = collection('post', {
            fields: { cover: field.media({ required: true }) }
        });
        const col = (
            post.table as unknown as Record<string, { notNull: boolean }>
        ).cover;
        expect(col.notNull).toBe(true);
    });

    it('a required media field stays nullable on a publishable type', () => {
        const post = collection('post', {
            publishable: true,
            fields: { cover: field.media({ required: true }) }
        });
        const col = (
            post.table as unknown as Record<string, { notNull: boolean }>
        ).cover;
        expect(col.notNull).toBe(false);
    });

    it('rejects a localized media field on a non-i18n type', () => {
        expect(() =>
            collection('post', {
                fields: { cover: field.media({ localized: true }) }
            })
        ).toThrow(/localized, but the type does not set i18n/);
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

describe('inverse relations', () => {
    const cols = (type: AnyContentType) =>
        type.table as unknown as Record<string, unknown>;

    it('adds no column or join table (it reuses the owning side)', () => {
        const post = collection('post', {
            fields: {
                title: field.text(),
                comments: field.relationInverse({ of: stub, field: 'post' })
            }
        });
        // Virtual: no `comments`/`comments_id` column and no join table.
        expect(cols(post).comments).toBeUndefined();
        expect(cols(post).comments_id).toBeUndefined();
        expect(post.joinTables['comments']).toBeUndefined();
    });

    it('carries the back-reference in its spec', () => {
        const post = collection('post', {
            fields: {
                articles: field.relationInverse({ of: stub, field: 'tags' })
            }
        });
        expect(post.fields.articles.relation?.inverse).toEqual({
            field: 'tags'
        });
        // Defaults to a to-many back-reference.
        expect(post.fields.articles.relation?.many).toBe(true);
    });
});

describe('syncAcrossLocales', () => {
    const tag = collection('tag', { fields: { name: field.text() } });

    it('defaults to true, so a relation belongs to the record', () => {
        const post = collection('post', {
            i18n: true,
            fields: { tag: field.relation({ to: () => tag }) }
        });
        expect(post.fields.tag.relation?.syncAcrossLocales).toBe(true);
    });

    it('defaults to false when the field is marked localized', () => {
        // The two say the same thing, so `localized` picks the default rather
        // than being honoured as a second, independent flag.
        const post = collection('post', {
            i18n: true,
            fields: {
                tag: field.relation({ to: () => tag, localized: true })
            }
        });
        expect(post.fields.tag.relation?.syncAcrossLocales).toBe(false);
    });

    it('is always false on an inverse, which owns no storage of its own', () => {
        const post = collection('post', {
            i18n: true,
            fields: {
                tags: field.relation({ to: () => tag, many: true }),
                mirror: field.relationInverse({ of: () => tag, field: 'x' })
            }
        });
        expect(post.fields.mirror.relation?.syncAcrossLocales).toBe(false);
    });

    it('rejects opting out on a type that has no locale siblings', () => {
        expect(() =>
            collection('post', {
                fields: {
                    tag: field.relation({
                        to: () => tag,
                        syncAcrossLocales: false
                    })
                }
            })
        ).toThrow(/does not set i18n: true/);
    });

    it('rejects localized: true together with syncAcrossLocales: true', () => {
        // Opposite requests — one would have to win silently.
        expect(() =>
            collection('post', {
                i18n: true,
                fields: {
                    tag: field.relation({
                        to: () => tag,
                        localized: true,
                        syncAcrossLocales: true
                    })
                }
            })
        ).toThrow(/localized: true with syncAcrossLocales: true/);
    });

    it('leaves an ordinary non-localized type alone', () => {
        // The default is `true`, which is inert without locale siblings — it
        // must not be mistaken for an explicit opt-in and rejected.
        expect(() =>
            collection('post', {
                fields: { tag: field.relation({ to: () => tag }) }
            })
        ).not.toThrow();
    });
});
