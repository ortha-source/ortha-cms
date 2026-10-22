import {
    DEFAULT_ENTRY_TAB,
    ENTRY_TAB_SLUGS,
    RETIRED_ENTRY_TABS
} from '../constants';

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
 * Where a URL's tab slug actually leads: a retired slug (see
 * {@link RETIRED_ENTRY_TABS}) to the tab that holds its content now — with
 * the search params that pick it out there — and every other slug to itself.
 */
export function liveEntryTab(slug: string): {
    tab: string;
    search?: Record<string, string>;
} {
    return RETIRED_ENTRY_TABS[slug] ?? { tab: slug };
}
