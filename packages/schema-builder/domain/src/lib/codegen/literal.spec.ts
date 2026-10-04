import { emitValue } from './emit-value';
import { objectLiteral } from './object-literal';
import { propertyKey } from './property-key';

describe('literals', () => {
    it('escapes strings for single quotes', () => {
        expect(emitValue("it's a \\ path\nnext")).toBe(
            "'it\\'s a \\\\ path\\nnext'"
        );
    });

    it('quotes keys that are not identifiers', () => {
        expect(propertyKey('startsAt')).toBe('startsAt');
        expect(propertyKey('data-id')).toBe("'data-id'");
    });

    it('drops undefined, puts raw code where asked, and orders the first keys', () => {
        expect(
            objectLiteral(
                { b: 1, a: undefined, c: 'x' },
                { raw: { to: '() => y' }, first: ['to', 'c'] }
            )
        ).toBe("{ to: () => y, c: 'x', b: 1 }");
        expect(objectLiteral({})).toBe('{}');
    });

    it('refuses what JSON cannot hold', () => {
        expect(() => emitValue(() => 1)).toThrow(
            'Cannot write a function into a content type file.'
        );
    });
});
