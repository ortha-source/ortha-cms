import { checkGroupRefs } from './check-group-refs';

describe('checkGroupRefs', () => {
    const type = {
        name: 'event',
        kind: 'collection' as const,
        i18n: false,
        groups: { schedule: { label: 'Schedule' } },
        fields: {
            title: { type: 'text', required: false },
            startsAt: { type: 'datetime', required: false, group: 'schedule' },
            venue: { type: 'text', required: false, group: 'place' },
            odd: { type: 'text', required: false, group: 7 }
        }
    };

    it('reports each field naming an undeclared group, in field order', () => {
        expect(checkGroupRefs(type).map((i) => i.message)).toEqual([
            'Field "event.venue" names group "place", which "event" does not declare.',
            'Field "event.odd" names group "7", which "event" does not declare.'
        ]);
    });
});
