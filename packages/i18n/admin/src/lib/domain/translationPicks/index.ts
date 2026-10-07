/**
 * The **Publish with translations** picker's selection rules — which locales
 * of which selected records will be handed to the bulk publish. Framework-free
 * (no React, no wire calls), so the matrix's column, row and cell toggles share
 * one definition of "picked" instead of each re-deriving it.
 *
 * A **pick** is one (record, locale) pair. Only an *option* can be picked: a
 * translation that exists and has something to publish. A missing locale and a
 * locale that is already live are not options — the first has no row to
 * publish, and the second would only come back from the dry run as "already
 * published", padding the review with rows that say nothing.
 */

/** One selected record as the picker sees it. */
export type PickRow = {
    /** The selected entry's id — the row key. */
    id: string;
    /** The selected entry's own locale (the language the list showed it in). */
    locale: string;
    /**
     * Pickable translations, locale slug → that locale's entry id, in config
     * order. The record's own locale is in here too when it is pickable.
     */
    options: ReadonlyMap<string, string>;
};

/** The picked locales per record id. Immutable — every update returns a copy. */
export type Picks = ReadonlyMap<string, ReadonlySet<string>>;

/** How much of a column or row is picked, for a tri-state checkbox. */
export const PICK_STATE = {
    /** Nothing here can be picked (no option at all). */
    Unavailable: 'unavailable',
    None: 'none',
    Some: 'some',
    All: 'all'
} as const;

/** @see PICK_STATE */
export type PickState = (typeof PICK_STATE)[keyof typeof PICK_STATE];

/** Where a fresh picker starts. */
export const PICK_PRESET = {
    /** Every pickable translation of every record — the "deep" publish. */
    All: 'all',
    /** Each record's own locale only — what plain bulk publish does. */
    Own: 'own',
    /** Nothing. */
    None: 'none'
} as const;

/** @see PICK_PRESET */
export type PickPreset = (typeof PICK_PRESET)[keyof typeof PICK_PRESET];

/** Picks for every row from one preset. */
export function presetPicks(
    rows: readonly PickRow[],
    preset: PickPreset
): Picks {
    const picks = new Map<string, ReadonlySet<string>>();
    for (const row of rows) {
        const locales =
            preset === PICK_PRESET.All
                ? [...row.options.keys()]
                : preset === PICK_PRESET.Own && row.options.has(row.locale)
                  ? [row.locale]
                  : [];
        picks.set(row.id, new Set(locales));
    }
    return picks;
}

/** Whether `locale` is picked for `rowId`. */
export function isPicked(picks: Picks, rowId: string, locale: string): boolean {
    return picks.get(rowId)?.has(locale) ?? false;
}

/** Pick or unpick one cell. A non-option is left alone. */
export function setCell(
    picks: Picks,
    row: PickRow,
    locale: string,
    on: boolean
): Picks {
    if (!row.options.has(locale)) return picks;
    const next = new Map(picks);
    const locales = new Set(picks.get(row.id));
    if (on) locales.add(locale);
    else locales.delete(locale);
    next.set(row.id, locales);
    return next;
}

/** Pick or unpick every option of one row. */
export function setRow(picks: Picks, row: PickRow, on: boolean): Picks {
    const next = new Map(picks);
    next.set(row.id, new Set(on ? row.options.keys() : []));
    return next;
}

/** Pick or unpick one locale for every row that has it as an option. */
export function setLocale(
    picks: Picks,
    rows: readonly PickRow[],
    locale: string,
    on: boolean
): Picks {
    return rows.reduce((acc, row) => setCell(acc, row, locale, on), picks);
}

/** Folds a count of picked options against a count of options. */
function stateOf(picked: number, options: number): PickState {
    if (options === 0) return PICK_STATE.Unavailable;
    if (picked === 0) return PICK_STATE.None;
    return picked === options ? PICK_STATE.All : PICK_STATE.Some;
}

/** How much of one locale's column is picked. */
export function localeState(
    picks: Picks,
    rows: readonly PickRow[],
    locale: string
): PickState {
    const candidates = rows.filter((row) => row.options.has(locale));
    return stateOf(
        candidates.filter((row) => isPicked(picks, row.id, locale)).length,
        candidates.length
    );
}

/** How much of one row is picked. */
export function rowState(picks: Picks, row: PickRow): PickState {
    const locales = [...row.options.keys()];
    return stateOf(
        locales.filter((locale) => isPicked(picks, row.id, locale)).length,
        locales.length
    );
}

/**
 * The entry ids to publish, in row order and, within a row, in config order —
 * so the review lists each record's translations together. Duplicates are
 * dropped: two selected rows of one translation group share their options, and
 * a sibling picked from both is still one publish.
 */
export function pickedEntryIds(
    picks: Picks,
    rows: readonly PickRow[]
): string[] {
    const ids = new Set<string>();
    for (const row of rows) {
        for (const [locale, entryId] of row.options) {
            if (isPicked(picks, row.id, locale)) ids.add(entryId);
        }
    }
    return [...ids];
}
