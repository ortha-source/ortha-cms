import { getTableName } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { Database } from '@orthacms/database';
import { InviteWorkspacesQuery } from './invite-workspaces.query';

const USER = '11111111-1111-4111-8111-111111111111';

/** A fake database returning `rows`, recording what it was asked for. */
function fakeDb(rows: { name: string }[]) {
    const tables: string[] = [];
    const conditions: unknown[] = [];
    const chain = {
        from(table: object) {
            tables.push(getTableName(table as never));
            return chain;
        },
        innerJoin(table: object) {
            tables.push(getTableName(table as never));
            return chain;
        },
        where(condition: unknown) {
            conditions.push(condition);
            return chain;
        },
        orderBy() {
            return Promise.resolve(rows);
        }
    };
    const db = { select: () => chain };
    return {
        query: new InviteWorkspacesQuery(db as unknown as Database),
        tables,
        conditions
    };
}

/** The SQL text and parameters of a captured `where` condition. */
function rendered(condition: unknown) {
    return new PgDialect().sqlToQuery(condition as never);
}

/**
 * The adapter behind identity's `INVITE_WORKSPACE_DIRECTORY` port — where the
 * accept-invite screen's "in Marketing site and Support hub" comes from.
 */
describe('InviteWorkspacesQuery', () => {
    it('returns the names of the workspaces the account belongs to', async () => {
        const { query, tables } = fakeDb([
            { name: 'Marketing site' },
            { name: 'Support hub' }
        ]);

        await expect(query.namesFor(USER)).resolves.toEqual([
            'Marketing site',
            'Support hub'
        ]);
        expect(tables).toEqual(['memberships', 'workspaces']);
    });

    it('asks about that one account, and only about active workspaces', async () => {
        const { query, conditions } = fakeDb([]);

        await query.namesFor(USER);

        const { sql, params } = rendered(conditions[0]);
        expect(sql).toContain('"memberships"."user_id" = $1');
        expect(sql).toContain('"workspaces"."status" = $2');
        expect(params).toEqual([USER, 'active']);
    });
});
