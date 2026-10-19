import { ApiError } from '@orthacms/utils-admin';
import { describe, expect, it } from 'vitest';
import { entryIssuesFrom, siblingSyncRefusalFrom } from './index';

const refusal = (details: unknown) => new ApiError(422, 'refused', details);

describe('siblingSyncRefusalFrom', () => {
    it('reads what an asked-first save would change in each other row', () => {
        const result = siblingSyncRefusalFrom(
            refusal({
                code: 'content.sibling_sync_unconfirmed',
                locales: ['de'],
                siblings: [],
                changes: [
                    {
                        type: 'article',
                        typeLabel: 'Articles',
                        entryId: 'de-1',
                        locale: 'de',
                        title: 'Wie Computer begannen',
                        sibling: true,
                        published: true,
                        optional: false,
                        fields: [
                            {
                                field: 'readingTime',
                                label: 'Reading time',
                                before: 7,
                                after: 9
                            }
                        ],
                        links: [
                            {
                                field: 'contributors',
                                label: 'Contributors',
                                added: [{ id: 'ada-de', title: 'Ada (DE)' }],
                                removed: [],
                                unresolved: [{ id: 'linus', title: 'Linus' }]
                            }
                        ]
                    }
                ]
            })
        );
        expect(result?.reached).toEqual(['de']);
        expect(result?.changes).toEqual([
            {
                type: 'article',
                typeLabel: 'Articles',
                entryId: 'de-1',
                locale: 'de',
                title: 'Wie Computer begannen',
                sibling: true,
                published: true,
                optional: false,
                fields: [
                    {
                        field: 'readingTime',
                        label: 'Reading time',
                        before: 7,
                        after: 9
                    }
                ],
                links: [
                    {
                        field: 'contributors',
                        label: 'Contributors',
                        added: [{ id: 'ada-de', title: 'Ada (DE)' }],
                        removed: [],
                        unresolved: [{ id: 'linus', title: 'Linus' }]
                    }
                ]
            }
        ]);
    });

    it('keeps another record’s optional row, and the invalidated row’s id', () => {
        const result = siblingSyncRefusalFrom(
            refusal({
                code: 'content.sibling_sync_unconfirmed',
                locales: [],
                siblings: [
                    {
                        locale: 'de',
                        entryId: 'de-1',
                        sibling: false,
                        issues: [{ field: 'title', message: 'is required' }]
                    }
                ],
                changes: [
                    {
                        type: 'article',
                        entryId: 'de-1',
                        locale: 'de',
                        sibling: false,
                        optional: true
                    }
                ]
            })
        );
        expect(result?.changes[0]).toMatchObject({
            typeLabel: 'article',
            title: null,
            sibling: false,
            optional: true,
            fields: [],
            links: []
        });
        expect(result?.invalidated).toEqual([
            {
                locale: 'de',
                entryId: 'de-1',
                sibling: false,
                issues: [{ field: 'title', message: 'is required' }]
            }
        ]);
    });

    it('drops malformed changes rather than rendering them', () => {
        const result = siblingSyncRefusalFrom(
            refusal({
                code: 'content.sibling_sync_unconfirmed',
                locales: ['de'],
                changes: [
                    null,
                    { entryId: 'no-type' },
                    {
                        type: 'article',
                        entryId: 'ok',
                        links: [
                            { field: 'tags', added: [{ id: 1 }, 'x'] },
                            { label: 'no field' }
                        ]
                    }
                ]
            })
        );
        expect(result?.changes.map((change) => change.entryId)).toEqual(['ok']);
        expect(result?.changes[0].links).toEqual([
            {
                field: 'tags',
                label: 'tags',
                added: [],
                removed: [],
                unresolved: []
            }
        ]);
    });

    it('answers the invalidation-only refusal with no changes', () => {
        expect(
            siblingSyncRefusalFrom(
                refusal({
                    code: 'content.sibling_invalidated',
                    siblings: [{ locale: 'de', issues: [] }]
                })
            )
        ).toEqual({
            reached: [],
            invalidated: [{ locale: 'de', issues: [] }],
            changes: []
        });
    });

    it('is not a refusal for an ordinary validation 422', () => {
        const error = refusal({
            issues: [{ field: 'title', message: 'is required' }]
        });
        expect(siblingSyncRefusalFrom(error)).toBeUndefined();
        expect(entryIssuesFrom(error)).toEqual([
            { field: 'title', message: 'is required' }
        ]);
    });
});
