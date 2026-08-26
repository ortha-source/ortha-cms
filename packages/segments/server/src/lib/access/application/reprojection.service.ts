import { Injectable, Logger } from '@nestjs/common';
import { asc, eq, gt, and, type AnyColumn } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { InjectDatabase, type Database } from '@orthacms/database';
import {
    ContentTypeRegistry,
    type AnyContentType
} from '@orthacms/content-server';
import { AccessResolutionService } from './access-resolution.service';
import { ProjectionService } from './projection.service';
import { SegmentCatalogService } from './segment-catalog.service';

/** A generated content table seen as a bag of columns by property name. */
type ContentTable = Record<string, AnyColumn>;

/** How many entries one re-projection pass reads and writes at a time. */
const BATCH = 500;

/** What a re-projection did. */
export interface ReprojectionResult {
    /** Content types walked. */
    readonly types: number;
    /** Entries whose projection was rewritten. */
    readonly entries: number;
}

/**
 * Rewrites the projection for entries whose rule changed.
 *
 * The write hook keeps one entry in step with its own save. This is the other
 * half: when a **rule**, an **assignment** or a **grant** changes, the entries
 * it governs did not move, so nothing would re-derive them. Every management
 * write therefore ends here.
 *
 * It walks in batches by ascending id rather than reading a whole collection
 * into memory — a type with a hundred thousand entries is an ordinary size for
 * this to be asked about, and the alternative is an out-of-memory error that
 * leaves half the library projected under the old rule and half under the new
 * one.
 *
 * Deliberately **not** transactional across the whole walk. A single
 * transaction over a large collection holds locks for the length of the job;
 * per-batch commits mean a reader mid-walk sees some entries under the new rule
 * and some under the old, which is the same thing they would see if the
 * administrator had made the change one entry at a time. Access is being
 * *changed*: there is no instant at which the answer is not in flux, and
 * pretending otherwise buys nothing.
 */
@Injectable()
export class ReprojectionService {
    private readonly logger = new Logger(ReprojectionService.name);

    constructor(
        @InjectDatabase() private readonly db: Database,
        private readonly registry: ContentTypeRegistry,
        private readonly catalog: SegmentCatalogService,
        private readonly resolution: AccessResolutionService,
        private readonly projection: ProjectionService
    ) {}

    /**
     * Re-project one content type in one workspace.
     *
     * A no-op when no segment type is active — there is nothing the projection
     * could say, and every row it wrote would be dead weight.
     */
    async reprojectType(
        workspaceId: string,
        typeSlug: string
    ): Promise<ReprojectionResult> {
        if (!this.catalog.hasActiveTypes()) {
            await this.projection.clearType(workspaceId, typeSlug);
            return { types: 0, entries: 0 };
        }
        const type = this.registry.get(typeSlug);
        if (!type) {
            return { types: 0, entries: 0 };
        }
        const entries = await this.walk(type, workspaceId);
        return { types: 1, entries };
    }

    /** Re-project every registered content type in one workspace. */
    async reprojectWorkspace(workspaceId: string): Promise<ReprojectionResult> {
        let entries = 0;
        let types = 0;
        for (const type of this.registry.all()) {
            const result = await this.reprojectType(workspaceId, type.name);
            entries += result.entries;
            types += result.types;
        }
        return { types, entries };
    }

    /**
     * Re-project the entries a rule governs, wherever they are.
     *
     * Reached from a rule edit, which may be assigned in several workspaces at
     * once. The assignments name the workspaces and the types; everything else
     * is the ordinary walk.
     */
    async reprojectRuleTargets(
        targets: readonly { workspaceId: string; typeSlug: string | null }[]
    ): Promise<ReprojectionResult> {
        let entries = 0;
        let types = 0;
        const seen = new Set<string>();
        for (const target of targets) {
            const key = `${target.workspaceId}:${target.typeSlug ?? '*'}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const result = target.typeSlug
                ? await this.reprojectType(target.workspaceId, target.typeSlug)
                : await this.reprojectWorkspace(target.workspaceId);
            entries += result.entries;
            types += result.types;
        }
        return { types, entries };
    }

    /** One type's entries, in batches of ascending id. */
    private async walk(
        type: AnyContentType,
        workspaceId: string
    ): Promise<number> {
        const table = type.table as unknown as ContentTable;
        const idColumn = table['id'];
        const workspaceColumn = table['workspaceId'];
        if (!idColumn || !workspaceColumn) {
            return 0;
        }

        let cursor: string | null = null;
        let projected = 0;

        for (;;) {
            const where = cursor
                ? and(eq(workspaceColumn, workspaceId), gt(idColumn, cursor))
                : eq(workspaceColumn, workspaceId);
            const rows = (await this.db
                .select({ id: idColumn as PgColumn })
                .from(type.table)
                .where(where)
                .orderBy(asc(idColumn))
                .limit(BATCH)) as { id: string }[];
            if (!rows.length) break;

            const ids = rows.map((row) => row.id);
            const resolved = await this.resolution.resolveMany(
                workspaceId,
                type.name,
                ids
            );
            for (const id of ids) {
                const access = resolved.get(id);
                if (!access) continue;
                await this.projection.project(
                    { workspaceId, typeSlug: type.name, entryId: id },
                    access.rule,
                    access.ruleId
                );
            }
            projected += ids.length;
            cursor = ids[ids.length - 1];
            if (rows.length < BATCH) break;
        }

        if (projected) {
            this.logger.log(
                `Re-projected ${projected} ${type.name} entr${projected === 1 ? 'y' : 'ies'} in workspace ${workspaceId}.`
            );
        }
        return projected;
    }
}
