import {
    changeRecordKey,
    countRecords,
    permissionPreview
} from './permission-preview';
import type { ProposalDraft } from './proposal';

const draft = (overrides: Partial<ProposalDraft> = {}): ProposalDraft => ({
    kind: 'content.entry.bulk-save',
    target: { typeName: 'article' },
    patch: { items: [] },
    summary: 'Write a summary for 3 articles',
    ...overrides
});

describe('changeRecordKey', () => {
    it('prefers the record the binder named', () => {
        expect(
            changeRecordKey({
                field: 'items[0].summary',
                record: 'Spring launch',
                after: 'x'
            })
        ).toBe('record:Spring launch');
    });

    it('falls back to the batch position a bulk tool prefixes', () => {
        expect(changeRecordKey({ field: 'items[12].title', after: 'x' })).toBe(
            'items[12]'
        );
    });

    it('treats a plain field as one record', () => {
        expect(changeRecordKey({ field: 'summary', after: 'x' })).toBe(
            'single'
        );
    });
});

describe('countRecords', () => {
    it('counts distinct records, not fields', () => {
        expect(
            countRecords([
                { field: 'items[0].title', after: 'a' },
                { field: 'items[0].summary', after: 'b' },
                { field: 'items[1].summary', after: 'c' }
            ])
        ).toBe(2);
    });

    it('never says zero — a change with no diff is still one record', () => {
        expect(countRecords([])).toBe(1);
    });
});

describe('permissionPreview', () => {
    it('carries the summary, the kind and where the change lands', () => {
        const preview = permissionPreview(
            draft({
                lands: 'draft',
                changes: [
                    {
                        field: 'items[0].summary',
                        record: 'Spring launch',
                        before: null,
                        after: 'Everything that shipped'
                    }
                ]
            })
        );

        expect(preview).toEqual({
            kind: 'content.entry.bulk-save',
            summary: 'Write a summary for 3 articles',
            lands: 'draft',
            records: 1,
            changes: [
                {
                    field: 'items[0].summary',
                    record: 'Spring launch',
                    before: null,
                    after: 'Everything that shipped'
                }
            ],
            omitted: 0
        });
    });

    it('omits `lands` when the binder could not say', () => {
        expect(permissionPreview(draft())).not.toHaveProperty('lands');
    });

    it('caps the changes it carries and counts what it left out', () => {
        const changes = Array.from({ length: 5 }, (_, index) => ({
            field: `items[${index}].summary`,
            after: `summary ${index}`
        }));

        const preview = permissionPreview(draft({ changes }), 2);

        expect(preview.changes).toHaveLength(2);
        expect(preview.omitted).toBe(3);
        // The count is of the whole change, not of what fitted.
        expect(preview.records).toBe(5);
    });
});
