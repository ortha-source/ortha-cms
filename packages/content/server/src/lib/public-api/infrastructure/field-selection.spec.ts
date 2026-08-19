import { collection } from '../../collection/define';
import { field } from '../../fields';
import { parseFieldSelection } from './field-selection';

const author = collection('sel_author', { fields: { name: field.text({}) } });

const post = collection('sel_post', {
    fields: {
        title: field.text({}),
        views: field.number({}),
        cover: field.media({}),
        author: field.relation({ to: () => author })
    }
});

describe('parseFieldSelection', () => {
    it('returns undefined when the parameter is absent', () => {
        expect(parseFieldSelection(post, undefined)).toBeUndefined();
    });

    it('reads an empty selection as "no preference", not "no fields"', () => {
        // An empty `values` bag is never what a caller meant by `?fields=`.
        expect(parseFieldSelection(post, '')).toBeUndefined();
        expect(parseFieldSelection(post, '  ,  ,')).toBeUndefined();
    });

    it('parses a list, trimming and de-duplicating', () => {
        expect(parseFieldSelection(post, ' title , views , title ')).toEqual(
            new Set(['title', 'views'])
        );
    });

    it('rejects an unknown field by name', () => {
        expect(() => parseFieldSelection(post, 'title,nope')).toThrow(
            /unknown field "nope"/
        );
    });

    it('rejects a media field with a reason, not just "unknown"', () => {
        // The field exists — saying "unknown" would send the caller hunting a
        // typo instead of telling them the API can't return it yet.
        expect(() => parseFieldSelection(post, 'cover')).toThrow(
            /cannot be selected/
        );
    });

    it('rejects a relation field with the same reason', () => {
        expect(() => parseFieldSelection(post, 'author')).toThrow(
            /cannot be selected/
        );
    });

    describe('names a plain object merely inherits', () => {
        // The field map is the host's object literal, so `type.fields[name]`
        // also resolved everything `Object.prototype` carries. `constructor`
        // read back `Object` — truthy, so the "unknown field" 400 never fired
        // — and `isPureValueField(Object)` asked for `Object.type`, `undefined`,
        // which is not a reference type, so the second 400 didn't fire either.
        // The name landed in the selected set and reached the projection
        // builder, which put a class function into the `.select()` list: a 500
        // out of drizzle on a public, token-authenticated endpoint.
        it.each([
            'constructor',
            'toString',
            'valueOf',
            'hasOwnProperty',
            'isPrototypeOf',
            'propertyIsEnumerable',
            'toLocaleString',
            '__proto__'
        ])('rejects %s as an unknown field', (name) => {
            expect(() => parseFieldSelection(post, name)).toThrow(
                new RegExp(`unknown field "${name}"`)
            );
        });

        it('rejects it alongside real fields rather than selecting the rest', () => {
            expect(() =>
                parseFieldSelection(post, 'title,constructor,views')
            ).toThrow(/unknown field "constructor"/);
        });
    });

    it('rejects an over-long selection', () => {
        const names = Array.from({ length: 101 }, (_, i) => `f${i}`).join(',');
        expect(() => parseFieldSelection(post, names)).toThrow(
            /at most 100 names/
        );
    });
});
