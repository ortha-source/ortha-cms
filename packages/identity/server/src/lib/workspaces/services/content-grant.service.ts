import { Inject, Injectable, Optional } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { InjectDatabase, type Database } from '@ortha-cms/database';
import { workspaceContent } from '../../schema';
import { CONTENT_TYPES } from '../../content/content.constants';
import {
    CONTENT_CATALOG,
    type ContentCatalog
} from '../../content/content-catalog';
import type { ContentDto } from '../dto/create-workspace.dto';
import type { Tx } from './tx';

/** A content grant flattened to an explicit (kind, slug) row. */
interface ContentGrant {
    kind: 'collection' | 'single';
    slug: string;
}

/** The catalogue's slugs, split by kind. */
interface KnownSlugs {
    collections: string[];
    pages: string[];
}

/** Resolves a resource selection against the known slugs of that kind. */
function selectionToSlugs(
    selection:
        | { mode: 'specific' | 'all'; ids?: string[]; excludedIds?: string[] }
        | undefined,
    known: string[]
): string[] {
    if (!selection) return [];
    if (selection.mode === 'all') {
        const excluded = new Set(selection.excludedIds ?? []);
        return known.filter((slug) => !excluded.has(slug));
    }
    const requested = new Set(selection.ids ?? []);
    return known.filter((slug) => requested.has(slug));
}

/** Flattens the wizard's content decision into explicit (kind, slug) rows. */
function resolveGrants(content: ContentDto, known: KnownSlugs): ContentGrant[] {
    if (content.mode === 'all') {
        return [
            ...known.collections.map((slug) => ({
                kind: 'collection' as const,
                slug
            })),
            ...known.pages.map((slug) => ({ kind: 'single' as const, slug }))
        ];
    }
    return [
        ...selectionToSlugs(content.collections, known.collections).map(
            (slug) => ({ kind: 'collection' as const, slug })
        ),
        ...selectionToSlugs(content.pages, known.pages).map((slug) => ({
            kind: 'single' as const,
            slug
        }))
    ];
}

/**
 * Persists a workspace's content-access grants. The collections/pages live in
 * code — resolved through the content plugin's {@link CONTENT_CATALOG} registry
 * (falling back to the built-in mock when no content plugin is registered); this
 * only links a workspace to the slugs it may access, flattening "all" into
 * explicit rows.
 */
@Injectable()
export class ContentGrantService {
    constructor(
        @InjectDatabase() private readonly db: Database,
        @Optional()
        @Inject(CONTENT_CATALOG)
        private readonly catalog?: ContentCatalog
    ) {}

    /**
     * Groups each workspace's granted content slugs by workspace id. Backs the
     * workspace views so the admin can scope its Content Library to the slugs a
     * workspace was linked to at creation.
     */
    async loadByWorkspace(
        workspaceIds: string[]
    ): Promise<Map<string, string[]>> {
        const byWorkspace = new Map<string, string[]>();
        if (workspaceIds.length === 0) return byWorkspace;
        const rows = await this.db
            .select({
                workspaceId: workspaceContent.workspaceId,
                slug: workspaceContent.slug
            })
            .from(workspaceContent)
            .where(inArray(workspaceContent.workspaceId, workspaceIds));
        for (const row of rows) {
            const list = byWorkspace.get(row.workspaceId) ?? [];
            list.push(row.slug);
            byWorkspace.set(row.workspaceId, list);
        }
        return byWorkspace;
    }

    /** The catalogue's slugs, split by kind, resolved at grant time. */
    private knownSlugs(): KnownSlugs {
        const types = this.catalog?.list() ?? CONTENT_TYPES;
        return {
            collections: types
                .filter((ct) => ct.kind === 'collection')
                .map((ct) => ct.name),
            pages: types
                .filter((ct) => ct.kind === 'single')
                .map((ct) => ct.name)
        };
    }

    /** Grants `content` access to `workspaceId` within `tx`. */
    async grant(
        tx: Tx,
        workspaceId: string,
        content: ContentDto
    ): Promise<void> {
        const grants = resolveGrants(content, this.knownSlugs());
        if (grants.length === 0) return;
        await tx
            .insert(workspaceContent)
            .values(
                grants.map((grant) => ({
                    workspaceId,
                    kind: grant.kind,
                    slug: grant.slug
                }))
            )
            .onConflictDoNothing();
    }
}
