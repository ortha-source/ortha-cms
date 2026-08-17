import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { PgDialect, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { FilterErrorCode, FilterException } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import { applyFilterTree, type DbLike } from '../tree-to-drizzle';
import type { FilterSchema } from '../types';

/**
 * The `FilterSchema` is the security boundary — "only whitelisted
 * fields/ops/relations reach SQL" (`AGENTS.md`). Every whitelist in the
 * package is a plain object literal, so an unguarded `map[name]` lookup also
 * resolves `Object.prototype`'s members and the guard stops being one.
 *
 * Both downstream outcomes were live defects, reachable from any filterable
 * endpoint with a one-word query param:
 *
 * - a scalar path reached `columnOf`, which resolved the same inherited member
 *   off drizzle's column map and handed a `Function` to drizzle as a `Column`.
 *   The emitted fragment was `$1 = ` — a Postgres syntax error, i.e. a
 *   user-triggerable **500**. Observed on `GET /api/users?filter=
 *   {"field":"constructor","op":"eq","value":"x"}` before this fix.
 * - a relation-shaped path (`toString.constructor`) fell out of
 *   `relationExists`'s `switch (rel.kind)` as `undefined`, so the predicate was
 *   **silently dropped** and the endpoint answered 200 unfiltered.
 */

const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 })
});
const roles = pgTable('roles', {
    id: uuid('id').primaryKey(),
    key: varchar('key', { length: 32 })
});

const stubSubquery: SQLWrapper = { getSQL: () => sql`select 1 from stub` };
const mockDb: DbLike = {
    select: () => ({
        from: () => ({
            where: () => stubSubquery,
            innerJoin: () => ({ where: () => stubSubquery })
        })
    })
};

/** A realistic consumer schema: both maps present, both plain objects. */
const schema: FilterSchema = {
    fields: { id: { type: 'uuid' }, email: { type: 'string' } },
    relations: {
        role: {
            kind: 'many-to-one',
            table: roles,
            fk: users.id,
            fields: { key: { type: 'string' } }
        }
    }
};

/** Names every plain object inherits — none of them is a declared field. */
const INHERITED = [
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString'
];

describe('schema lookups ignore inherited Object.prototype members', () => {
    describe('as a leaf field', () => {
        for (const name of INHERITED) {
            it(`rejects "${name}" with FILTER_UNKNOWN_FIELD`, () => {
                expect(() =>
                    parseFilterTree(
                        { field: name, op: 'eq', value: 'x' },
                        schema
                    )
                ).toThrow(FilterException);
                try {
                    parseFilterTree(
                        { field: name, op: 'eq', value: 'x' },
                        schema
                    );
                } catch (e) {
                    expect((e as FilterException).code).toBe(
                        FilterErrorCode.UnknownField
                    );
                }
            });
        }

        it('rejects one nested under a declared relation', () => {
            // `rel.fields` is a plain object too, so the second hop needs the
            // same guard as the first.
            expect(() =>
                parseFilterTree(
                    { field: 'role.constructor', op: 'eq', value: 'x' },
                    schema
                )
            ).toThrow(/unknown field "role.constructor"/);
        });
    });

    describe('as a mid-path relation segment', () => {
        for (const name of INHERITED) {
            it(`rejects "${name}.key" with FILTER_UNKNOWN_RELATION`, () => {
                try {
                    parseFilterTree(
                        { field: `${name}.key`, op: 'eq', value: 'x' },
                        schema
                    );
                    throw new Error('expected a FilterException');
                } catch (e) {
                    expect(e).toBeInstanceOf(FilterException);
                    expect((e as FilterException).code).toBe(
                        FilterErrorCode.UnknownRelation
                    );
                }
            });
        }
    });

    it('is unreachable at the translator too, if a tree is hand-built', async () => {
        // The parser is the primary guard, but `applyFilterTree` accepts a
        // `ParsedNode` directly (the copilot builds one), so its own
        // `schema.relations[key]` lookup must not accept an inherited name
        // either — the failure mode there is a dropped predicate, not an error.
        await expect(
            applyFilterTree(
                {
                    kind: 'rule',
                    path: ['valueOf', 'key'],
                    op: 'eq',
                    value: 'x'
                },
                schema,
                users,
                mockDb
            )
        ).rejects.toThrow(/unknown relation "valueOf"/);
    });

    it('never lets a non-column reach drizzle as a column', async () => {
        // The regression this pins: the old code emitted `$1 = ` here, which
        // Postgres rejects as a syntax error — a 500 for a 400-shaped request.
        const dialect = new PgDialect();
        const good = await applyFilterTree(
            { kind: 'rule', path: ['email'], op: 'eq', value: 'a@b.c' },
            schema,
            users,
            mockDb
        );
        expect(good).toBeDefined();
        expect(dialect.sqlToQuery(good as SQL).sql).toContain('"email"');
        await expect(
            applyFilterTree(
                { kind: 'rule', path: ['constructor'], op: 'eq', value: 'x' },
                schema,
                users,
                mockDb
            )
        ).rejects.toThrow();
    });

    it('still resolves genuinely declared fields and relations', () => {
        expect(
            parseFilterTree(
                { field: 'email', op: 'eq', value: 'a@b.c' },
                schema
            )
        ).toEqual({ kind: 'rule', path: ['email'], op: 'eq', value: 'a@b.c' });
        expect(
            parseFilterTree(
                { field: 'role.key', op: 'eq', value: 'admin' },
                schema
            )
        ).toEqual({
            kind: 'rule',
            path: ['role', 'key'],
            op: 'eq',
            value: 'admin'
        });
    });

    it('detects group/rule shape from own keys, not the prototype chain', () => {
        // `parseFilterTree` also accepts an already-parsed object, which a
        // caller can hand over with a non-null prototype.
        const proto = { and: [{ field: 'email', op: 'eq', value: 'x' }] };
        const node = Object.create(proto) as Record<string, unknown>;
        node['field'] = 'email';
        node['op'] = 'eq';
        node['value'] = 'a@b.c';
        expect(parseFilterTree(node, schema)).toEqual({
            kind: 'rule',
            path: ['email'],
            op: 'eq',
            value: 'a@b.c'
        });
    });
});
