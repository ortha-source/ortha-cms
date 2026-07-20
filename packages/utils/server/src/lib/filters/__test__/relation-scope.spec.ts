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
import { RelationKind, type RelationSchema, type RelationScope } from '../types';
import type { DbLike } from '../table-helpers';

/**
 * The scope seam (workspace + soft-delete guard ANDed inside the EXISTS) and
 * the self-referential alias. A client-less `QueryBuilder` renders the whole
 * subquery, so these assert on the real emitted SQL — not a stub.
 */
const article = pgTable('content_article', {
    id: uuid('id').primaryKey(),
    author: uuid('author_id'),
    workspaceId: uuid('workspace_id')
});
const author = pgTable('content_author', {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 255 }),
    workspaceId: uuid('workspace_id'),
    deletedAt: timestamp('deleted_at')
});
const page = pgTable('content_page', {
    id: uuid('id').primaryKey(),
    parent: uuid('parent_id'),
    name: varchar('name', { length: 255 }),
    workspaceId: uuid('workspace_id')
});
const joinTable = pgTable('content_article_tags', {
    sourceId: uuid('source_id'),
    targetId: uuid('target_id')
});
const tag = pgTable('content_tag', {
    id: uuid('id').primaryKey(),
    label: varchar('label', { length: 255 }),
    workspaceId: uuid('workspace_id'),
    deletedAt: timestamp('deleted_at')
});

const WS = '00000000-0000-4000-8000-000000000001';
const UUID = '00000000-0000-4000-8000-0000000000aa';

// A real query builder — no DB session, but emits full SQL for the subquery.
const qb = new QueryBuilder() as unknown as DbLike;
const dialect = new PgDialect();
const serialize = (s: SQL): string =>
    dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ').trim();

/** Workspace + soft-delete guard resolved against whatever table is queried. */
const scopeFor = (paranoid: boolean): RelationScope => {
    return (tbl) => {
        const c = getTableColumns(
            tbl as never
        ) as unknown as Record<string, never>;
        return and(
            eq(c['workspaceId'], WS),
            paranoid ? isNull(c['deletedAt']) : undefined
        );
    };
};

describe('relationExists — scope', () => {
    it('ANDs the scope predicate inside a many-to-one EXISTS', () => {
        const rel: RelationSchema = {
            kind: RelationKind.ManyToOne,
            table: author,
            fk: article.author,
            scope: scopeFor(true)
        };
        const out = serialize(
            relationExists(
                rel,
                article,
                { path: ['name'], op: 'ilike', value: '%x%' },
                qb
            )
        ).toLowerCase();
        expect(out).toContain('exists');
        expect(out).toContain('"workspace_id" =');
        expect(out).toContain('"deleted_at" is null');
        expect(out).toContain('ilike');
    });

    it('aliases the self-join so the correlation binds to the outer row', () => {
        const rel: RelationSchema = {
            kind: RelationKind.SelfReferential,
            table: page,
            fk: page.parent,
            alias: 'qb_parent',
            scope: scopeFor(false)
        };
        const out = serialize(
            relationExists(
                rel,
                page,
                { path: ['name'], op: 'ilike', value: '%x%' },
                qb
            )
        );
        // The inner table is aliased...
        expect(out).toContain('"qb_parent"');
        // ...and correlated to the OUTER page's parent_id (not itself).
        expect(out.replace(/\s+/g, ' ')).toContain(
            '"qb_parent"."id" = "content_page"."parent_id"'
        );
    });

    it('forces the m2m target join when a scope is present, even for id-only', () => {
        const rel: RelationSchema = {
            kind: RelationKind.ManyToMany,
            through: joinTable,
            fk: joinTable.sourceId,
            targetFk: joinTable.targetId,
            table: tag,
            scope: scopeFor(true)
        };
        const out = serialize(
            relationExists(
                rel,
                article,
                { path: ['id'], op: 'eq', value: UUID },
                qb
            )
        ).toLowerCase();
        expect(out).toContain('inner join');
        expect(out).toContain('"workspace_id" =');
    });

    it('keeps the m2m junction-only fast path when no scope is set', () => {
        const rel: RelationSchema = {
            kind: RelationKind.ManyToMany,
            through: joinTable,
            fk: joinTable.sourceId,
            targetFk: joinTable.targetId,
            table: tag
        };
        const out = serialize(
            relationExists(
                rel,
                article,
                { path: ['id'], op: 'eq', value: UUID },
                qb
            )
        ).toLowerCase();
        // No join to the target table — the target FK is read off the junction.
        expect(out).not.toContain('inner join');
        expect(out).toContain('"target_id" =');
    });
});
