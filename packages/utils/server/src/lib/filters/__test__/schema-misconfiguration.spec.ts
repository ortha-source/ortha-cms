import { sql, type SQLWrapper } from 'drizzle-orm';
import { pgTable, uuid, varchar } from 'drizzle-orm/pg-core';
import { FilterException, FilterSchemaException } from '../filter-exceptions';
import { parseFilterTree } from '../parse-filter-tree';
import { applyFilterTree, type DbLike } from '../tree-to-drizzle';
import type { FilterSchema } from '../types';

/**
 * The parser and the translator validate against **different** parts of the
 * same schema: `resolveLeaf` walks the `fields` / `relations` maps and never
 * inspects `rel.table` or the physical columns. So a schema can declare a path
 * the parser accepts and the translator cannot build, on a perfectly
 * well-formed request.
 *
 * Those four sites used to throw a bare `Error`, which reaches a transport as
 * an opaque 500 (and, through the MCP adapter, an untyped JSON-RPC internal
 * error) — the pattern `.cursor/BUGBOT.md` calls out. They now throw
 * `FilterSchemaException`.
 *
 * The status stays **500 on purpose**. The request was well-formed and the
 * whitelist accepted it; what is broken is the schema the plugin author wrote.
 * A 400 would blame the client, hide the fault from alerting, and leave the
 * schema bug in place. What was wrong before is only that the error was
 * untyped and indistinguishable from a genuine crash.
 */

const users = pgTable('users', {
    id: uuid('id').primaryKey(),
    email: varchar('email', { length: 255 })
});
const tags = pgTable('tags', {
    id: uuid('id').primaryKey(),
    name: varchar('name', { length: 64 })
});
const entryTags = pgTable('entry_tags', {
    entryId: uuid('entry_id'),
    tagId: uuid('tag_id')
});
const keyless = pgTable('keyless', { slug: varchar('slug', { length: 16 }) });

const stubSubquery: SQLWrapper = { getSQL: () => sql`select 1 from stub` };
const mockDb: DbLike = {
    select: () => ({
        from: () => ({
            where: () => stubSubquery,
            innerJoin: () => ({ where: () => stubSubquery })
        })
    })
};

const expectSchemaError = async (p: Promise<unknown>, match: RegExp) => {
    await expect(p).rejects.toThrow(FilterSchemaException);
    await expect(p).rejects.toThrow(match);
    // Never a 400: the client did nothing wrong.
    await expect(p).rejects.not.toBeInstanceOf(FilterException);
    const err = await p.catch((e: FilterSchemaException) => e);
    expect((err as FilterSchemaException).getStatus()).toBe(500);
    expect((err as FilterSchemaException).code).toBe('FILTER_SCHEMA_INVALID');
};

describe('schema misconfiguration reaches the translator as a typed error', () => {
    it('many-to-many declaring target `fields` but no `table`', async () => {
        // `table` is optional on the m2m variant ("required when filtering on
        // target fields") — nothing checks that at declaration time.
        const schema: FilterSchema = {
            fields: { id: { type: 'uuid' } },
            relations: {
                tags: {
                    kind: 'many-to-many',
                    through: entryTags,
                    fk: entryTags.entryId,
                    targetFk: entryTags.tagId,
                    fields: { name: { type: 'string' } }
                }
            }
        };
        const tree = parseFilterTree(
            '{"field":"tags.name","op":"eq","value":"x"}',
            schema
        );
        expect(tree).not.toBeNull(); // the parser accepts it
        await expectSchemaError(
            applyFilterTree(tree, schema, users, mockDb),
            /many-to-many filter on target field requires `table`/
        );
    });

    it('a `fields` entry naming a column that is not on the table', async () => {
        const schema: FilterSchema = { fields: { ghost: { type: 'string' } } };
        const tree = parseFilterTree(
            '{"field":"ghost","op":"eq","value":"x"}',
            schema
        );
        await expectSchemaError(
            applyFilterTree(tree, schema, users, mockDb),
            /column "ghost" not on table/
        );
    });

    it('a nested `fields` map with no matching `relations` entry', async () => {
        const schema: FilterSchema = {
            relations: {
                tags: {
                    kind: 'one-to-many',
                    table: tags,
                    fk: tags.id,
                    fields: {},
                    relations: {}
                }
            }
        };
        await expectSchemaError(
            applyFilterTree(
                {
                    kind: 'rule',
                    path: ['tags', 'missing', 'name'],
                    op: 'eq',
                    value: 'x'
                },
                schema,
                users,
                mockDb
            ),
            /nested relation missing: missing/
        );
    });

    it('a parent table with no `id` and no explicit `parentKey`', async () => {
        const schema: FilterSchema = {
            relations: {
                tags: {
                    kind: 'one-to-many',
                    table: tags,
                    fk: tags.id,
                    fields: { name: { type: 'string' } }
                }
            }
        };
        const tree = parseFilterTree(
            '{"field":"tags.name","op":"eq","value":"x"}',
            schema
        );
        await expectSchemaError(
            applyFilterTree(tree, schema, keyless, mockDb),
            /table has no `id` column/
        );
    });

    it('a field declaring an unrecognised scalar type [utils:I-30]', async () => {
        // A runtime-derived schema (the content plugin builds one per content
        // type) can carry a type the union does not cover. Falling out of the
        // coercion switch returned `undefined`, which drizzle renders as the
        // same broken `$1 = ` fragment an inherited field name used to produce.
        const schema = {
            fields: { email: { type: 'not-a-type' } }
        } as unknown as FilterSchema;
        expect(() =>
            parseFilterTree({ field: 'email', op: 'eq', value: 'x' }, schema)
        ).toThrow(FilterSchemaException);
        expect(() =>
            parseFilterTree({ field: 'email', op: 'eq', value: 'x' }, schema)
        ).toThrow(/declares unknown type "not-a-type"/);
    });

    it('a relation declaring an unrecognised kind [utils:I-30]', async () => {
        const schema = {
            relations: {
                tags: {
                    kind: 'many-to-few',
                    table: tags,
                    fk: tags.id,
                    fields: { name: { type: 'string' } }
                }
            }
        } as unknown as FilterSchema;
        await expectSchemaError(
            applyFilterTree(
                { kind: 'rule', path: ['tags', 'name'], op: 'eq', value: 'x' },
                schema,
                users,
                mockDb
            ),
            /relation declares unknown kind "many-to-few"/
        );
    });
});
