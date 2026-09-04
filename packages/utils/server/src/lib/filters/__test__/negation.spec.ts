import { and, eq, getTableColumns, isNull, type SQL } from 'drizzle-orm';
import {
    PgDialect,
    QueryBuilder,
    pgTable,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { applyFilterTree } from '../tree-to-drizzle';
import { parseFilterTree } from '../parse-filter-tree';
import { scalar } from '../scalar-op';
import {
    FilterOperator,
    RelationKind,
    ScalarFieldType,
    type FilterSchema,
    type RelationScope
} from '../types';
import type { DbLike } from '../table-helpers';

/**
 * Negation semantics.
 *
 * Two independent hazards, both of which produce plausible-looking SQL that
 * answers a different question than the user asked:
 *
 * 1. **On a relation path**, `EXISTS(… NOT p …)` says "has SOME related row
 *    that isn't p" — the opposite of "has NO related row that is p" the
 *    moment the relation holds more than one row. The translator must emit
 *    `NOT EXISTS(… p …)`.
 * 2. **On a plain column**, SQL's three-valued logic makes every negative
 *    operator drop NULL rows. An empty value is not the excluded value, so
 *    it must still match.
 */
const article = pgTable('content_article', {
    id: uuid('id').primaryKey(),
    title: varchar('title', { length: 255 }),
    author: uuid('author_id'),
    workspaceId: uuid('workspace_id')
});
const author = pgTable('content_author', {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    company: uuid('company_id'),
    workspaceId: uuid('workspace_id'),
    deletedAt: timestamp('deleted_at')
});
const company = pgTable('content_company', {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    workspaceId: uuid('workspace_id'),
    deletedAt: timestamp('deleted_at')
});
const joinTable = pgTable('content_article_tags', {
    sourceId: uuid('source_id'),
    targetId: uuid('target_id')
});
const tag = pgTable('content_tag', {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    workspaceId: uuid('workspace_id'),
    deletedAt: timestamp('deleted_at')
});

const WS = '00000000-0000-4000-8000-000000000001';
const UUID = '00000000-0000-4000-8000-0000000000aa';

const qb = new QueryBuilder() as unknown as DbLike;
const dialect = new PgDialect();
const serialize = (s: SQL): string =>
    dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ').trim();

const scope: RelationScope = (tbl) => {
    const c = getTableColumns(tbl as never) as unknown as Record<string, never>;
    return and(eq(c['workspaceId'], WS), isNull(c['deletedAt']));
};

const schema: FilterSchema = {
    fields: {
        id: { type: ScalarFieldType.Uuid },
        title: { type: ScalarFieldType.String }
    },
    relations: {
        author: {
            kind: RelationKind.ManyToOne,
            table: author,
            fk: article.author,
            targetKey: author.id,
            scope,
            fields: {
                id: { type: ScalarFieldType.Uuid },
                name: { type: ScalarFieldType.String }
            },
            // A second hop, so a negated path has an outermost EXISTS that is
            // distinguishable from its inner one.
            relations: {
                company: {
                    kind: RelationKind.ManyToOne,
                    table: company,
                    fk: author.company,
                    targetKey: company.id,
                    scope,
                    fields: {
                        id: { type: ScalarFieldType.Uuid },
                        name: { type: ScalarFieldType.String }
                    }
                }
            }
        },
        tags: {
            kind: RelationKind.ManyToMany,
            through: joinTable,
            fk: joinTable.sourceId,
            targetFk: joinTable.targetId,
            table: tag,
            parentKey: article.id,
            targetKey: tag.id,
            scope,
            fields: {
                id: { type: ScalarFieldType.Uuid },
                name: { type: ScalarFieldType.String }
            }
        }
    }
};

/** Parse + translate one rule, returning the emitted SQL text. */
async function translate(rule: Record<string, unknown>): Promise<string> {
    const tree = parseFilterTree(JSON.stringify({ and: [rule] }), schema);
    const sql = await applyFilterTree(tree, schema, article, qb);
    return serialize(sql as SQL);
}

describe('negation on a relation path → NOT EXISTS', () => {
    it('rewrites `is none of` on a many-to-many into NOT EXISTS + IN [utils:I-25]', () => {
        // "no tag named x", NOT "has some tag that isn't x" — an article
        // tagged [x, y] must be excluded.
        return translate({
            field: 'tags.name',
            op: 'nin',
            value: ['x']
        }).then((out) => {
            expect(out.startsWith('not exists')).toBe(true);
            expect(out).toContain('in (');
            expect(out).not.toContain('not in (');
        });
    });

    it('rewrites `not contains` on a relation into NOT EXISTS + ilike', async () => {
        const out = await translate({
            field: 'author.name',
            op: 'nilike',
            value: '%Ada%'
        });
        expect(out.startsWith('not exists')).toBe(true);
        expect(out).toContain('ilike');
        expect(out).not.toContain('not ilike');
    });

    it('rewrites `is not` on a relation into NOT EXISTS + eq', async () => {
        const out = await translate({
            field: 'author.name',
            op: 'ne',
            value: 'Ada'
        });
        expect(out.startsWith('not exists')).toBe(true);
        expect(out).toContain('"content_author"."name" =');
    });

    it('turns `is empty` on a relation id into "has no related row"', async () => {
        // The naive reading — EXISTS(author WHERE author.id IS NULL) — can
        // never be true, since `id` is a NOT NULL primary key.
        const out = await translate({
            field: 'author.id',
            op: 'null',
            value: true
        });
        expect(out.startsWith('not exists')).toBe(true);
        expect(out).toContain('"content_author"."id" is not null');
        expect(out).not.toContain('"content_author"."id" is null');
    });

    it('leaves `is not empty` on a relation as a plain EXISTS', async () => {
        const out = await translate({
            field: 'author.id',
            op: 'null',
            value: false
        });
        expect(out.startsWith('exists')).toBe(true);
        expect(out).toContain('is not null');
    });

    it('keeps the relation scope inside the negated subquery', async () => {
        // The guard must stay INSIDE the NOT EXISTS: pulling it out would
        // invert it and match every row in another workspace.
        const out = await translate({
            field: 'tags.name',
            op: 'nin',
            value: ['x']
        });
        expect(out).toContain('"content_tag"."workspace_id" =');
        expect(out).toContain('"content_tag"."deleted_at" is null');
    });

    it('wraps the OUTERMOST hop of a multi-hop path [utils:I-25]', async () => {
        // "no article whose author works for Acme" — the NOT belongs on the
        // first hop. `EXISTS(author … NOT EXISTS(company …))` reads "has an
        // author who does not work for Acme", which is a different question the
        // moment an article has two authors; and pushing the negation onto the
        // leaf (`EXISTS(… company.name <> 'Acme')`) is wrong for the same
        // reason one hop down. Both alternatives emit valid SQL.
        const out = await translate({
            field: 'author.company.name',
            op: 'ne',
            value: 'Acme'
        });

        expect(out.startsWith('not exists')).toBe(true);
        // Exactly one negation, and it is the outer one: the nested hop and the
        // leaf are both positive.
        expect(out.match(/not exists/g)).toHaveLength(1);
        expect(out).toContain('"content_company"."name" =');
        expect(out).not.toContain('"content_company"."name" <>');
        // …and both hops keep their scope inside the negation.
        expect(out).toContain('"content_company"."workspace_id" =');
    });

    it('leaves positive relation operators as EXISTS', async () => {
        const out = await translate({
            field: 'tags.name',
            op: 'in',
            value: ['x']
        });
        expect(out.startsWith('exists')).toBe(true);
    });
});

describe('negative scalar operators are NULL-inclusive', () => {
    it('`ne` also matches a NULL column [utils:I-26]', () => {
        const out = serialize(scalar(article.title, FilterOperator.Ne, 'x'));
        expect(out).toContain('<>');
        expect(out).toContain('"title" is null');
    });

    it('`nin` also matches a NULL column', () => {
        const out = serialize(
            scalar(article.title, FilterOperator.Nin, ['x', 'y'])
        );
        expect(out).toContain('not in');
        expect(out).toContain('"title" is null');
    });

    it('`nilike` also matches a NULL column', () => {
        const out = serialize(
            scalar(article.title, FilterOperator.Nilike, '%x%')
        );
        expect(out).toContain('not ilike');
        expect(out).toContain('"title" is null');
    });

    it('leaves positive operators alone', () => {
        const eqSql = serialize(scalar(article.title, FilterOperator.Eq, 'x'));
        expect(eqSql).not.toContain('is null');
        const ilikeSql = serialize(
            scalar(article.title, FilterOperator.Ilike, '%x%')
        );
        expect(ilikeSql).not.toContain('is null');
    });

    it('applies at the root of a parsed tree, not just in isolation', async () => {
        const out = await translate({
            field: 'title',
            op: 'nilike',
            value: '%draft%'
        });
        expect(out).toContain('"title" is null');
    });

    it('does not double-negate inside a relation rewrite', async () => {
        // The rewrite hands `scalar()` the POSITIVE op, so the NULL-inclusive
        // branch must not fire inside the subquery.
        const out = await translate({
            field: 'author.name',
            op: 'ne',
            value: 'Ada'
        });
        expect(out).not.toContain('"content_author"."name" is null');
    });

    it('still coerces uuid values on a negated relation rule', async () => {
        const out = await translate({
            field: 'tags.id',
            op: 'nin',
            value: [UUID]
        });
        expect(out.startsWith('not exists')).toBe(true);
    });
});
