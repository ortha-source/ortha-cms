import { groupChanges } from './groupChanges';

describe('groupChanges', () => {
    it('groups a batch under each record, in first-seen order', () => {
        const groups = groupChanges([
            {
                field: 'items[0].summary',
                record: 'Spring launch',
                before: '',
                after: 'Everything that shipped'
            },
            {
                field: 'items[1].summary',
                record: 'Webhooks, retried',
                before: null,
                after: 'Deliveries that survive'
            },
            {
                field: 'items[0].title',
                record: 'Spring launch',
                before: 'Spring launch',
                after: 'Spring launch — what changed'
            }
        ]);

        expect(groups.map((group) => group.record)).toEqual([
            'Spring launch',
            'Webhooks, retried'
        ]);
        expect(groups[0].changes.map((change) => change.field)).toEqual([
            'items[0].summary',
            'items[0].title'
        ]);
    });

    it('falls back to the batch position when no record was named', () => {
        const groups = groupChanges([
            { field: 'items[0].title', label: '#1 Title', after: 'a' },
            { field: 'items[1].title', label: '#2 Title', after: 'b' }
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0]).not.toHaveProperty('record');
    });

    it('keeps a single-entry change as one group', () => {
        const groups = groupChanges([
            { field: 'title', after: 'a' },
            { field: 'summary', after: 'b' }
        ]);

        expect(groups).toHaveLength(1);
        expect(groups[0].changes).toHaveLength(2);
    });
});
