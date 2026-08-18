import {
    CONTENT_FIELD_TYPE,
    DEFAULT_ENTRY_TAB,
    ENTRY_TAB,
    ENTRY_TAB_SLUGS
} from '../constants';
import type { ContentField } from '../types/contentType';

/**
 * The entry editor's open tab, read off the URL path.
 *
 * Resolved from the **last path segment** rather than a route param because the
 * two editor shapes don't agree on one: a collection row nests the tab under its
 * id (`/article/:id/relations`, a `:tab` param), while a **single** page's
 * editor is mounted on the type itself, so its tab has to be spelled out as a
 * static segment (`/home_page/relations`) to outrank the `:entryId` route — and
 * a static segment yields no param. Reading the path covers both.
 *
 * Anything that isn't a known slug — a record id, `new`, the type name itself —
 * means the default tab, so the bare entry URL stays the canonical short link.
 */
export function entryTabFromPath(pathname: string): string {
    const last = pathname.split('/').filter(Boolean).at(-1);
    return ENTRY_TAB_SLUGS.some((slug) => slug === last)
        ? (last as string)
        : DEFAULT_ENTRY_TAB;
}

/**
 * Which tab a field's control lives on.
 *
 * The editor splits its fields three ways and nothing else decides it: relations
 * render on Relations, media on the contributed Media tab, and everything else
 * inline on General. Kept here because two callers need the same answer and must
 * not drift — the blocked-submit toast, which moves to the offending field's tab
 * so the marked control is on screen, and the tab bar's own unmet-required
 * markers, which would otherwise count a field onto a tab the toast then fails
 * to open.
 *
 * A media field on a type whose schema contributes no Media tab resolves to a
 * slug nothing renders. That is the pre-existing behaviour of the toast and is
 * left alone: media-admin contributes the tab for exactly the schemas that have
 * a media field, so the two agree wherever the field is actually reachable.
 */
export function entryTabForField(field: ContentField): string {
    if (field.type === CONTENT_FIELD_TYPE.Relation) return ENTRY_TAB.Relations;
    if (field.type === CONTENT_FIELD_TYPE.Media) return ENTRY_TAB.Media;
    return ENTRY_TAB.General;
}
