import { Injectable } from '@nestjs/common';
import type { AnyColumn, SQL } from 'drizzle-orm';
import type {
    ContentReadScope,
    ContentReadScopeContext
} from '@orthacms/content-server';
import { CallerSegmentsStore } from '../../application/caller-segments.store';
import { SegmentCatalogService } from '../../application/segment-catalog.service';
import { planAccessPredicate } from '../predicate/access-plan';
import { buildAccessPredicate } from '../predicate/access-predicate';

/**
 * The `CONTENT_READ_SCOPE` implementation — the one place segmentation reaches
 * the read path.
 *
 * Bound as a **multi** provider, so it AND-s onto content's own visibility rule
 * and can only subtract rows. Every protocol over that content — REST, GraphQL,
 * the MCP tools, the copilot's reads — goes through `PublicEntriesQuery`, so
 * they are all covered by this one method rather than by four copies of the
 * rule.
 *
 * A generated content table is addressed by its `id`, and nothing here needs to
 * know anything else about the type: the projection carries the entry ids, so
 * one fragment shape serves every content type in the installation.
 */
@Injectable()
export class SegmentReadScope implements ContentReadScope {
    constructor(
        private readonly catalog: SegmentCatalogService,
        private readonly callers: CallerSegmentsStore
    ) {}

    /**
     * The predicate for this read, or `undefined` when segmentation adds
     * nothing.
     *
     * The `undefined` case is the one an installation that has never opened the
     * feature stays in forever, and it is checked first: `planAccessPredicate`
     * returns `null` with no active segment type, and the read is then byte-for
     * byte what it was before the plugin was installed.
     */
    scope(context: ContentReadScopeContext): SQL | undefined {
        const { types } = this.catalog.snapshot();
        // Anonymous, not unrestricted: a request the middleware did not cover
        // reads as a caller carrying nothing, so it still sees open content and
        // no restricted content. See `CallerSegmentsStore`.
        const caller = this.callers.currentOrAnonymous();
        const plan = planAccessPredicate(types, caller.byType);
        return buildAccessPredicate({
            plan,
            table: context.type.table as unknown as Record<string, AnyColumn>,
            workspaceId: context.workspaceId
        });
    }
}
