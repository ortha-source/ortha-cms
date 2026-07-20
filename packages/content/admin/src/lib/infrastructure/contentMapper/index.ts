import type {
    ContentType,
    ContentTypeSummaryResponse
} from '../../domain/types/contentType';

/**
 * The content plugin's anti-corruption layer: maps the wire shapes served by the
 * content API to the admin's models. Content's wire and view shapes are largely
 * congruent (fields pass through untouched), so this is deliberately thin — one
 * summary mapper — but it keeps the seam explicit and in one place.
 */

/** Maps one wire type summary to the admin `ContentType` model. */
export function toContentType(summary: ContentTypeSummaryResponse): ContentType {
    return {
        name: summary.name,
        kind: summary.kind,
        label: summary.label,
        description: summary.description,
        path: summary.path,
        publishable: summary.publishable,
        paranoid: summary.paranoid
    };
}
