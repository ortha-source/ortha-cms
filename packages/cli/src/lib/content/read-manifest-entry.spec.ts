import { readManifestEntry } from './read-manifest-entry';

const relation = (many: boolean, inverse?: object) => ({
    relation: { many, ...(inverse ? { inverse } : {}) }
});

describe('readManifestEntry', () => {
    it('reads the type exported under the file name, with its owning many-relations', () => {
        const mod = {
            article: {
                kind: 'collection',
                fields: {
                    title: {},
                    author: relation(false),
                    tags: relation(true),
                    comments: relation(true, { field: 'article' })
                }
            }
        };
        expect(readManifestEntry('collections', 'article.ts', mod)).toEqual({
            entry: { name: 'article', kind: 'collection', joinFields: ['tags'] }
        });
    });

    it('refuses a module whose export does not match its file name', () => {
        expect(
            readManifestEntry('collections', 'post.ts', {
                article: { kind: 'collection', fields: {} }
            })
        ).toEqual({
            problem:
                'collections/post.ts does not export a content type named "post".'
        });
    });

    it('refuses a page in collections/ and a collection in pages/', () => {
        expect(
            readManifestEntry('collections', 'home.ts', {
                home: { kind: 'single', fields: {} }
            })
        ).toEqual({
            problem: 'collections/home.ts declares a single; move it to pages/.'
        });
        expect(
            readManifestEntry('pages', 'tag.ts', {
                tag: { kind: 'collection', fields: {} }
            })
        ).toEqual({
            problem:
                'pages/tag.ts declares a collection; move it to collections/.'
        });
    });
});
