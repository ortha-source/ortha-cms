import type { SQL } from 'drizzle-orm';
import { PgDialect, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { FilterErrorCode, FilterException } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import { applyFilterTree } from '../tree-to-drizzle';
import type { DbLike } from '../table-helpers';
import type { FilterSchema, ParsedRule } from '../types';

const schema: FilterSchema = {
    fields: {
        title: { type: 'string' },
        updatedAt: { type: 'date' }
    }
};

const entries = pgTable('entries', {
    id: uuid('id').primaryKey(),
    title: text('title'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
});

/** The translator needs a db only for subqueries; a scalar leaf never uses it. */
const db = {} as DbLike;

const dialect = new PgDialect();

/** The rendered SQL text, whitespace-normalised — as the other specs do it. */
const serialize = (statement: SQL): string =>
    dialect.sqlToQuery(statement).sql.replace(/\s+/g, ' ').trim();

/** Parse one leaf and return the coerced value. */
const coerce = (op: string, value: unknown): unknown =>
    (parseFilterTree({ field: 'updatedAt', op, value }, schema) as ParsedRule)
        .value;

/** Parse one leaf, expecting a rejection, and return the thrown exception. */
const reject = (field: string, value: unknown): FilterException => {
    try {
        parseFilterTree({ field, op: 'within_last', value }, schema);
    } catch (error) {
        return error as FilterException;
    }
    throw new Error(`expected within_last on ${field} to be rejected`);
};

describe('within_last', () => {
    it('coerces a well-formed window', () => {
        expect(coerce('within_last', { n: 90, unit: 'days' })).toEqual({
            n: 90,
            unit: 'days'
        });
        expect(coerce('within_last', { n: '30', unit: 'minutes' })).toEqual({
            n: 30,
            unit: 'minutes'
        });
    });

    it('is rejected on a non-date field', () => {
        // A relative window compares against now(); on a text column that is a
        // category error, and Postgres would report it as a type mismatch the
        // client cannot act on.
        const error = reject('title', { n: 7, unit: 'days' });
        expect(error.code).toBe(FilterErrorCode.OperatorNotAllowed);
    });

    it('rejects a value that is not an object', () => {
        for (const value of ['7d', 7, null, ['7', 'days']]) {
            expect(reject('updatedAt', value).code).toBe(
                FilterErrorCode.InvalidValue
            );
        }
    });

    it('rejects an unknown unit', () => {
        expect(reject('updatedAt', { n: 7, unit: 'weeks' }).code).toBe(
            FilterErrorCode.InvalidValue
        );
        expect(reject('updatedAt', { n: 7, unit: 7 }).code).toBe(
            FilterErrorCode.InvalidValue
        );
    });

    it('rejects a non-positive or non-integer n', () => {
        for (const n of [0, -1, 1.5, 'many']) {
            expect(reject('updatedAt', { n, unit: 'days' }).code).toBe(
                FilterErrorCode.InvalidValue
            );
        }
    });

    it('rejects an n that would overflow a timestamp', () => {
        // `now() - make_interval(days => 1e9)` is a Postgres 22008, which the
        // caller sees as a 500. A window that long means "everything", and the
        // client should be told so rather than handed a stack trace.
        expect(
            reject('updatedAt', { n: 10_000_001, unit: 'days' }).code
        ).toBe(FilterErrorCode.InvalidValue);
    });

    it('translates to a now()-relative comparison, not a baked-in cutoff', async () => {
        // The whole reason this operator survives to the server: the cutoff has
        // to be computed by the database at query time, so a stored filter
        // replayed a month later still means "the last 90 days".
        const tree = parseFilterTree(
            { field: 'updatedAt', op: 'within_last', value: { n: 90, unit: 'days' } },
            schema
        );
        const statement = await applyFilterTree(tree, schema, entries, db);
        expect(statement).toBeDefined();
        const rendered = serialize(statement as SQL);
        expect(rendered).toContain('now()');
        expect(rendered).toContain('make_interval');
        // The window size is a bound parameter, never interpolated.
        expect(rendered).not.toContain('90');
    });

    it('emits the unit the caller asked for', async () => {
        const forUnit = async (unit: string) => {
            const tree = parseFilterTree(
                { field: 'updatedAt', op: 'within_last', value: { n: 2, unit } },
                schema
            );
            return serialize(
                (await applyFilterTree(tree, schema, entries, db)) as SQL
            );
        };
        expect(await forUnit('minutes')).toContain('mins =>');
        expect(await forUnit('hours')).toContain('hours =>');
        expect(await forUnit('days')).toContain('days =>');
    });
});
