import { useMemo } from 'react';
import type { MessageDescriptor } from 'react-intl';
import type { PublishContext } from '@orthacms/content-admin';
import {
    buildRecords,
    sectionsOf,
    withExpandedCells,
    type PublishSection
} from '../../../domain/publishRecords';
import type {
    PublishAxis,
    PublishCell,
    PublishRecord
} from '../../../domain/types';
import {
    PUBLISH_ANNOTATION_SLOT,
    PUBLISH_EXPANSION_SLOT,
    type PublishAnnotation,
    type PublishSlotContext
} from '../../slots/publishingSlots';

/** A contribution whose read failed, named for the page to say so. */
export type FailedSource = {
    id: string;
    label: MessageDescriptor;
    retry: () => void;
};

/** Everything the page lays out, derived from one context read and the slots. */
export type PublishRecordsView = {
    /** Every record, selected first. */
    records: PublishRecord[];
    /** The records grouped by type, the set's own type first. */
    sections: PublishSection[];
    /** Column definitions contributed by expansions, by axis key. */
    axes: ReadonlyMap<string, PublishAxis>;
    /** Notes per entry id, from every annotation source. */
    annotations: ReadonlyMap<string, PublishAnnotation[]>;
    /** Selected ids that named no live entry. */
    missing: string[];
    /** Whether some entry's linked drafts were cut at the server cap. */
    linkedTruncated: boolean;
    /** Expansions still reading — their cells may yet arrive. */
    expanding: boolean;
    /** Contributions that failed to read. */
    failed: FailedSource[];
};

/**
 * Builds the page's records: content's publish context first, then every
 * {@link PUBLISH_EXPANSION_SLOT} item's extra cells, then every
 * {@link PUBLISH_ANNOTATION_SLOT} item's notes over the resulting entries.
 *
 * The slot hooks are called unconditionally for every registered item, every
 * render — slot registration is boot-frozen, so the order is stable — and each
 * gates its own fetching. A failed contribution is reported by name, never
 * folded into "fewer cells": a translation that did not load and one that does
 * not exist must not look alike.
 */
export function usePublishRecords(
    ids: readonly string[],
    rootType: string,
    context: PublishContext | undefined,
    slotContext: PublishSlotContext
): PublishRecordsView {
    const built = useMemo(
        () =>
            context
                ? buildRecords(ids, context)
                : { records: [], missing: [], linkedTruncated: false },
        [ids, context]
    );

    const expansions = PUBLISH_EXPANSION_SLOT.getItems().map((item) => ({
        item,
        result: item.useExpansion(built.records, slotContext)
    }));
    const cells = new Map<string, PublishCell[]>();
    const axes = new Map<string, PublishAxis>();
    for (const { result } of expansions) {
        if (!result) continue;
        for (const [key, list] of result.cells) {
            cells.set(key, [...(cells.get(key) ?? []), ...list]);
        }
        for (const axis of result.axes) {
            if (!axes.has(axis.key)) axes.set(axis.key, axis);
        }
    }
    // Keyed on what the expansions answered, so a render that changes nothing
    // hands the annotations (and the page's picks) the same records.
    const cellsKey = JSON.stringify(
        [...cells].map(([k, v]) => [k, v.map((c) => c.id + c.status)])
    );
    const records = useMemo(
        () => withExpandedCells(built.records, cells),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [built.records, cellsKey]
    );
    const entries = useMemo(
        () => records.flatMap((record) => [...record.cells.values()]),
        [records]
    );

    const annotationResults = PUBLISH_ANNOTATION_SLOT.getItems().map(
        (item) => ({ item, result: item.useAnnotations(entries, slotContext) })
    );
    const annotations = new Map<string, PublishAnnotation[]>();
    for (const { result } of annotationResults) {
        if (!result) continue;
        for (const [id, note] of result.byEntry) {
            annotations.set(id, [...(annotations.get(id) ?? []), note]);
        }
    }

    const failed: FailedSource[] = [
        ...expansions.flatMap(({ item, result }) =>
            result?.isError
                ? [{ id: item.id, label: item.label, retry: result.refetch }]
                : []
        ),
        ...annotationResults.flatMap(({ item, result }) =>
            result?.isError
                ? [{ id: item.id, label: item.label, retry: result.refetch }]
                : []
        )
    ];

    return {
        records,
        sections: sectionsOf(records, rootType),
        axes,
        annotations,
        missing: built.missing,
        linkedTruncated: built.linkedTruncated,
        expanding: expansions.some(({ result }) => result?.isPending),
        failed
    };
}
