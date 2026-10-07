/**
 * What the reader has **picked** to publish — one (record, axis) pair at a
 * time, toggled per cell, per record, per column of a section, or per whole
 * section — and the publish batches that fall out of it.
 *
 * Only an **option** can be picked: an entry that exists and is not already
 * live. A missing translation has no row to publish, and a live one would only
 * come back from the dry run as "already published", padding the review with
 * rows that say nothing. Every update returns a new value; nothing mutates.
 */

import { isPublishable, type PublishCell, type PublishRecord } from '../types';

/** Picked axes per record key. */
export type Picks = ReadonlyMap<string, ReadonlySet<string>>;

/** How much of a group of options is picked, for a tri-state checkbox. */
export const PICK_STATE = {
    /** Nothing here can be picked. */
    Unavailable: 'unavailable',
    None: 'none',
    Some: 'some',
    All: 'all'
} as const;

/** @see PICK_STATE */
export type PickState = (typeof PICK_STATE)[keyof typeof PICK_STATE];

/** Where picks start, and what the quick picks reset them to. */
export const PICK_PRESET = {
    /** Every option — the selection, its translations and its linked drafts. */
    Everything: 'everything',
    /** Exactly the entries that were selected — what plain bulk publish does. */
    Selected: 'selected',
    /** Nothing. */
    None: 'none'
} as const;

/** @see PICK_PRESET */
export type PickPreset = (typeof PICK_PRESET)[keyof typeof PICK_PRESET];

/** The axes of a record that can be picked, in its cell order. */
export function optionAxes(record: PublishRecord): string[] {
    return [...record.cells.values()]
        .filter(isPublishable)
        .map((cell) => cell.axis);
}

/** Whether `axis` is an option on `record`. */
export function isOption(record: PublishRecord, axis: string): boolean {
    const cell = record.cells.get(axis);
    return !!cell && isPublishable(cell);
}

/** Picks for every record from one preset. */
export function presetPicks(
    records: readonly PublishRecord[],
    preset: PickPreset
): Picks {
    const picks = new Map<string, ReadonlySet<string>>();
    for (const record of records) {
        const axes =
            preset === PICK_PRESET.Everything
                ? optionAxes(record)
                : preset === PICK_PRESET.Selected
                  ? optionAxes(record).filter((axis) =>
                        record.selectedIds.has(
                            (record.cells.get(axis) as PublishCell).id
                        )
                    )
                  : [];
        picks.set(record.key, new Set(axes));
    }
    return picks;
}

/**
 * Carries picks over to a new set of records — a refetch, or an expansion's
 * translations landing after the first paint. A pick survives while its cell
 * is still an option; an option that was not one before (a record never seen,
 * a translation that just arrived) starts from `preset`; an option the reader
 * saw and left unticked stays unticked. Without it, every late-arriving cell
 * would either reset what the reader had ticked or slip in unannounced.
 */
export function reconcilePicks(
    previous: Picks,
    previousRecords: readonly PublishRecord[],
    records: readonly PublishRecord[],
    preset: PickPreset
): Picks {
    const before = new Map(
        previousRecords.map((record) => [record.key, record])
    );
    const seeded = presetPicks(records, preset);
    const picks = new Map<string, ReadonlySet<string>>();
    for (const record of records) {
        const old = before.get(record.key);
        const axes = new Set<string>();
        for (const axis of optionAxes(record)) {
            const wasOption = !!old && isOption(old, axis);
            const on = wasOption
                ? isPicked(previous, record.key, axis)
                : (seeded.get(record.key)?.has(axis) ?? false);
            if (on) axes.add(axis);
        }
        picks.set(record.key, axes);
    }
    return picks;
}

/** Whether `axis` of `record` is picked. */
export function isPicked(
    picks: Picks,
    recordKey: string,
    axis: string
): boolean {
    return picks.get(recordKey)?.has(axis) ?? false;
}

