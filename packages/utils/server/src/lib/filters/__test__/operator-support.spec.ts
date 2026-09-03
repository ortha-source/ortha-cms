import { FilterErrorCode, FilterException } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import type { FilterSchema, ParsedRule } from '../types';

/**
 * A filter leaf has three axes — field, operator, value — and until this guard
 * the parser checked two. `?filter={"field":"embargoUntil","op":"ilike",…}` named
 * a whitelisted field and carried a value the field's type accepted, so it
 * passed both checks and reached Postgres as `"embargo_until" ilike $3`:
 *
 * ```
 * error: operator does not exist: timestamp with time zone ~~* unknown
 * ```
 *
 * i.e. a **user-triggerable 500 from a shareable link** — anyone who can read a
 * collection could hand someone a URL that broke their page — reported as an
 * unhandled driver error, so the admin had no per-field issue to render.
 *
 * The guard mirrors what the column can answer, not what the admin's picker
 * offers: `like`/`ilike`/`nilike` are Postgres' text-only `~~` class, and
 * everything else stays as permissive as the database is.
 */
const schema: FilterSchema = {
    fields: {
        id: { type: 'uuid' },
        email: { type: 'string' },
        age: { type: 'number' },
        active: { type: 'boolean' },
        embargoUntil: { type: 'date' },
        status: { type: 'enum', enumValues: ['draft', 'published'] }
    },
    relations: {
        author: {
            kind: 'many-to-one',
            table: undefined as never,
            fk: undefined as never,
            fields: { name: { type: 'string' }, bornOn: { type: 'date' } }
        }
    }
};

/** Parse one leaf, expecting a rejection, and return the thrown exception. */
const reject = (field: string, op: string, value: unknown): FilterException => {
    try {
        parseFilterTree({ field, op, value }, schema);
    } catch (e) {
        return e as FilterException;
    }
    throw new Error(`expected ${field} ${op} to be rejected`);
};

/** Parse one leaf that is expected to be accepted, and return the rule. */
const accept = (field: string, op: string, value: unknown): ParsedRule =>
    parseFilterTree({ field, op, value }, schema) as ParsedRule;

describe('operator legality per field type', () => {
    describe('the pattern family on a non-textual column', () => {
        it.each([
            ['embargoUntil', 'date'],
            ['age', 'number'],
            ['active', 'boolean'],
            ['id', 'uuid']
        ])(
            // covers: utils:I-24
            'rejects ilike on %s (a %s field) instead of 500ing out of the driver',
            (field) => {
                const e = reject(field, 'ilike', '%2020%');
                expect(e).toBeInstanceOf(FilterException);
                expect(e.getStatus()).toBe(400);
                expect(e.code).toBe(FilterErrorCode.OperatorNotAllowed);
            }
        );

        it.each(['like', 'ilike', 'nilike'])(
            'rejects %s, not just ilike',
            (op) => {
                expect(reject('embargoUntil', op, '%x%').code).toBe(
                    FilterErrorCode.OperatorNotAllowed
                );
            }
        );

        it('names the field, the operator and what the field does offer', () => {
            // The whole point of a typed rejection over a driver error: the
            // client gets a per-field issue it can render and repair.
            const e = reject('embargoUntil', 'ilike', '%2020%');
            expect(e.context).toMatchObject({
                path: 'embargoUntil',
                op: 'ilike',
                fieldType: 'date'
            });
            expect(e.context.allowed).toEqual(
                expect.arrayContaining(['eq', 'gt', 'lt', 'in', 'null'])
            );
            expect(e.context.allowed).not.toEqual(
                expect.arrayContaining(['ilike'])
            );
        });

        it('reports the operator rather than a value the operator never had a use for [utils:I-24]', () => {
            // Checked before coercion: "%2020%" is not a date either, but
            // "not a date" would point the caller at the value and leave them
            // to discover that no value at all would have worked.
            expect(reject('embargoUntil', 'ilike', '%2020%').message).toMatch(
                /operator "ilike" is not available/
            );
        });

        it('rejects it on a relation hop too, naming the full path', () => {
            const e = reject('author.bornOn', 'ilike', '%199%');
            expect(e.code).toBe(FilterErrorCode.OperatorNotAllowed);
            expect(e.context.path).toBe('author.bornOn');
        });
    });

    describe('what stays legal', () => {
        it('keeps the pattern family on text-backed columns', () => {
            expect(accept('email', 'ilike', '%@example.com').op).toBe('ilike');
            expect(accept('status', 'like', 'draft').op).toBe('like');
        });

        it.each(['eq', 'ne', 'gt', 'gte', 'lt', 'lte'])(
            'keeps %s on a date — the admin picker drops eq for editor precision, the API must not',
            (op) => {
                expect(accept('embargoUntil', op, '2026-01-01').op).toBe(op);
            }
        );

        it('keeps ne / in / null on a boolean, which the admin offers only eq for', () => {
            expect(accept('active', 'ne', 'true').op).toBe('ne');
            expect(accept('active', 'in', 'true,false').op).toBe('in');
            expect(accept('active', 'null', 'true').op).toBe('null');
        });

        it('keeps ordering and membership on every type', () => {
            expect(accept('age', 'gte', 18).op).toBe('gte');
            expect(
                accept('id', 'in', ['11111111-1111-1111-1111-111111111111']).op
            ).toBe('in');
            expect(accept('status', 'nin', 'draft').op).toBe('nin');
        });
    });

    it('still reports an operator outside the vocabulary as unknown, not disallowed', () => {
        // Two different faults: `sounds_like` is not an operator at all, while
        // `ilike` is one this column cannot answer.
        expect(reject('email', 'sounds_like', 'x').code).toBe(
            FilterErrorCode.UnknownOperator
        );
    });

    it('leaves an unrecognised declared type to the schema exception', () => {
        // A runtime-built schema naming a type this table does not know is a
        // schema bug (a 500 from `scalarOf`), not the caller's mistake — so the
        // operator check stands aside rather than answering 400.
        const broken: FilterSchema = {
            fields: { odd: { type: 'geometry' as never } }
        };
        expect(() =>
            parseFilterTree({ field: 'odd', op: 'ilike', value: 'x' }, broken)
        ).toThrow(/unknown type "geometry"/);
    });
});
