import { describe, expect, it } from 'vitest';
import { BASE_AXIS, type PublishCell, type PublishRecord } from '../types';
import {
    axisState,
    isPicked,
    PICK_PRESET,
    PICK_STATE,
    pickedCells,
    presetPicks,
    publishBatches,
    reconcilePicks,
    recordState,
    recordsState,
    setAxis,
    setCell,
    setRecord,
    setRecords
} from './index';

function cell(
    id: string,
    type: string,
    axis: string,
    status: 'draft' | 'published' = 'draft'
): PublishCell {
    return { id, type, axis, status, publishedAt: null };
}

function record(
    key: string,
    cells: PublishCell[],
    selectedIds: string[] = [],
    selected = selectedIds.length > 0
): PublishRecord {
    return {
        key,
        type: cells[0].type,
        anchorId: cells[0].id,
        localized: cells[0].axis !== BASE_AXIS,
        selected,
        selectedIds: new Set(selectedIds),
        via: [],
        cells: new Map(cells.map((c) => [c.axis, c]))
    };
}

// Boots: English selected (draft), German draft, French already live.
const boots = record(
    'article:A',
    [
        cell('a-en', 'article', 'en'),
        cell('a-de', 'article', 'de'),
        cell('a-fr', 'article', 'fr', 'published')
    ],
    ['a-en']
);
// Jacket: English selected, nothing else.
const jacket = record('article:B', [cell('b-en', 'article', 'en')], ['b-en']);
// A linked draft tag.
const tag = record('tag:t1', [cell('t1', 'tag', BASE_AXIS)]);
const records = [boots, jacket, tag];

const ids = (cells: PublishCell[]) => cells.map((c) => c.id);

describe('publishPicks', () => {
    it('starts "everything" with every option, never a live entry', () => {
        const picks = presetPicks(records, PICK_PRESET.Everything);
        expect(ids(pickedCells(picks, records))).toEqual([
            'a-en',
            'a-de',
            'b-en',
            't1'
        ]);
    });

    it('starts "selected" with exactly the selected entries', () => {
        const picks = presetPicks(records, PICK_PRESET.Selected);
        expect(ids(pickedCells(picks, records))).toEqual(['a-en', 'b-en']);
    });

    it('toggles a column for every record that has it', () => {
        let picks = presetPicks(records, PICK_PRESET.None);
        picks = setAxis(picks, records, 'en', true);
        expect(axisState(picks, records, 'en')).toBe(PICK_STATE.All);
        picks = setCell(picks, jacket, 'en', false);
        expect(axisState(picks, records, 'en')).toBe(PICK_STATE.Some);
        // French is live everywhere: nothing to pick in that column.
        expect(axisState(picks, records, 'fr')).toBe(PICK_STATE.Unavailable);
    });

    it('toggles a record and a whole section', () => {
        let picks = presetPicks(records, PICK_PRESET.None);
        picks = setRecord(picks, boots, true);
        expect(recordState(picks, boots)).toBe(PICK_STATE.All);
        expect(isPicked(picks, boots.key, 'fr')).toBe(false);
        expect(recordsState(picks, [boots, jacket])).toBe(PICK_STATE.Some);
        picks = setRecords(picks, [boots, jacket], true);
        expect(recordsState(picks, [boots, jacket])).toBe(PICK_STATE.All);
        picks = setRecords(picks, [boots, jacket], false);
        expect(recordsState(picks, [boots, jacket])).toBe(PICK_STATE.None);
    });

    it('ignores a cell that is not an option', () => {
        const picks = presetPicks(records, PICK_PRESET.None);
        expect(setCell(picks, boots, 'fr', true)).toBe(picks);
        expect(setCell(picks, boots, 'ar', true)).toBe(picks);
    });

    it('batches linked drafts ahead of the selection, per type', () => {
        const picks = presetPicks(records, PICK_PRESET.Everything);
        expect(publishBatches(picks, records)).toEqual([
            { type: 'tag', ids: ['t1'] },
            { type: 'article', ids: ['a-en', 'a-de', 'b-en'] }
        ]);
    });

    it('keeps the reader’s choices when cells arrive later', () => {
        // First paint: only the selected English cells are known.
        const early = [
            record('article:A', [cell('a-en', 'article', 'en')], ['a-en']),
            jacket
        ];
        let picks = presetPicks(early, PICK_PRESET.Everything);
        // The reader unticks the jacket.
        picks = setCell(picks, jacket, 'en', false);
        // Translations land: German boots is new, so it follows the preset;
        // the jacket stays unticked; the live French is never an option.
        picks = reconcilePicks(picks, early, records, PICK_PRESET.Everything);
        expect(ids(pickedCells(picks, records))).toEqual([
            'a-en',
            'a-de',
            't1'
        ]);
    });

    it('drops a pick whose entry went live in the meantime', () => {
        const picks = presetPicks(records, PICK_PRESET.Everything);
        const after = [
            record(
                'article:A',
                [
                    cell('a-en', 'article', 'en', 'published'),
                    cell('a-de', 'article', 'de')
                ],
                ['a-en']
            )
        ];
        const next = reconcilePicks(
            picks,
            records,
            after,
            PICK_PRESET.Everything
        );
        expect(ids(pickedCells(next, after))).toEqual(['a-de']);
    });
});
