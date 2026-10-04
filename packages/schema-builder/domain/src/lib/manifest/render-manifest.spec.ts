import { renderManifest } from './render-manifest';

describe('renderManifest', () => {
    const entries = [
        { name: 'tag', kind: 'collection' as const, joinFields: [] },
        { name: 'home_page', kind: 'single' as const, joinFields: [] },
        {
            name: 'master_collection',
            kind: 'collection' as const,
            joinFields: ['tags', 'related']
        },
        { name: 'article', kind: 'collection' as const, joinFields: ['tags'] }
    ];

    it('starts with the generated marker', () => {
        expect(
            renderManifest(entries).startsWith('// @orthacms-generated')
        ).toBe(true);
    });

    it('lists collections then pages, each by name, in imports and in contentTypes', () => {
        const out = renderManifest(entries);
        expect(out).toContain(
            [
                "import { article } from './collections/article';",
                "import { master_collection } from './collections/master_collection';",
                "import { tag } from './collections/tag';",
                "import { home_page } from './pages/home_page';"
            ].join('\n')
        );
        expect(out).toContain(
            'export const contentTypes: readonly AnyContentType[] = [\n    article,\n    master_collection,\n    tag,\n    home_page\n];'
        );
    });

    it('exports every main table and every join table at the top level, for drizzle-kit', () => {
        const out = renderManifest(entries);
        expect(out).toContain('export const articleTable = article.table;');
        expect(out).toContain('export const homePageTable = home_page.table;');
        expect(out).toContain(
            "export const articleTagsJoinTable = joinTableOf(article, 'tags');"
        );
        expect(out).toContain(
            'export const contentEntryRevisionsTable = contentEntryRevisions;'
        );
    });

    it('wraps a join line the way prettier would at 80 columns', () => {
        expect(renderManifest(entries)).toContain(
            "export const masterCollectionRelatedJoinTable = joinTableOf(\n    master_collection,\n    'related'\n);"
        );
    });

    it('is deterministic — input order does not matter', () => {
        expect(renderManifest([...entries].reverse())).toBe(
            renderManifest(entries)
        );
    });

    it('renders an app with no types: no joinTableOf import, an empty list, the revision store', () => {
        const out = renderManifest([]);
        expect(out).toContain(
            'export const contentTypes: readonly AnyContentType[] = [];'
        );
        expect(out).not.toContain('joinTableOf');
        expect(out).toContain(
            'export const contentEntryRevisionsTable = contentEntryRevisions;'
        );
    });
});
