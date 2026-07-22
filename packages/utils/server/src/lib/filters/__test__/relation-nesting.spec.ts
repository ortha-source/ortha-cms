import { and, eq, getTableColumns, isNull, type SQL } from 'drizzle-orm';
import {
    PgDialect,
    QueryBuilder,
    pgTable,
    timestamp,
    uuid,
    varchar
} from 'drizzle-orm/pg-core';
import { relationExists } from '../relation-exists';
import {
    RelationKind,
    type RelationSchema,
    type RelationScope
} from '../types';
import type { DbLike } from '../table-helpers';

/**
 * Correlation binding for relations nested UNDER a `self-referential` hop.
 *
 * A self-relation's subquery is `FROM t AS qb_x`, but a nested relation's
 * parent-side columns are prebuilt against the physical `t`. Postgres can
 * still resolve an unaliased `t.col` there — from the OUTERMOST query's
 * `FROM t` — so without rebinding, the nested predicate silently correlates
 * to the ROOT row: `parent.author.name` filters on the root's author and
 * `parent.parent.name` collapses to `parent.name`. Valid SQL, wrong rows.
 *
 * These assert on the real emitted SQL, so a regression is visible as text.
 */
const page = pgTable('content_page', {
    id: uuid('id').primaryKey(),
    parent: uuid('parent_id'),
    author: uuid('author_id'),
    name: varchar('name', { length: 255 }),
    workspaceId: uuid('workspace_id')
});
const author = pgTable('content_author', {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    workspaceId: uuid('workspace_id'),
    deletedAt: timestamp('deleted_at')
});
const comment = pgTable('content_comment', {
    id: uuid('id').primaryKey(),
    page: uuid('page_id'),
    body: varchar('body', { length: 255 })
});
const joinTable = pgTable('content_page_tags', {
    sourceId: uuid('source_id'),
    targetId: uuid('target_id')
});
const tag = pgTable('content_tag', {
    id: uuid('id').primaryKey(),
    label: varchar('label', { length: 255 })
});

const WS = '00000000-0000-4000-8000-000000000001';

const qb = new QueryBuilder() as unknown as DbLike;
const dialect = new PgDialect();
const serialize = (s: SQL): string =>
    dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ').trim();

const wsScope: RelationScope = (tbl) => {
    const c = getTableColumns(tbl as never) as unknown as Record<string, never>;
    return and(eq(c['workspaceId'], WS), isNull(c['deletedAt']));
};

/** A `self-referential` `parent` hop on `page`, wrapping `relations`. */
const parentHop = (
    alias: string,
    relations?: Record<string, RelationSchema>
): RelationSchema => ({
    kind: RelationKind.SelfReferential,
    table: page,
    fk: page.parent,
    alias,
    relations
});

describe('relations nested under a self-referential hop', () => {
    it('binds a nested many-to-one FK to the alias, not the outer table', () => {
        const rel = parentHop('qb_parent', {
            author: {
                kind: RelationKind.ManyToOne,
                table: author,
                fk: page.author,
                targetKey: author.id
            }
        });

        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['author', 'name'], op: 'ilike', value: '%Ada%' },
                qb
            )
        );

        // The nested EXISTS correlates to the ALIASED parent row...
        expect(out).toContain(
            '"content_author"."id" = "qb_parent"."author_id"'
        );
        // ...and never to the root table, which would filter the wrong row.
        expect(out).not.toContain('"content_page"."author_id"');
    });

    it('binds a nested self-referential FK to the outer alias', () => {
        const rel = parentHop('qb_parent', {
            parent: parentHop('qb_parent__parent')
        });

        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['parent', 'name'], op: 'ilike', value: '%x%' },
                qb
            )
        );

        // The grandparent hop hangs off the parent alias...
        expect(out).toContain(
            '"qb_parent__parent"."id" = "qb_parent"."parent_id"'
        );
        // ...while the first hop still correlates to the real outer row.
        expect(out).toContain('"qb_parent"."id" = "content_page"."parent_id"');
    });

    it('binds a nested one-to-many parentKey to the alias', () => {
        const rel = parentHop('qb_parent', {
            comments: {
                kind: RelationKind.OneToMany,
                table: comment,
                fk: comment.page,
                parentKey: page.id
            }
        });

        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['comments', 'body'], op: 'ilike', value: '%hi%' },
                qb
            )
        );

        expect(out).toContain('"content_comment"."page_id" = "qb_parent"."id"');
        expect(out).not.toContain(
            '"content_comment"."page_id" = "content_page"."id"'
        );
    });

    it('binds a nested many-to-many parentKey to the alias', () => {
        const rel = parentHop('qb_parent', {
            tags: {
                kind: RelationKind.ManyToMany,
                through: joinTable,
                fk: joinTable.sourceId,
                targetFk: joinTable.targetId,
                table: tag,
                parentKey: page.id,
                targetKey: tag.id
            }
        });

        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['tags', 'label'], op: 'eq', value: 'x' },
                qb
            )
        );

        expect(out).toContain(
            '"content_page_tags"."source_id" = "qb_parent"."id"'
        );
    });

    it('carries the scope onto the nested target, not the alias', () => {
        const rel = parentHop('qb_parent', {
            author: {
                kind: RelationKind.ManyToOne,
                table: author,
                fk: page.author,
                targetKey: author.id,
                scope: wsScope
            }
        });

        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['author', 'name'], op: 'ilike', value: '%Ada%' },
                qb
            )
        );

        expect(out).toContain('"content_author"."workspace_id" =');
        expect(out).toContain('"content_author"."deleted_at" is null');
    });

    it('leaves an unaliased chain untouched (rebind is a no-op)', () => {
        // `author.company.name`-shaped: no alias anywhere, so every column
        // must resolve exactly as it did before rebinding was introduced.
        const rel: RelationSchema = {
            kind: RelationKind.ManyToOne,
            table: author,
            fk: page.author,
            targetKey: author.id
        };

        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['name'], op: 'ilike', value: '%Ada%' },
                qb
            )
        );

        expect(out).toContain(
            '"content_author"."id" = "content_page"."author_id"'
        );
    });
});
