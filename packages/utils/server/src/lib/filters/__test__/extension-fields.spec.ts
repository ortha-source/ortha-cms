import { sql } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { PgDialect, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { applyFilterTree, type DbLike } from '../tree-to-drizzle';
import type { FilterSchema, ParsedRule } from '../types';

const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 })
});
const roles = pgTable('roles', {
    id: uuid('id').primaryKey(),
    key: varchar('key', { length: 32 })
});

const dialect = new PgDialect();
const stubSubquery: SQLWrapper = { getSQL: () => sql`select 1 from stub` };
const mockDb: DbLike = {
    select: () => ({
        from: () => ({
            where: () => stubSubquery,
            innerJoin: () => ({ where: () => stubSubquery })
        })
    })
};
const serialize = (s: SQL) => dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ');

/**
 * `translateRule` consults `extensionFields` on `path[0]` **before** the
 * path-length check, so when one name appears in both `extensionFields` and
 * `relations` the extension wins — for the whole path, including a multi-hop
 * one, and the resolver receives every segment. That is emergent from
 * statement order rather than stated anywhere, so it is pinned here: a host
 * that adds an extension field shadowing a relation needs to know it has
 * shadowed it, and a resolver taking `path[0]` and ignoring the rest would
 * silently widen `role.key` into `role`.
 */
describe('extension fields', () => {
    const schema: FilterSchema = {
        fields: { email: { type: 'string' }, role: { type: 'string' } },
        relations: {
            role: {
                kind: 'many-to-one',
                table: roles,
                fk: users.id,
                fields: { key: { type: 'string' } }
            }
        },
        extensionFields: new Set(['role'])
    };

    it('shadows a relation of the same name, resolver-first', async () => {
        const seen: ParsedRule[] = [];
        const out = await applyFilterTree(
            { kind: 'rule', path: ['role'], op: 'eq', value: 'admin' },
            schema,
            users,
            mockDb,
            {
                resolveExtension: async (rule) => {
                    seen.push(rule);
                    return sql`/* ext */ 1=1`;
                }
            }
        );
        expect(serialize(out as SQL)).toContain('/* ext */');
        expect(seen).toHaveLength(1);
    });

    it('hands the resolver the FULL path on a multi-segment rule', async () => {
        // Not `['role']` — the relation branch is never reached, so a resolver
        // that assumed a single segment would drop the `.key` qualifier.
        const seen: ParsedRule[] = [];
        await applyFilterTree(
            { kind: 'rule', path: ['role', 'key'], op: 'eq', value: 'admin' },
            schema,
            users,
            mockDb,
            {
                resolveExtension: async (rule) => {
                    seen.push(rule);
                    return sql`/* ext */ 1=1`;
                }
            }
        );
        expect(seen[0].path).toEqual(['role', 'key']);
    });

    it('400s rather than falling back to the relation when no resolver is given', async () => {
        await expect(
            applyFilterTree(
                { kind: 'rule', path: ['role', 'key'], op: 'eq', value: 'x' },
                schema,
                users,
                mockDb
            )
        ).rejects.toThrow(/extension field "role" referenced but no resolver/);
    });
});
