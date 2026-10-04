import { checkEmptyGroups } from './check-empty-groups';

describe('checkEmptyGroups', () => {
    it('reports a group no field joins', () => {
        const type = {
            name: 'event',
            kind: 'collection' as const,
            i18n: false,
            groups: {
                schedule: { label: 'Schedule' },
                venue: { label: 'Venue' }
            },
            fields: {
                startsAt: {
                    type: 'datetime',
                    required: false,
                    group: 'schedule'
                }
            }
        };
        expect(checkEmptyGroups(type)).toEqual([
            {
                path: 'event.groups.venue',
                code: 'group.empty',
                message:
                    'Group "event.venue" has no fields — set admin.group on at least one field, or remove it.'
            }
        ]);
    });
});
