import { DEFAULT_MAX_VALUE_LENGTH, FILTER_MAX_LENGTH } from '../budgets';
import { FilterErrorCode, type FilterException } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import type { FilterSchema, ParsedRule } from '../types';

/**
 * The engine budgeted four things and none of them was **text**.
 *
 * `maxNodes`, `maxDepth`, `maxGroupDepth` and `maxInListLength` all bound the
 * tree's *structure*; a single well-formed rule could carry a string of any
 * length through every one of them. On an endpoint with a DTO that did not
 * matter — `@MaxLength(FILTER_MAX_LENGTH)` on the serialised `?filter=` caps
 * the whole payload before `JSON.parse` sees it. The problem is the paths that
 * never meet a DTO, and there are four of them:
 *
 * - an **alarm rule** — `CreateAlarmRuleDto.filter` is `@IsObject()`, because
 *   the authority on a tree's shape is this parser rather than a second copy of
 *   the grammar in decorators, and `@MaxLength` is a string decorator that
 *   could not have been applied to it;
 * - the **same rule replayed out of its `jsonb` column** by the outbox
 *   subscriber, the sweep, or `POST /rules/:id/rescan` — nothing re-serialises
 *   it on the way out of the database, so there is no string to measure;
 * - the copilot's **`admin_content_search`** tool, whose `filter` argument is
 *   an object and whose registry input check ignores `anyOf`;
 * - GraphQL's **entry loader**, which builds a tree in code and casts past the
 *   DTO.
 *
 * On those the parser is the whole boundary, and the only remaining bound was
 * the 1 MB body limit. These tests pin the budget that closes them, and the
 * fact that it costs the DTO-guarded paths nothing.
 */
const schema: FilterSchema = {
    fields: {
        email: { type: 'string' },
        title: { type: 'string' },
        age: { type: 'number' }
    }
};

/** Parse one leaf expecting a rejection, and return the thrown exception. */
const reject = (field: string, op: string, value: unknown): FilterException => {
    try {
        parseFilterTree({ field, op, value }, schema);
    } catch (e) {
        return e as FilterException;
    }
    throw new Error(`expected ${field} ${op} to be rejected`);
};

describe('a clause value has a length budget', () => {
    it('refuses a pattern longer than the default budget', () => {
        const err = reject(
            'email',
            'ilike',
            `%${'a'.repeat(DEFAULT_MAX_VALUE_LENGTH)}%`
        );
        expect(err.code).toBe(FilterErrorCode.ValueTooLong);
        expect(err.getStatus()).toBe(400);
    });

    it('names the offending clause, not just the filter', () => {
        const err = reject('title', 'eq', 'x'.repeat(9000));
        expect(err.context).toEqual({
            path: 'title',
            maxValueLength: DEFAULT_MAX_VALUE_LENGTH,
            length: 9000
        });
    });

    it('accepts a value exactly at the budget', () => {
        const value = 'a'.repeat(DEFAULT_MAX_VALUE_LENGTH);
        const rule = parseFilterTree(
            { field: 'email', op: 'ilike', value },
            schema
        ) as ParsedRule;
        expect(rule.value).toBe(value);
    });

    it('applies per element of an `in` list, not to the list as a whole', () => {
        // Two hundred short values are well past the budget when concatenated
        // and legal one by one: the cap must be the element's, or a list of
        // ordinary ids would start 400ing.
        const many = Array.from({ length: 100 }, (_, i) => `id-${i}`);
        expect(
            (
                parseFilterTree(
                    { field: 'email', op: 'in', value: many },
                    schema
                ) as ParsedRule
            ).value
        ).toEqual(many);

        const err = reject('email', 'in', ['fine', 'b'.repeat(5000)]);
        expect(err.code).toBe(FilterErrorCode.ValueTooLong);
        expect(err.context['length']).toBe(5000);
    });

    it('is overridable per schema, like every other budget', () => {
        const tight: FilterSchema = { ...schema, maxValueLength: 4 };
        expect(() =>
            parseFilterTree({ field: 'email', op: 'eq', value: 'abcd' }, tight)
        ).not.toThrow();
        try {
            parseFilterTree(
                { field: 'email', op: 'eq', value: 'abcde' },
                tight
            );
            throw new Error('expected a rejection');
        } catch (e) {
            expect((e as FilterException).code).toBe(
                FilterErrorCode.ValueTooLong
            );
        }
    });

    /**
     * The reason the default is `FILTER_MAX_LENGTH` and not something smaller.
     *
     * A filter that arrives as a string is capped at that length **in total**,
     * so no value inside one can be longer than it — which makes this budget
     * provably unable to refuse anything an HTTP caller could already send. It
     * exists for the callers that never pass a DTO at all.
     */
    it('cannot refuse anything the DTO cap would have let through', () => {
        expect(DEFAULT_MAX_VALUE_LENGTH).toBe(FILTER_MAX_LENGTH);

        const longest = JSON.stringify({
            field: 'email',
            op: 'ilike',
            value: 'a'.repeat(FILTER_MAX_LENGTH)
        });
        // The largest value that fits inside a filter string the DTO admits is
        // smaller than the string itself, by the JSON envelope around it.
        expect(longest.length).toBeGreaterThan(FILTER_MAX_LENGTH);
    });

    it('leaves a number alone — its String() form can never reach the budget', () => {
        const rule = parseFilterTree(
            { field: 'age', op: 'eq', value: 42 },
            schema
        ) as ParsedRule;
        expect(rule.value).toBe(42);
    });
});
