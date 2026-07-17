import type { ContentGrantKind } from '../../domain/content-grant';
import type { ContentDto } from '../dto/create-workspace.dto';
import type { KnownSlugs } from './content-catalog.reader';

/** A content grant flattened to an explicit (kind, slug) pair. */
export interface ResolvedGrant {
    /** Whether `slug` names a collection or a single page. */
    kind: ContentGrantKind;
    /** The code-defined content type's slug. */
    slug: string;
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

/**
 * Flattens the create wizard's content decision into explicit `(kind, slug)`
 * grants, resolving "all" against the known catalogue slugs. Pure — the caller
 * supplies the known slugs (read through the catalogue port), so this stays
 * free of any I/O.
 */
export function resolveGrants(
    content: ContentDto,
    known: KnownSlugs
): ResolvedGrant[] {
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
