import { parseFilterTree } from '@ortha-cms/utils-server';
import { collection } from '../../../collection/define';
import { field } from '../../../fields';
import type { AnyContentType } from '../../../types/content-type';
import { buildEntryFilterSurface } from './entry-filter-surface';

/**
 * `buildEntryFilterSurface` walks a content type into BOTH the Drizzle
 * `FilterSchema` (the SQL whitelist) and the flat `WireFilterField[]` the admin
 * renders, in one pass. These tests pin the cardinality mapping, the cycle
 * guard, the depth cap, the workspace scope on every relation, and — the
 * guarantee that replaces the old hand-mirror — that every wire path the picker
 * offers actually parses against the sibling schema.
 */
const WS = '00000000-0000-4000-8000-000000000001';
const UUID = '00000000-0000-4000-8000-0000000000aa';

const company = collection('company', {
    fields: { name: field.text() }
});
const author = collection('author', {
    fields: {
        name: field.text(),
        company: field.relation({ to: () => company }),
        articles: field.relationInverse({ of: () => article, field: 'author' })
    }
});
const tag = collection('tag', {
    fields: {
        label: field.text(),
        articles: field.relationInverse({ of: () => article, field: 'tags' })
    }
});
const article: AnyContentType = collection('article', {
    publishable: true,
    fields: {
        title: field.text(),
        author: field.relation({ to: () => author }),
        tags: field.relation({ to: () => tag, many: true })
    }
});

/** Recursively assert every emitted relation carries a scope builder. */
function assertAllScoped(
    relations: Record<string, { scope?: unknown; relations?: unknown }> | undefined
): void {
    for (const rel of Object.values(relations ?? {})) {
        expect(typeof rel.scope).toBe('function');
        assertAllScoped(
            rel.relations as Parameters<typeof assertAllScoped>[0]
        );
    }
}

describe('buildEntryFilterSurface', () => {
    it('maps an owning single relation to many-to-one with a record picker', () => {
        const { schema, fields } = buildEntryFilterSurface(article, {
            workspaceId: WS
        });
        expect(schema.relations?.author?.kind).toBe('many-to-one');

        const paths = fields.map((f) => f.path);
        expect(paths).toContain('author.name');

        const picker = fields.find((f) => f.path === 'author.id');
        expect(picker?.relationTarget).toBe('author');
        expect(picker?.type).toBe('uuid');
        expect(picker?.group).toEqual(['Author']);
    });

    it('maps an owning many relation to many-to-many', () => {
        const { schema, fields } = buildEntryFilterSurface(article, {
            workspaceId: WS
        });
        expect(schema.relations?.tags?.kind).toBe('many-to-many');
        expect(fields.map((f) => f.path)).toContain('tags.label');
    });

    it('maps an inverse-of-single to one-to-many', () => {
        const { schema } = buildEntryFilterSurface(author, { workspaceId: WS });
        expect(schema.relations?.articles?.kind).toBe('one-to-many');
    });

    it('maps an inverse-of-many to many-to-many', () => {
        const { schema } = buildEntryFilterSurface(tag, { workspaceId: WS });
        expect(schema.relations?.articles?.kind).toBe('many-to-many');
    });

    it('traverses two hops (author.company.name) with breadcrumbs', () => {
        const { fields } = buildEntryFilterSurface(article, {
            workspaceId: WS
        });
        const leaf = fields.find((f) => f.path === 'author.company.name');
        expect(leaf).toBeDefined();
        expect(leaf?.group).toEqual(['Author', 'Company']);
    });

    it('stops a cycle back to an ancestor type', () => {
        const { schema } = buildEntryFilterSurface(article, { workspaceId: WS });
        const authorRel = schema.relations?.author;
        // author.articles would loop article → author → article; pruned.
        expect(
            authorRel && 'relations' in authorRel
                ? authorRel.relations?.articles
                : undefined
        ).toBeUndefined();
        // ...but the non-cyclic hop (author.company) is still expanded.
        expect(
            authorRel && 'relations' in authorRel
                ? authorRel.relations?.company?.kind
                : undefined
        ).toBe('many-to-one');
    });

    it('derives maxDepth from the hop budget (segments = hops + 1)', () => {
        expect(
            buildEntryFilterSurface(article, { workspaceId: WS }).schema.maxDepth
        ).toBe(3);
        expect(
            buildEntryFilterSurface(article, {
                workspaceId: WS,
                maxRelationHops: 1
            }).schema.maxDepth
        ).toBe(2);
    });

    it('scopes every emitted relation (workspace + soft-delete guard)', () => {
        const { schema } = buildEntryFilterSurface(article, { workspaceId: WS });
        assertAllScoped(
            schema.relations as Parameters<typeof assertAllScoped>[0]
        );
    });

    it('offers the publishable status field at the root', () => {
        const { fields } = buildEntryFilterSurface(article, {
            workspaceId: WS
        });
        const status = fields.find((f) => f.path === 'status');
        expect(status?.type).toBe('enum');
        expect(status?.enumValues).toEqual(['draft', 'published']);
    });

    it('prunes a relation whose target is not granted', () => {
        const { schema, fields } = buildEntryFilterSurface(article, {
            workspaceId: WS,
            grantedTypes: new Set(['article', 'tag'])
        });
        expect(schema.relations?.author).toBeUndefined();
        expect(fields.some((f) => f.path.startsWith('author.'))).toBe(false);
        // A granted relation is still offered.
        expect(schema.relations?.tags?.kind).toBe('many-to-many');
    });

    it('every offered wire path parses against the sibling schema (no drift)', () => {
        const { schema, fields } = buildEntryFilterSurface(article, {
            workspaceId: WS
        });
        for (const f of fields) {
            const value =
                f.type === 'uuid'
                    ? UUID
                    : f.type === 'number'
                      ? '1'
                      : f.type === 'boolean'
                        ? 'true'
                        : f.type === 'date'
                          ? '2020-01-01T00:00:00.000Z'
                          : f.type === 'enum'
                            ? f.enumValues![0]
                            : 'x';
            const json = JSON.stringify({
                and: [{ field: f.path, op: 'eq', value }]
            });
            expect(() => parseFilterTree(json, schema)).not.toThrow();
        }
    });
});
