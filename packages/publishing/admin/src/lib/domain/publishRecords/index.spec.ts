import { describe, expect, it } from 'vitest';
import type { PublishContext } from '@orthacms/content-admin';
import { BASE_AXIS } from '../types';
import {
    buildRecords,
    sectionsOf,
    withBlocked,
    withExpandedCells
} from './index';

const draft = { status: 'draft' as const, publishedAt: null };

// Two selected English articles of different groups, and the German sibling of
// the first one selected too. The first links a draft author (localized) and a
// draft tag; the second links the same tag again.
const context: PublishContext = {
    entries: {
        'a-en': {
            id: 'a-en',
            type: 'article',
            title: 'Boots',
            locale: 'en',
            localeGroupId: 'A',
            ...draft,
            linkedTruncated: false,
            linked: [
                {
                    id: 'p-en',
                    type: 'author',
                    title: 'Ada',
                    locale: 'en',
                    localeGroupId: 'P',
                    field: 'author',
                    fieldLabel: 'Author',
                    ...draft
                },
                {
                    id: 't1',
                    type: 'tag',
                    title: 'Winter',
                    field: 'tags',
                    fieldLabel: 'Tags',
                    ...draft
                }
            ]
        },
        'b-en': {
            id: 'b-en',
            type: 'article',
            title: 'Jacket',
            locale: 'en',
            localeGroupId: 'B',
            ...draft,
            linkedTruncated: true,
            linked: [
                {
                    id: 't1',
                    type: 'tag',
                    title: 'Winter',
                    field: 'tags',
                    fieldLabel: 'Tags',
                    ...draft
                }
            ]
        },
        'a-de': {
            id: 'a-de',
            type: 'article',
            title: 'Stiefel',
            locale: 'de',
            localeGroupId: 'A',
            ...draft,
            linkedTruncated: false,
            linked: []
        },
        gone: null
    }
};

describe('buildRecords', () => {
    const built = buildRecords(['a-en', 'b-en', 'a-de', 'gone'], context);

    it('makes one record per translation group, selected first', () => {
        expect(built.records.map((r) => r.key)).toEqual([
            'article:A',
            'article:B',
            'author:P',
            'tag:t1'
        ]);
        const boots = built.records[0];
        expect([...boots.cells.keys()]).toEqual(['en', 'de']);
        expect([...boots.selectedIds]).toEqual(['a-en', 'a-de']);
        expect(boots.localized).toBe(true);
    });

    it('records every link that reached a linked draft', () => {
        const tag = built.records.find((r) => r.key === 'tag:t1');
        expect(tag?.selected).toBe(false);
        expect(tag?.via).toEqual([
            { fromTitle: 'Boots', fieldLabel: 'Tags' },
            { fromTitle: 'Jacket', fieldLabel: 'Tags' }
        ]);
        expect([...(tag?.cells.keys() ?? [])]).toEqual([BASE_AXIS]);
        expect(tag?.localized).toBe(false);
    });

    it('reports what it could not place', () => {
        expect(built.missing).toEqual(['gone']);
        expect(built.linkedTruncated).toBe(true);
    });

    it('lets an expansion fill gaps but never overwrite a cell', () => {
        const merged = withExpandedCells(
            built.records,
            new Map([
                [
                    'article:A',
                    [
                        {
                            id: 'a-fr',
                            type: 'article',
                            axis: 'fr',
                            locale: 'fr',
                            ...draft
                        },
                        {
                            id: 'other',
                            type: 'article',
                            axis: 'en',
                            locale: 'en',
                            ...draft
                        }
                    ]
                ]
            ])
        );
        const boots = merged[0];
        expect([...boots.cells.keys()]).toEqual(['en', 'de', 'fr']);
        expect(boots.cells.get('en')?.id).toBe('a-en');
    });

    it('marks a blocked cell without touching the other records', () => {
        const marked = withBlocked(built.records, (id) => id === 'a-de');
        expect(marked[0].cells.get('de')?.blocked).toBe(true);
        expect(marked[0].cells.get('en')?.blocked).toBeUndefined();
        // Untouched records keep their identity, so nothing re-renders.
        expect(marked[1]).toBe(built.records[1]);
    });

    it('sections by type, the set’s own type first', () => {
        expect(
            sectionsOf(built.records, 'article').map((s) => [
                s.type,
                s.records.length
            ])
        ).toEqual([
            ['article', 2],
            ['author', 1],
            ['tag', 1]
        ]);
    });
});
