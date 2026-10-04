import { Inject, Injectable } from '@nestjs/common';
import { count, countDistinct, inArray } from 'drizzle-orm';
import {
    CONTENT_REGISTRY,
    type ContentTypeRegistry
} from '@orthacms/content-server';
import { InjectDatabase, type Database } from '@orthacms/database';
import type {
    ChangeFacts,
    SchemaChange,
    SchemaDocument
} from '@orthacms/schema-builder-domain';
import { workspaceContent } from '@orthacms/workspaces-server';
import type { ContentStats } from '../../domain/ports/content-stats.port';
import { factsFrom } from '../../application/facts-from';

/**
 * {@link ContentStats} from the database: the rows of every registered type a
 * change touches (trash included — a tombstone is still a row a NOT NULL
 * column would refuse), and how many workspaces hold a grant of it. Read once
 * per plan; the domain then asks synchronously.
 */
@Injectable()
export class DrizzleContentStats implements ContentStats {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @Inject(CONTENT_REGISTRY) private readonly registry: ContentTypeRegistry
    ) {}

    async facts(
        changes: readonly SchemaChange[],
        after: SchemaDocument
    ): Promise<ChangeFacts> {
        const names = [...new Set(changes.map((change) => change.type))];
        const registered = names.flatMap(
            (name) => this.registry.get(name) ?? []
        );
        const rows = await Promise.all(
            registered.map(async (type) => {
                const [row] = await this.db
                    .select({ n: count() })
                    .from(type.table);
                return [type.name, Number(row?.n ?? 0)] as const;
            })
        );
        const grants = names.length
            ? await this.db
                  .select({
                      slug: workspaceContent.slug,
                      n: countDistinct(workspaceContent.workspaceId)
                  })
                  .from(workspaceContent)
                  .where(inArray(workspaceContent.slug, names))
                  .groupBy(workspaceContent.slug)
            : [];
        return factsFrom(
            new Map(rows),
            new Map(grants.map((grant) => [grant.slug, Number(grant.n)])),
            after
        );
    }
}
