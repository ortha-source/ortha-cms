import type { MediaAsset } from '../../types/mediaAsset';

/** A media field's accepted-asset restriction (mirrors the server's `accept`). */
export type MediaAccept = {
    kinds?: readonly string[];
    mimeTypes?: readonly string[];
};

/** A MIME pattern matches a concrete MIME exactly or as a `type/*` glob. */
function mimeMatches(pattern: string, mimeType: string): boolean {
    if (pattern === mimeType) return true;
    if (pattern.endsWith('/*')) return mimeType.startsWith(pattern.slice(0, -1));
    return false;
}

/**
 * Whether an asset satisfies a media field's `accept` — the admin mirror of the
 * server's `acceptsAsset`, used to pre-filter the picker's candidates so a user
 * can't select a disallowed asset (the server still enforces it on save). An
 * absent restriction, or one with neither list, accepts anything.
 */
export function acceptsAsset(
    accept: MediaAccept | undefined,
    asset: Pick<MediaAsset, 'kind' | 'mimeType'>
): boolean {
    if (!accept) return true;
    const kinds = accept.kinds ?? [];
    const mimeTypes = accept.mimeTypes ?? [];
    if (!kinds.length && !mimeTypes.length) return true;
    if (kinds.includes(asset.kind)) return true;
    if (mimeTypes.some((p) => mimeMatches(p, asset.mimeType))) return true;
    return false;
}

/**
 * The single coarse `kind` an `accept` allows, when it names exactly one and no
 * MIME list — so the picker can seed the server's `?kind=` filter. Otherwise
 * `undefined` (no server-side narrowing; filtered client-side).
 */
export function singleAcceptKind(
    accept: MediaAccept | undefined
): string | undefined {
    if (accept && !accept.mimeTypes?.length && accept.kinds?.length === 1) {
        return accept.kinds[0];
    }
    return undefined;
}

/** A short human description of what a field accepts, for the empty-state hint. */
export function describeAccept(accept: MediaAccept | undefined): string | null {
    if (!accept) return null;
    const parts: string[] = [];
    if (accept.kinds?.length) parts.push(accept.kinds.join(' / '));
    if (accept.mimeTypes?.length) parts.push(accept.mimeTypes.join(' / '));
    return parts.length ? parts.join(', ') : null;
}
