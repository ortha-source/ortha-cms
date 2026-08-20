/**
 * Pure matcher for a media field's `accept` restriction — shared by the write
 * path's `assertMediaTargets` (and unit-tested in isolation). An asset passes
 * when the field declares no restriction, or when it matches **any** allowed
 * kind **or** any allowed MIME pattern. A MIME pattern is either exact
 * (`application/pdf`) or a `type/*` wildcard (`image/*`).
 */

import type { MediaAccept } from '../../../types/fields';

/** A MIME pattern matches a concrete MIME either exactly or as a `type/*` glob. */
function mimeMatches(pattern: string, mimeType: string): boolean {
    if (pattern === mimeType) return true;
    if (pattern.endsWith('/*')) {
        const prefix = pattern.slice(0, -1); // keep the trailing slash: "image/"
        return mimeType.startsWith(prefix);
    }
    return false;
}

/**
 * Whether an asset (its coarse `kind` + concrete `mimeType`) satisfies a media
 * field's `accept`. An absent restriction, or one with neither list populated,
 * accepts anything.
 */
export function acceptsAsset(
    accept: MediaAccept | undefined,
    asset: { kind: string; mimeType: string }
): boolean {
    if (!accept) return true;
    const kinds: readonly string[] = accept.kinds ?? [];
    const mimeTypes = accept.mimeTypes ?? [];
    if (!kinds.length && !mimeTypes.length) return true;
    if (kinds.includes(asset.kind)) return true;
    if (mimeTypes.some((p) => mimeMatches(p, asset.mimeType))) return true;
    return false;
}

/**
 * A short human description of what a field accepts, for the validation issue
 * message (e.g. `an image`, `a PDF (application/pdf)`, `an allowed asset`).
 */
export function describeAccept(accept: MediaAccept | undefined): string {
    if (!accept) return 'an allowed asset';
    const parts: string[] = [];
    if (accept.kinds?.length) parts.push(accept.kinds.join(' / '));
    if (accept.mimeTypes?.length) parts.push(accept.mimeTypes.join(' / '));
    return parts.length
        ? `an allowed asset (${parts.join(', ')})`
        : 'an allowed asset';
}
