import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@orthacms/database';
import { workspaceContent } from '@orthacms/workspaces-server';

/**
 * Reads a workspace's **content grants** — the `workspace_content` slugs the
 * open workspace may access, written by the workspace create/edit wizard.
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
     * Every content slug granted to `workspaceId`. Returned as a `Set` so
     * callers can test membership per relation hop without re-querying.
     * An empty set means the workspace was granted nothing — callers must
     * treat that as "no access", never as "no filtering".
     *
     * `exec` lets a caller already inside a transaction read on its own
     * connection rather than borrowing a second one from the pool.
     */
    async grantedSlugs(
        workspaceId: string,
        exec: Pick<Database, 'select'> = this.db
    ): Promise<Set<string>> {
        const rows = await exec
            .select({ slug: workspaceContent.slug })
            .from(workspaceContent)
            .where(eq(workspaceContent.workspaceId, workspaceId));
        return new Set(rows.map((row) => row.slug));
    }
}
