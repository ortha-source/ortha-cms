import { checkPattern } from './check-pattern';

const pass = { columns: new Map<string, string>() };
const type = {
    name: 'event',
    kind: 'collection' as const,
    i18n: false,
    fields: {}
};
const text = (pattern?: string) => ({ type: 'text', required: false, pattern });

describe('checkPattern', () => {
    it('accepts no pattern and a safe one', () => {
        expect(checkPattern(type, 'slug', text(), pass)).toEqual([]);
        expect(
            checkPattern(type, 'slug', text('^[a-z0-9]+(?:-[a-z0-9]+)*$'), pass)
        ).toEqual([]);
    });

    it('rejects a pattern that does not compile', () => {
        const [found] = checkPattern(type, 'slug', text('('), pass);
        expect(found.message).toBe(
            'Field "event.slug" has pattern "(", which is not a valid regular expression.'
        );
    });

    it('rejects a pattern validation would refuse to run', () => {
        const [found] = checkPattern(type, 'slug', text('^(a+)+$'), pass);
        expect(found.message).toMatch(
            /could take very long to run on some input\.$/
        );
    });
});
