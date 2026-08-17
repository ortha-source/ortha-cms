import { FilterErrorCode, FilterException } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import type { FilterSchema, ParsedRule } from '../types';

const schema: FilterSchema = {
    fields: {
        id: { type: 'uuid' },
        email: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
        createdAt: { type: 'date' },
        status: { type: 'enum', enumValues: ['active', 'disabled'] }
    }
};

/** Parse one leaf and return the coerced value. */
const coerce = (field: string, op: string, value: unknown): unknown =>
    (parseFilterTree({ field, op, value }, schema) as ParsedRule).value;

/** Parse one leaf, expecting a rejection, and return the thrown exception. */
const reject = (
    field: string,
    op: string,
    value?: unknown
): FilterException => {
    const node = value === undefined ? { field, op } : { field, op, value };
    try {
        parseFilterTree(node, schema);
    } catch (e) {
        return e as FilterException;
    }
    throw new Error(`expected ${field} ${op} to be rejected`);
};

describe('scalar coercion', () => {
    describe('string', () => {
        it('passes a string through unchanged, including the empty string', () => {
            expect(coerce('email', 'eq', 'a@b.c')).toBe('a@b.c');
            expect(coerce('email', 'eq', '')).toBe('');
        });

        it('accepts a JSON number or boolean, stringified', () => {
            // A URL-shaped API legitimately receives these as JSON scalars.
            expect(coerce('email', 'eq', 12)).toBe('12');
            expect(coerce('email', 'eq', true)).toBe('true');
        });

        it('rejects null instead of searching for the text "null"', () => {
            // `String(v)` used to stringify every non-string, so a client
            // sending `"value": null` meaning "no value" got a 200 and an
            // empty result set from `email = 'null'` — the one silent failure
            // mode in a library that 400s every other bad value. "Is null" is
            // what the `null` operator is for.
            const e = reject('email', 'eq', null);
            expect(e).toBeInstanceOf(FilterException);
            expect(e.code).toBe(FilterErrorCode.InvalidValue);
            expect(e.message).toMatch(/string, number or boolean/);
        });

        it('rejects a missing `value` key instead of searching for "undefined"', () => {
            const e = reject('email', 'eq');
            expect(e.code).toBe(FilterErrorCode.InvalidValue);
            expect(e.message).toMatch(/value is required/);
        });

        it('rejects an object and an array', () => {
            // `"[object Object]"` and `"1,2"` respectively, before the guard.
            expect(reject('email', 'eq', {}).code).toBe(
                FilterErrorCode.InvalidValue
            );
            expect(reject('email', 'eq', [1, 2]).code).toBe(
                FilterErrorCode.InvalidValue
            );
        });
    });

    describe('number', () => {
        it('parses a numeric string', () => {
            expect(coerce('age', 'eq', '12')).toBe(12);
            expect(coerce('age', 'eq', 12)).toBe(12);
        });

        it('rejects a non-numeric string and Infinity', () => {
            expect(reject('age', 'eq', 'abc').code).toBe(
                FilterErrorCode.InvalidValue
            );
            expect(reject('age', 'eq', 'Infinity').code).toBe(
                FilterErrorCode.InvalidValue
            );
        });

        it('rejects an empty array rather than coercing it to 0', () => {
            // `String([])` is `''` and `Number('')` is `0` — a filter for
            // "age = 0" nobody asked for.
            expect(reject('age', 'eq', []).code).toBe(
                FilterErrorCode.InvalidValue
            );
        });
    });

    describe('boolean', () => {
        it('accepts the string and the JSON literal', () => {
            expect(coerce('active', 'eq', 'true')).toBe(true);
            expect(coerce('active', 'eq', true)).toBe(true);
            expect(coerce('active', 'eq', 'false')).toBe(false);
            expect(coerce('active', 'eq', false)).toBe(false);
        });

        it('rejects "1" / "yes"', () => {
            expect(reject('active', 'eq', '1').code).toBe(
                FilterErrorCode.InvalidValue
            );
            expect(reject('active', 'eq', 'yes').code).toBe(
                FilterErrorCode.InvalidValue
            );
        });
    });

    describe('uuid', () => {
        it('accepts a canonical uuid in either case', () => {
            const lower = '11111111-1111-1111-1111-111111111111';
            expect(coerce('id', 'eq', lower)).toBe(lower);
            const upper = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';
            expect(coerce('id', 'eq', upper)).toBe(upper);
        });

        it('rejects 36 dashes — never a failed Postgres cast', () => {
            expect(reject('id', 'eq', '-'.repeat(36)).code).toBe(
                FilterErrorCode.InvalidValue
            );
        });
    });

    describe('date', () => {
        it('parses an ISO instant into a Date', () => {
            const v = coerce('createdAt', 'gte', '2024-01-01T00:00:00Z');
            expect(v).toBeInstanceOf(Date);
            expect((v as Date).toISOString()).toBe('2024-01-01T00:00:00.000Z');
        });

        it('rejects an unparseable date', () => {
            expect(reject('createdAt', 'gte', 'not-a-date').code).toBe(
                FilterErrorCode.InvalidValue
            );
        });
    });

    describe('enum', () => {
        it('accepts a declared value', () => {
            expect(coerce('status', 'eq', 'active')).toBe('active');
        });

        it('rejects an undeclared value and lists what is allowed', () => {
            const e = reject('status', 'eq', 'banned');
            expect(e.code).toBe(FilterErrorCode.InvalidValue);
            expect(e.context).toMatchObject({
                expectedType: 'enum',
                allowed: ['active', 'disabled']
            });
        });
    });

    describe('the `null` operator', () => {
        it('accepts true/false as string or boolean', () => {
            expect(coerce('email', 'null', true)).toBe(true);
            expect(coerce('email', 'null', 'true')).toBe(true);
            expect(coerce('email', 'null', false)).toBe(false);
            expect(coerce('email', 'null', 'false')).toBe(false);
        });

        it('rejects anything else', () => {
            const e = reject('email', 'null', 'yes');
            expect(e.code).toBe(FilterErrorCode.InvalidValue);
            expect(e.message).toMatch(/null filter accepts only true\|false/);
        });
    });

    describe('`in` / `nin` lists', () => {
        it('accepts an array and a comma-separated string alike', () => {
            expect(coerce('status', 'in', ['active', 'disabled'])).toEqual([
                'active',
                'disabled'
            ]);
            expect(coerce('status', 'in', 'active,disabled')).toEqual([
                'active',
                'disabled'
            ]);
        });

        it('coerces every element, rejecting the first bad one', () => {
            expect(reject('status', 'in', ['active', 'banned']).code).toBe(
                FilterErrorCode.InvalidValue
            );
            expect(reject('age', 'in', ['1', 'abc']).code).toBe(
                FilterErrorCode.InvalidValue
            );
        });

        it('rejects a null element rather than matching the text "null"', () => {
            expect(reject('email', 'in', ['a@b.c', null]).code).toBe(
                FilterErrorCode.InvalidValue
            );
        });
    });
});
