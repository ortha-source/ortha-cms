/**
 * Turns content's publish context into the page's **records** — one row per
 * translation group (or per entry on a type without locales), the selected
 * ones first, then the drafts they link to — and folds expansions' extra
 * cells (another plugin's translations) into them.
 */

import type {
    PublishContext,
    PublishContextRecord
} from '@orthacms/content-admin';
import {
    BASE_AXIS,
    type PublishCell,
    type PublishRecord,
    type PublishVia
} from '../types';

/** A record under construction — the mutable twin of {@link PublishRecord}. */
type Draft = {
    key: string;
    type: string;
    anchorId: string;
    localized: boolean;
    selected: boolean;
    selectedIds: Set<string>;
    via: PublishVia[];
    cells: Map<string, PublishCell>;
};

/** The record key of an entry: its translation group, else itself. */
export function recordKeyOf(
    entry: Pick<PublishContextRecord, 'id' | 'type' | 'localeGroupId'>
): string {
    return `${entry.type}:${entry.localeGroupId ?? entry.id}`;
}

/** An entry as a cell — under its locale, or the base axis. */
function toCell(entry: PublishContextRecord): PublishCell {
    return {
        id: entry.id,
        type: entry.type,
        ...(entry.title ? { title: entry.title } : {}),
        status: entry.status,
        publishedAt: entry.publishedAt,
        ...(entry.locale ? { locale: entry.locale } : {}),
        axis: entry.locale ?? BASE_AXIS
    };
}

/** What {@link buildRecords} hands back. */
export type BuiltRecords = {
    /** Selected records first (in selection order), then linked ones. */
    records: PublishRecord[];
    /** Selected ids that named no live entry (deleted since, or foreign). */
    missing: string[];
    /** Whether any selected entry's linked drafts were cut at the server cap. */
    linkedTruncated: boolean;
};

/**
 * Builds the records of a set from its publish context. Two selected entries
 * of one translation group become **one** record with two cells — the page is
 * about records, and a record selected under two locales is still one row. A
 * linked draft that is also selected stays a selected record; the link is
 * recorded on it as well, so the reader sees why it matters twice.
 */
export function buildRecords(
    ids: readonly string[],
    context: PublishContext
): BuiltRecords {
    const byKey = new Map<string, Draft>();
    const order: string[] = [];
    const missing: string[] = [];
    let linkedTruncated = false;

    const place = (entry: PublishContextRecord, selected: boolean): Draft => {
        const key = recordKeyOf(entry);
        let draft = byKey.get(key);
        if (!draft) {
            draft = {
                key,
                type: entry.type,
                anchorId: entry.id,
                localized: entry.localeGroupId !== undefined,
                selected,
                selectedIds: new Set(),
                via: [],
                cells: new Map()
            };
            byKey.set(key, draft);
            order.push(key);
        }
        const cell = toCell(entry);
        if (!draft.cells.has(cell.axis)) draft.cells.set(cell.axis, cell);
        return draft;
    };

    for (const id of ids) {
        const entry = context.entries[id];
        if (!entry) {
            missing.push(id);
            continue;
        }
        const draft = place(entry, true);
        draft.selected = true;
        draft.selectedIds.add(entry.id);
    }
    for (const id of ids) {
        const entry = context.entries[id];
        if (!entry) continue;
        if (entry.linkedTruncated) linkedTruncated = true;
        const fromTitle = entry.title ?? entry.id;
        for (const link of entry.linked) {
            const draft = place(link, false);
            draft.via.push({ fromTitle, fieldLabel: link.fieldLabel });
        }
    }

    // Selected first; within each half, first-reached first.
    const all = order.map((key) => byKey.get(key) as Draft);
    return {
        records: [
            ...all.filter((draft) => draft.selected),
            ...all.filter((draft) => !draft.selected)
        ],
        missing,
        linkedTruncated
    };
}

/**
 * Adds cells an expansion found — another plugin's view of the same records
 * (the i18n plugin's translations). A cell the record already has wins: the
 * publish context is the entry's own read, and an expansion only fills gaps.
 */
export function withExpandedCells(
    records: readonly PublishRecord[],
    cells: ReadonlyMap<string, readonly PublishCell[]>
): PublishRecord[] {
    if (cells.size === 0) return [...records];
    return records.map((record) => {
        const extra = cells.get(record.key);
        if (!extra?.length) return record;
        const merged = new Map(record.cells);
        for (const cell of extra) {
            if (!merged.has(cell.axis)) merged.set(cell.axis, cell);
        }
        return { ...record, cells: merged };
    });
}

/**
 * Marks the cells the last dry run blocked. Works on a copy, and only a record
 * that has a blocked cell is copied, so a render that changes nothing keeps the
 * records' identity. The **unmarked** records are what the next check runs
 * over — a blocked entry has to be asked again, or fixing it would never show.
 */
export function withBlocked(
    records: readonly PublishRecord[],
    isBlocked: (entryId: string) => boolean
): PublishRecord[] {
    return records.map((record) => {
        const cells = [...record.cells];
        if (!cells.some(([, cell]) => isBlocked(cell.id))) return record;
        return {
            ...record,
            cells: new Map(
                cells.map(([axis, cell]) => [
                    axis,
                    isBlocked(cell.id) ? { ...cell, blocked: true } : cell
                ])
            )
        };
    });
}

/** One content type's records, in page order. */
export type PublishSection = {
    type: string;
    records: PublishRecord[];
};

/**
 * Groups records into one section per type: the set's own type first, then
 * the types linked drafts brought in, in the order they were reached. Within a
 * section selected records stay ahead of linked ones.
 */
export function sectionsOf(
    records: readonly PublishRecord[],
    rootType: string
): PublishSection[] {
    const byType = new Map<string, PublishRecord[]>([[rootType, []]]);
    for (const record of records) {
        const list = byType.get(record.type) ?? [];
        list.push(record);
        byType.set(record.type, list);
    }
    return [...byType]
        .filter(([, list]) => list.length > 0)
        .map(([type, list]) => ({ type, records: list }));
}
