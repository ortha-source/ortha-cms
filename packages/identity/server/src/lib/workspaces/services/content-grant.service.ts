import { Injectable } from '@nestjs/common';
import { workspaceContent } from '../../schema';
import { CONTENT_TYPES } from '../../content/content.constants';
import type { ContentDto } from '../dto/create-workspace.dto';
import type { Tx } from './tx';

/** A content grant flattened to an explicit (kind, slug) row. */
interface ContentGrant {
    kind: 'collection' | 'single';
    slug: string;
}

const COLLECTION_SLUGS = CONTENT_TYPES.filter(
    (ct) => ct.kind === 'collection'
).map((ct) => ct.name);
const PAGE_SLUGS = CONTENT_TYPES.filter((ct) => ct.kind === 'single').map(
    (ct) => ct.name
);

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
function resolveGrants(content: ContentDto): ContentGrant[] {
    if (content.mode === 'all') {
        return [
            ...COLLECTION_SLUGS.map((slug) => ({
                kind: 'collection' as const,
                slug
            })),
            ...PAGE_SLUGS.map((slug) => ({ kind: 'single' as const, slug }))
        ];
    }
    return [
        ...selectionToSlugs(content.collections, COLLECTION_SLUGS).map(
            (slug) => ({ kind: 'collection' as const, slug })
        ),
        ...selectionToSlugs(content.pages, PAGE_SLUGS).map((slug) => ({
            kind: 'single' as const,
            slug
        }))
    ];
}

/**
 * Persists a workspace's content-access grants. The collections/pages live in
 * code (the mock {@link CONTENT_TYPES} registry today); this only links a
 * workspace to the slugs it may access, flattening "all" into explicit rows.
 */
@Injectable()
export class ContentGrantService {
    /** Grants `content` access to `workspaceId` within `tx`. */
    async grant(
        tx: Tx,
        workspaceId: string,
        content: ContentDto
    ): Promise<void> {
        const grants = resolveGrants(content);
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