/** Pick or unpick one cell. A non-option is left alone. */
export function setCell(
    picks: Picks,
    record: PublishRecord,
    axis: string,
    on: boolean
): Picks {
    if (!isOption(record, axis)) return picks;
    const next = new Map(picks);
    const axes = new Set(picks.get(record.key));
    if (on) axes.add(axis);
    else axes.delete(axis);
    next.set(record.key, axes);
    return next;
}

/** Pick or unpick every option of one record. */
export function setRecord(
    picks: Picks,
    record: PublishRecord,
    on: boolean
): Picks {
    const next = new Map(picks);
    next.set(record.key, new Set(on ? optionAxes(record) : []));
    return next;
}

/** Pick or unpick one axis for every record that has it as an option. */
export function setAxis(
    picks: Picks,
    records: readonly PublishRecord[],
    axis: string,
    on: boolean
): Picks {
    return records.reduce(
        (acc, record) => setCell(acc, record, axis, on),
        picks
    );
}

/** Pick or unpick every option of every record (a whole section). */
export function setRecords(
    picks: Picks,
    records: readonly PublishRecord[],
    on: boolean
): Picks {
    return records.reduce((acc, record) => setRecord(acc, record, on), picks);
}

/** Folds a count of picked options against a count of options. */
function fold(picked: number, options: number): PickState {
    if (options === 0) return PICK_STATE.Unavailable;
    if (picked === 0) return PICK_STATE.None;
    return picked === options ? PICK_STATE.All : PICK_STATE.Some;
}

/** How much of one axis (a section's column) is picked. */
export function axisState(
    picks: Picks,
    records: readonly PublishRecord[],
    axis: string
): PickState {
    const candidates = records.filter((record) => isOption(record, axis));
    return fold(
        candidates.filter((record) => isPicked(picks, record.key, axis)).length,
        candidates.length
    );
}

/** How much of one record is picked. */
export function recordState(picks: Picks, record: PublishRecord): PickState {
    const axes = optionAxes(record);
    return fold(
        axes.filter((axis) => isPicked(picks, record.key, axis)).length,
        axes.length
    );
}

/** How much of a group of records (a section) is picked. */
export function recordsState(
    picks: Picks,
    records: readonly PublishRecord[]
): PickState {
    let picked = 0;
    let options = 0;
    for (const record of records) {
        for (const axis of optionAxes(record)) {
            options += 1;
            if (isPicked(picks, record.key, axis)) picked += 1;
        }
    }
    return fold(picked, options);
}

/** Every picked entry, in record order and, within a record, cell order. */
export function pickedCells(
    picks: Picks,
    records: readonly PublishRecord[]
): PublishCell[] {
    const seen = new Set<string>();
    const cells: PublishCell[] = [];
    for (const record of records) {
        for (const cell of record.cells.values()) {
            if (
                isPicked(picks, record.key, cell.axis) &&
                isPublishable(cell) &&
                !seen.has(cell.id)
            ) {
                seen.add(cell.id);
                cells.push(cell);
            }
        }
    }
    return cells;
}

/** One request's worth of work: entry ids of one type. */
export type PublishBatch = { type: string; ids: string[] };

/**
 * The picked entries as publish batches, **dependencies first**: every type's
 * linked drafts go out before any selected record does. Nothing in the
 * database requires that order, but a reader watching the site would otherwise
 * see an article go live a moment before the author page it links to — and if
 * a batch fails part-way, what is left unpublished is the record that links,
 * not the record linked to.
 */
export function publishBatches(
    picks: Picks,
    records: readonly PublishRecord[]
): PublishBatch[] {
    const batches = (selected: boolean): PublishBatch[] => {
        const byType = new Map<string, string[]>();
        for (const cell of pickedCells(
            picks,
            records.filter((record) => record.selected === selected)
        )) {
            const ids = byType.get(cell.type) ?? [];
            ids.push(cell.id);
            byType.set(cell.type, ids);
        }
        return [...byType].map(([type, ids]) => ({ type, ids }));
    };
    return [...batches(false), ...batches(true)];
}
