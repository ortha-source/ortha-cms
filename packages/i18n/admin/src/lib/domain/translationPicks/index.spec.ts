import { describe, expect, it } from 'vitest';
import {
    isPicked,
    localeState,
    PICK_PRESET,
    PICK_STATE,
    pickedEntryIds,
    presetPicks,
    rowState,
    setCell,
    setLocale,
    setRow,
    type PickRow
} from './index';

// Two selected English records: the first translated into German and French
// (French already live, so not an option), the second only into German.
const first: PickRow = {
    id: 'a-en',
    locale: 'en',
    options: new Map([
        ['en', 'a-en'],
        ['de', 'a-de']
    ])
};
const second: PickRow = {
    id: 'b-en',
    locale: 'en',
    options: new Map([
        ['en', 'b-en'],
        ['de', 'b-de']
    ])
};
// A record whose own row is live: only its draft German sibling is an option.
const liveSource: PickRow = {
    id: 'c-en',
    locale: 'en',
    options: new Map([['de', 'c-de']])
};
const rows = [first, second, liveSource];

describe('translationPicks', () => {
    it('picks every option for the "all" preset', () => {
        const picks = presetPicks(rows, PICK_PRESET.All);
        expect(pickedEntryIds(picks, rows)).toEqual([
            'a-en',
            'a-de',
            'b-en',
            'b-de',
            'c-de'
        ]);
    });

    it('picks only each record’s own locale for the "own" preset', () => {
        const picks = presetPicks(rows, PICK_PRESET.Own);
        // c-en is live, so there is nothing of its own to pick.
        expect(pickedEntryIds(picks, rows)).toEqual(['a-en', 'b-en']);
    });

    it('applies a locale to every record that has it, and reports the column', () => {
        let picks = presetPicks(rows, PICK_PRESET.None);
        expect(localeState(picks, rows, 'de')).toBe(PICK_STATE.None);

        picks = setLocale(picks, rows, 'de', true);
        expect(localeState(picks, rows, 'de')).toBe(PICK_STATE.All);
        expect(pickedEntryIds(picks, rows)).toEqual(['a-de', 'b-de', 'c-de']);

        picks = setCell(picks, second, 'de', false);
        expect(localeState(picks, rows, 'de')).toBe(PICK_STATE.Some);
    });

    it('reports a locale nobody can publish as unavailable', () => {
        const picks = presetPicks(rows, PICK_PRESET.All);
        expect(localeState(picks, rows, 'fr')).toBe(PICK_STATE.Unavailable);
    });

    it('ignores a cell that is not an option', () => {
        const picks = presetPicks(rows, PICK_PRESET.None);
        const next = setCell(picks, first, 'fr', true);
        expect(next).toBe(picks);
        expect(isPicked(next, first.id, 'fr')).toBe(false);
    });

    it('toggles a whole row and reports it', () => {
        let picks = presetPicks(rows, PICK_PRESET.None);
        picks = setRow(picks, first, true);
        expect(rowState(picks, first)).toBe(PICK_STATE.All);
        picks = setCell(picks, first, 'en', false);
        expect(rowState(picks, first)).toBe(PICK_STATE.Some);
        picks = setRow(picks, first, false);
        expect(rowState(picks, first)).toBe(PICK_STATE.None);
    });

    it('publishes a sibling shared by two selected rows once', () => {
        // Two selected rows from one translation group (selected under two
        // different list locales) offer the same entries.
        const en: PickRow = {
            id: 'd-en',
            locale: 'en',
            options: new Map([
                ['en', 'd-en'],
                ['de', 'd-de']
            ])
        };
        const de: PickRow = { ...en, id: 'd-de', locale: 'de' };
        const picks = presetPicks([en, de], PICK_PRESET.All);
        expect(pickedEntryIds(picks, [en, de])).toEqual(['d-en', 'd-de']);
    });

    it('never mutates the picks it was given', () => {
        const picks = presetPicks(rows, PICK_PRESET.None);
        setCell(picks, first, 'de', true);
        setLocale(picks, rows, 'en', true);
        setRow(picks, second, true);
        expect(pickedEntryIds(picks, rows)).toEqual([]);
    });
});
