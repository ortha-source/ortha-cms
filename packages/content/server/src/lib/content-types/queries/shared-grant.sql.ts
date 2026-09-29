import { and, eq, exists, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { alias, type PgColumn } from 'drizzle-orm/pg-core';
import type { Database } from '@orthacms/database';
import { workspaceContent, workspaces } from '@orthacms/workspaces-server';

/**
 * The SQL twin of `content-access.ts` (ADR-0019, "Explicit per-source
 * grants"). Two builders, shared by `WorkspaceGrantsQuery` (which reads grant
 * rows for the pure rule) and `SharedSourcesQuery` (which composes the rule
 * into every cross-workspace read), so "is this shared grant live?" is written
 * exactly once in SQL.
 *
 * Every table is aliased: the predicates are correlated sub-selects dropped
 * into queries that may themselves read `workspace_content` or `workspaces`,
 * and an unaliased inner reference would silently bind to the outer row.
 */

/** A workspace lifecycle value that exposes records; archived exposes none. */
const ACTIVE = 'active' as const;

/** The columns of an aliased `workspaces` table this module reads. */
interface SourceColumns {
    id: PgColumn;
    isShared: PgColumn;
    status: PgColumn;
}

/**
 * Whether the workspace `source` can **serve** a shared grant of `slug`
 * right now: it is shared, active, and holds its own grant for `slug`. A
 * shared grant whose source fails this is inert.
 */
export function sourceServes(
    db: Pick<Database, 'select'>,
    source: SourceColumns,
    slug: PgColumn | SQL | string
): SQL {
    const sourceOwn = alias(workspaceContent, 'source_own_grant');
    return and(
        eq(source.isShared, true),
        eq(source.status, ACTIVE),
        exists(
            db
                .select({ one: sql`1` })
                .from(sourceOwn)
                .where(
                    and(
                        eq(sourceOwn.workspaceId, source.id),
                        eq(sourceOwn.slug, slug),
                        isNull(sourceOwn.sourceWorkspaceId)
                    )
                )
        )
    ) as SQL;
}

/**
 * Sub-select of the workspaces whose `slug` records `workspaceId` may read
 * **through a shared grant** — the foreign half of `visibleSources`: every
 * `S` with a grant `(workspaceId, slug, S)` where `S ≠ workspaceId` and
 * {@link sourceServes}.
 */
export function servingSourceIds(
    db: Pick<Database, 'select'>,
    workspaceId: string,
    slug: string
) {
    const consumer = alias(workspaceContent, 'consumer_grant');
    const source = alias(workspaces, 'shared_source');
    return db
        .select({ id: source.id })
        .from(consumer)
        .innerJoin(source, eq(source.id, consumer.sourceWorkspaceId))
        .where(
            and(
                eq(consumer.workspaceId, workspaceId),
                eq(consumer.slug, slug),
                ne(source.id, workspaceId),
                sourceServes(db, source, slug)
            )
        );
}

/** `EXISTS` probe: does `workspaceId` hold its **own** grant for `slug`? */
export function ownGrantProbe(
    db: Pick<Database, 'select'>,
    workspaceId: string,
    slug: string
): SQL {
    const own = alias(workspaceContent, 'own_grant');
    return exists(
        db
            .select({ one: sql`1` })
            .from(own)
            .where(
                and(
                    eq(own.workspaceId, workspaceId),
                    eq(own.slug, slug),
                    isNull(own.sourceWorkspaceId)
                )
            )
    );
}
