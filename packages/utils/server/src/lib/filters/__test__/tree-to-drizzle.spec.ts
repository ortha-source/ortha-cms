import { sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { PgDialect, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { applyFilterTree } from '../tree-to-drizzle';
import type { DbLike } from '../tree-to-drizzle';
import type { FilterSchema, ParsedNode } from '../types';

const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 }),
    role: varchar('role', { length: 32 })
});

const dialect = new PgDialect();

const stubSubquery: SQLWrapper = {
    getSQL: () => sql`select 1 from stub`
};
const mockDb: DbLike = {
    select: () => ({
        from: () => ({
            where: () => stubSubquery,
            innerJoin: () => ({
                where: () => stubSubquery
            })
        })
    })
};

const serialize = (s: SQL): string =>
    dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ').trim();

const schema: FilterSchema = {
    fields: {
        id: { type: 'uuid' },
        email: { type: 'string' },
        role: { type: 'string' }
    }
};

describe('applyFilterTree', () => {
    it('returns undefined for null input', async () => {
        expect(
            await applyFilterTree(null, schema, users, mockDb)
        ).toBeUndefined();
        expect(
            await applyFilterTree(undefined, schema, users, mockDb)
        ).toBeUndefined();
    });

    it('translates a single rule (no group wrapper) to a scalar predicate', async () => {
        const tree: ParsedNode = {
            kind: 'rule',
            path: ['email'],
            op: 'ilike',
            value: '%@x'
        };
        const s = await applyFilterTree(tree, schema, users, mockDb);
        expect(s).toBeDefined();
        expect(serialize(s!).toLowerCase()).toContain('ilike');
    });

    it('AND-combines rules with `and(...)`', async () => {
        const tree: ParsedNode = {
            kind: 'group',
            combinator: 'and',
            children: [
                { kind: 'rule', path: ['email'], op: 'ilike', value: '%@x' },
                { kind: 'rule', path: ['role'], op: 'eq', value: 'admin' }
            ]
        };
        const out = serialize(
            (await applyFilterTree(tree, schema, users, mockDb))!
        );
        expect(out.toLowerCase()).toContain('ilike');
        expect(out).toContain(' and ');
    });

    it('OR-combines rules with `or(...)`', async () => {
        const tree: ParsedNode = {
            kind: 'group',
            combinator: 'or',
            children: [
                { kind: 'rule', path: ['role'], op: 'eq', value: 'admin' },
                { kind: 'rule', path: ['role'], op: 'eq', value: 'owner' }
            ]
        };
        const out = serialize(
            (await applyFilterTree(tree, schema, users, mockDb))!
        ).toLowerCase();
        expect(out).toContain(' or ');
    });

    it('flattens a group with a single child to the child predicate', async () => {
        const tree: ParsedNode = {
            kind: 'group',
            combinator: 'and',
            children: [
                { kind: 'rule', path: ['email'], op: 'eq', value: 'a@b.com' }
            ]
        };
        const out = serialize(
            (await applyFilterTree(tree, schema, users, mockDb))!
        );
        // No surrounding parentheses around an `and(x)` since drizzle's
        // helpers short-circuit single-arg cases — we just verify the
        // emitted SQL doesn't include a stray `and`.
        expect(out.toLowerCase()).not.toMatch(/\band\b/);
    });

    it('returns undefined when an empty group has no rules', async () => {
        const tree: ParsedNode = {
            kind: 'group',
            combinator: 'or',
            children: []
        };
        expect(
            await applyFilterTree(tree, schema, users, mockDb)
        ).toBeUndefined();
    });

    it('handles nested AND-of-ORs', async () => {
        const tree: ParsedNode = {
            kind: 'group',
            combinator: 'and',
            children: [
                { kind: 'rule', path: ['email'], op: 'ilike', value: '%@x' },
                {
                    kind: 'group',
                    combinator: 'or',
                    children: [
                        {
                            kind: 'rule',
                            path: ['role'],
                            op: 'eq',
                            value: 'admin'
                        },
                        {
                            kind: 'rule',
                            path: ['role'],
                            op: 'eq',
                            value: 'owner'
                        }
                    ]
                }
            ]
        };
        const out = serialize(
            (await applyFilterTree(tree, schema, users, mockDb))!
        ).toLowerCase();
        expect(out).toContain(' and ');
        expect(out).toContain(' or ');
    });

    describe('extension hook', () => {
        const extensionSchema: FilterSchema = {
            fields: {
                email: { type: 'string' },
                role: { type: 'enum', enumValues: ['admin', 'viewer'] }
            },
            extensionFields: new Set(['role'])
        };

        it('routes extension leaves through resolveExtension and composes inside AND', async () => {
            const tree: ParsedNode = {
                kind: 'group',
                combinator: 'and',
                children: [
                    {
                        kind: 'rule',
                        path: ['email'],
                        op: 'ilike',
                        value: '%@x'
                    },
                    { kind: 'rule', path: ['role'], op: 'eq', value: 'admin' }
                ]
            };
            const out = serialize(
                (await applyFilterTree(tree, extensionSchema, users, mockDb, {
                    resolveExtension: async (rule) =>
                        sql`/* ext:${sql.raw(rule.path.join('.'))} */ 1=1`
                }))!
            ).toLowerCase();
            expect(out).toContain('ilike');
            expect(out).toContain(' and ');
            expect(out).toContain('/* ext:role */');
        });

        it('composes extension predicates inside OR', async () => {
            const tree: ParsedNode = {
                kind: 'group',
                combinator: 'or',
                children: [
                    {
                        kind: 'rule',
                        path: ['email'],
                        op: 'ilike',
                        value: '%@x'
                    },
                    { kind: 'rule', path: ['role'], op: 'eq', value: 'admin' }
                ]
            };
            const out = serialize(
                (await applyFilterTree(tree, extensionSchema, users, mockDb, {
                    resolveExtension: async () => sql`/* ext */ 1=1`
                }))!
            ).toLowerCase();
            expect(out).toContain(' or ');
            expect(out).toContain('/* ext */');
        });

        it('throws when an extension field has no resolver provided', async () => {
            const tree: ParsedNode = {
                kind: 'rule',
                path: ['role'],
                op: 'eq',
                value: 'admin'
            };
            await expect(
                applyFilterTree(tree, extensionSchema, users, mockDb)
            ).rejects.toThrow(/extension field "role"/);
        });
    });
});
