import {
    DEFAULT_INSIGHTS_ORDER,
    type InsightsSection,
    type InsightsWidget
} from '../../presentation/slots/insightsSlots';

/** One section plus the widgets that are actually visible inside it. */
export type InsightsBand = {
    /** The resolved section — built-in defaults with any overrides folded in. */
    section: InsightsSection;
    /** Its widgets, ordered, already filtered by permission. */
    widgets: InsightsWidget[];
    /**
     * True when this band was synthesised to hold widgets whose section was
     * never registered, rather than contributed by anyone.
     */
    isFallback?: boolean;
};

/** Everything {@link resolveInsightsLayout} needs. All of it plain data. */
export type ResolveInsightsLayoutInput = {
    /** Section contributions, in registration order. */
    sections: readonly InsightsSection[];
    /** Widget contributions, in registration order. */
    widgets: readonly InsightsWidget[];
    /** Permission keys the signed-in user holds. */
    permissions: readonly string[];
    /** The band that catches widgets naming an unregistered section. */
    fallback: Pick<InsightsSection, 'id' | 'titleId' | 'defaultTitle'>;
};

/** Reads an item's order, applying the shared default. */
function orderOf(item: { order?: number }): number {
    return item.order ?? DEFAULT_INSIGHTS_ORDER;
}

/**
 * Folds section contributions into one list, merging duplicates by `id`.
 *
 * A later contribution wins **field by field**, and only for the fields it
 * actually sets — so `{ id: 'team', defaultTitle: 'People' }` renames a band
 * without silently resetting its order, description or icon to undefined. That
 * partial-override behaviour is the whole reason this is a merge rather than a
 * replace.
 *
 * A merged section keeps its **first** position, so overriding a built-in's
 * title doesn't quietly move the band to the end of the page.
 */
function mergeSections(
    sections: readonly InsightsSection[]
): InsightsSection[] {
    const byId = new Map<string, InsightsSection>();

    for (const section of sections) {
        const existing = byId.get(section.id);
        if (!existing) {
            byId.set(section.id, { ...section });
            continue;
        }
        // Object spread would copy explicit `undefined`s over real values, so
        // only the keys the later contribution actually carries are applied.
        const merged = { ...existing };
        for (const [key, value] of Object.entries(section)) {
            if (value !== undefined) {
                (merged as Record<string, unknown>)[key] = value;
            }
        }
        byId.set(section.id, merged);
    }

    return [...byId.values()];
}

/**
 * Resolves the Insights page layout: every registered section, in order, with
 * the widgets the signed-in user is allowed to see.
 *
 * Pure on purpose. Every rule that could quietly lose a contributor's card —
 * the permission filter, the section merge, the ordering, the catch-all — lives
 * here rather than inside a hook, so all of it is unit-testable without a
 * browser, a slot registry, or an auth session.
 *
 * Three guarantees a contributor can rely on:
 *
 * 1. **Nothing is silently dropped.** A widget naming a section nobody
 *    registered lands in a trailing catch-all band. A missing card with no
 *    error anywhere is the worst failure mode a plugin system can have.
 * 2. **Sections merge by id, last wins**, so a built-in can be renamed,
 *    reordered or re-iconed without forking the Insights plugin.
 * 3. **Empty bands disappear entirely** — heading included — so a deployment
 *    without a given plugin has no labelled gap where its widgets would be.
 */
export function resolveInsightsLayout({
    sections,
    widgets,
    permissions,
    fallback
}: ResolveInsightsLayoutInput): InsightsBand[] {
    const granted = new Set(permissions);
    const visible = widgets
        .filter(
            (widget) => !widget.permission || granted.has(widget.permission)
        )
        // `sort` is stable, so widgets sharing an order keep registration order
        // — two plugins contributing at the same order get a deterministic page
        // rather than one that depends on object iteration.
        .slice()
        .sort((a, b) => orderOf(a) - orderOf(b));

    const resolved = mergeSections(sections)
        .slice()
        .sort((a, b) => orderOf(a) - orderOf(b));

    const known = new Set(resolved.map((section) => section.id));

    const bands: InsightsBand[] = resolved
        .map((section) => ({
            section,
            widgets: visible.filter((widget) => widget.section === section.id)
        }))
        .filter((band) => band.widgets.length > 0);

    const orphans = visible.filter((widget) => !known.has(widget.section));
    if (orphans.length > 0) {
        bands.push({
            section: { ...fallback, order: Number.MAX_SAFE_INTEGER },
            widgets: orphans,
            isFallback: true
        });
    }

    return bands;
}
