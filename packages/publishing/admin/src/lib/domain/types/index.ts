/**
 * The Publish Manager's view model — framework-free, so the set codec, the
 * record builder and the pick algebra are unit-testable without a browser.
 *
 * Wire shapes are content's (`@orthacms/content-admin` exports them); what
 * lives here is how the page organizes them: **records** (one per translation
 * group, or per entry on a type without locales) laid out against **axes**
 * (one per locale, or the single {@link BASE_AXIS}).
 */

import type { EntryStatus } from '@orthacms/content-admin';

/**
 * The column of a type with no locales — every record has exactly one entry,
 * and it lives here. A localized entry sits under its locale slug instead.
 */
export const BASE_AXIS = '';

/**
 * The stored "live" status. Mirrors content's `ENTRY_STATUS.Published`, typed
 * against `EntryStatus` so a rename fails to compile rather than drifting; a
 * literal rather than the import because content's value module carries React.
 */
export const LIVE_STATUS: EntryStatus = 'published';

/** One entry the page can show — content's publish-context record, trimmed. */
export type PublishEntry = {
    id: string;
    /** The content type's name. */
    type: string;
    /** Display title; absent when the row has none. */
    title?: string;
    status: EntryStatus;
    /** When it last went live — `draft` with this set reads "Modified". */
    publishedAt: string | null;
    /** The entry's locale — localized types only. */
    locale?: string;
};

/** An entry placed in its record's row, under one axis. */
export type PublishCell = PublishEntry & {
    /** The column it sits in: a locale slug, or {@link BASE_AXIS}. */
    axis: string;
    /**
     * The last dry run refused it (a field fails its publish gate). A blocked
     * entry is not an option until it is fixed and checked again — offering a
     * box whose tick would be silently dropped at publish is the clutter this
     * page exists to remove.
     */
    blocked?: boolean;
};

/** One column of a section — a locale, or the single base column. */
export type PublishAxis = {
    key: string;
    /** Header text (the language name, or "Entry"). */
    label: string;
    /** Short code shown in the header (the slug). */
    code?: string;
};

/** How a linked record was reached. */
export type PublishVia = {
    /** The title of the selected record that links to it. */
    fromTitle: string;
    /** The relation field's label. */
    fieldLabel: string;
};

/**
 * One row of the page: a record of one type — every locale of a translation
 * group, or the one entry of a type without locales.
 */
export type PublishRecord = {
    /** `${type}:${group}` — stable across expansions and refetches. */
    key: string;
    type: string;
    /** One entry id of the record, for expansions to look the rest up by. */
    anchorId: string;
    /** Whether the type is localized (the record is a translation group). */
    localized: boolean;
    /** Whether it was selected directly (as opposed to reached by a link). */
    selected: boolean;
    /** The entry ids that were selected directly — "Selected only" picks these. */
    selectedIds: ReadonlySet<string>;
    /** How it was reached through links, when it was. */
    via: PublishVia[];
    /** Its entries by axis. */
    cells: ReadonlyMap<string, PublishCell>;
};

/** Whether an entry has something to publish — anything not already live. */
export function isPublishable(
    entry: Pick<PublishCell, 'status' | 'blocked'>
): boolean {
    return entry.status !== LIVE_STATUS && !entry.blocked;
}

/** A record's display title: the first titled cell, else its anchor id. */
export function recordTitle(record: PublishRecord): string {
    for (const cell of record.cells.values()) {
        if (cell.title) return cell.title;
    }
    return record.anchorId;
}
