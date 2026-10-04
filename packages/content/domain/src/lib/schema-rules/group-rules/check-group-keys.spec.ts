import { checkGroupKeys } from './check-group-keys';

const type = (groups: Record<string, { label?: unknown }>) => ({
    name: 'event',
    kind: 'collection' as const,
    i18n: false,
    fields: {},
    groups
});

describe('checkGroupKeys', () => {
    it('accepts identifier keys with labels', () => {
        expect(
            checkGroupKeys(
                type({
                    schedule: { label: 'Schedule' },
                    seo_2: { label: 'SEO' }
                })
            )
        ).toEqual([]);
    });

    it('rejects a key that is not an identifier', () => {
        const [found] = checkGroupKeys(type({ '2nd': { label: 'Second' } }));
        expect(found).toEqual({
            path: 'event.groups.2nd',
            code: 'group.key',
            message:
                'Group "event.2nd" must be an identifier (letters, digits, underscores; starting with a letter).'
        });
    });

    it.each([[undefined], ['   '], [42]])('rejects label %j', (label) => {
        const [found] = checkGroupKeys(type({ seo: { label } }));
        expect(found.message).toBe('Group "event.seo" needs a label.');
    });
});
