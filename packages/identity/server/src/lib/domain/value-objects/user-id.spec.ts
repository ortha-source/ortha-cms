import { InvalidUserIdError } from '../errors';
import { UserId } from './user-id';

/**
 * The id is validated at the application boundary so a caller-supplied path
 * segment cannot travel into the domain — and, further down, into a query — as
 * anything but a UUID. `generate` and `create` must therefore agree: a freshly
 * minted id has to satisfy the check every loaded id is held to.
 */
describe('UserId', () => {
    describe('create', () => {
        it('accepts a UUID', () => {
            const value = '11111111-1111-4111-8111-111111111111';
            expect(UserId.create(value).value).toBe(value);
        });

        it('accepts an upper-case UUID as written', () => {
            const value = '11111111-1111-4111-8111-11111111111A';
            expect(UserId.create(value).value).toBe(value);
        });

        it.each([
            ['an empty string', ''],
            ['a bare word', 'not-a-uuid'],
            ['a UUID without dashes', '11111111111141118111111111111111'],
            ['a truncated UUID', '11111111-1111-4111-8111-1111111111'],
            ['a non-hex digit', '11111111-1111-4111-8111-11111111111z'],
            ['trailing whitespace', '11111111-1111-4111-8111-111111111111 '],
            ['a SQL fragment', "1' OR '1'='1"]
        ])('rejects %s', (_case, value) => {
            expect(() => UserId.create(value)).toThrow(InvalidUserIdError);
        });
    });

    describe('generate', () => {
        it('mints a value create accepts', () => {
            const generated = UserId.generate();
            expect(() => UserId.create(generated.value)).not.toThrow();
            expect(UserId.create(generated.value).equals(generated)).toBe(true);
        });

        it('mints a distinct value each time', () => {
            expect(UserId.generate().value).not.toBe(UserId.generate().value);
        });
    });
});
