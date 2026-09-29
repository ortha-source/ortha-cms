import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import { workspaceContent, workspaces } from '@orthacms/workspaces-server';
import {
    isReachable,
    resolveContentAccess,
    type ContentAccess
} from './content-access';
import { sourceServes } from './shared-grant.sql';

/** An executor a caller already inside a transaction may pass. */
type Exec = Pick<Database, 'select'>;

/**
 * Reads a workspace's **content grants** — the `workspace_content` rows the
 * open workspace holds, written by the workspace create/edit wizard.
 *
 * Since ADR-0019's "Explicit per-source grants" a workspace holds two kinds of
 * row, and this class answers the three questions callers ask of them:
 *
 * - {@link grantedSlugs} — the **own** grants: the types the workspace may
 *   *author*. Every write path gates on this.
 * - {@link reachableSlugs} — own grants plus every type with an *available*
 *   shared grant: the types the workspace may *read* (list, open, link to,
 *   render). Every read path gates on this.
 * - {@link access} — per reachable slug, both facts at once, with the shared
 *   sources' names (the `access` block on `GET /content-schema`).
 *
 * The rule itself is `content-access.ts` (pure) and `shared-grant.sql.ts`
 * (its SQL twin); this class only reads rows into it.
 *
 * The grants are workspaces-owned data, but the dependency only runs one way:
 * content-server already depends on `@orthacms/workspaces-server` for
 * `WorkspaceGuard`, and that package deliberately re-exports its Drizzle
 * schema. Inverting this into a port would mean workspaces depending on
 * content, which is the cycle `CONTENT_CATALOG` exists to avoid.
 *
 * A thin CQRS read — no aggregate, no write path.
 */
@Injectable()
export class WorkspaceGrantsQuery {
    constructor(@InjectDatabase() private readonly db: Database) {}

    /**
     * Every content slug `workspaceId` holds an **own** grant for — the types
     * it may create, edit, publish and delete records of. Returned as a `Set`
     * so callers can test membership per relation hop without re-querying.
     * An empty set means the workspace owns nothing — callers must treat that
     * as "no access", never as "no filtering".
     *
     * `exec` lets a caller already inside a transaction read on its own
     * connection rather than borrowing a second one from the pool.
     */
    async grantedSlugs(
        workspaceId: string,
        exec: Exec = this.db
    ): Promise<Set<string>> {
        const rows = await exec
            .select({ slug: workspaceContent.slug })
            .from(workspaceContent)
            .where(
                and(
                    eq(workspaceContent.workspaceId, workspaceId),
                    isNull(workspaceContent.sourceWorkspaceId)
                )
            );
        return new Set(rows.map((row) => row.slug));
    }

    /**
     * Every content slug `workspaceId` may **read**: its own grants plus each
     * type it holds an *available* shared grant of. The gate for every read —
     * a superset of {@link grantedSlugs}.
     */
    async reachableSlugs(
        workspaceId: string,
        exec: Exec = this.db
    ): Promise<Set<string>> {
        const access = await this.access(workspaceId, exec);
        return new Set(
            [...access.entries()]
                .filter(([, entry]) => isReachable(entry))
                .map(([slug]) => slug)
        );
    }

    /**
     * Per **reachable** slug, whether the workspace owns it and which
     * available shared workspaces it reads it from. An unreachable slug —
     * never granted, or granted only from sources that are no longer shared,
     * archived, or no longer hold the type — is absent.
     */
    async access(
        workspaceId: string,
        exec: Exec = this.db
    ): Promise<Map<string, ContentAccess>> {
        const source = alias(workspaces, 'grant_source');
        const rows = await exec
            .select({
                slug: workspaceContent.slug,
                sourceWorkspaceId: workspaceContent.sourceWorkspaceId,
                sourceWorkspaceName: source.name,
                sourceAvailable: sourceServes(
                    exec,
                    source,
                    workspaceContent.slug
                ).mapWith(Boolean)
            })
            .from(workspaceContent)
            .leftJoin(source, eq(source.id, workspaceContent.sourceWorkspaceId))
            .where(eq(workspaceContent.workspaceId, workspaceId));
        return resolveContentAccess(
            rows.map((row) => ({
                slug: row.slug,
                sourceWorkspaceId: row.sourceWorkspaceId,
                sourceWorkspaceName: row.sourceWorkspaceName,
                // A left-joined NULL source makes the predicate NULL, never
                // true — so an own grant is never read as a shared one.
                sourceAvailable: row.sourceAvailable === true
            }))
        );
    }
}
