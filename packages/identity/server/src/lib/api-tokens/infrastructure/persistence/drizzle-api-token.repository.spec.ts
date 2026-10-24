import { getTableName } from 'drizzle-orm';
import { PgDialect, QueryBuilder } from 'drizzle-orm/pg-core';
import type { UnitOfWork } from '@orthacms/database';
import { DrizzleApiTokenRepository } from './drizzle-api-token.repository';

const TOKEN = '99999999-9999-4999-8999-999999999999';
const WORKSPACE_A = '11111111-1111-4111-8111-111111111111';
const WORKSPACE_B = '22222222-2222-4222-8222-222222222222';

/** An `api_tokens` row as the driver hands it back. */
const ROW = {
    id: TOKEN,
    name: 'CI',
    tokenHash: 'a'.repeat(64),
    lookupPrefix: 'orthacms_abc',
    scope: 'read',
    expiresAt: null,
    createdBy: 'user-1',
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z')
};

/** One recorded statement: where it was rooted, and the builder behind it. */
interface Statement {
    table: string;
    /** True when the select carried an explicit projection. */
    projected: boolean;
    /** The finished builder — renderable to SQL after the call returns. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: any;
}

/** The rows a statement resolves to, chosen by table and projection. */
type Rows = (table: string, projected: boolean) => unknown[];

/**
 * A `UnitOfWork` whose `current()` hands back **real** Drizzle select builders,
 * from the standalone `QueryBuilder` that needs no connection, with `execute`
 * swapped for canned rows (`QueryPromise.then` defers to `execute`, so that is
 * all it takes to make a connection-free builder awaitable).
 *
 * Real builders are the point: the thing under test is how a filter *renders*,
 * and a hand-rolled chain stub would happily accept a subquery it could never
 * have produced.
 */
function fakeUow(rows: Rows) {
    const statements: Statement[] = [];
    const builder = new QueryBuilder();
    const current = () => ({
        select(projection?: Record<string, unknown>) {
            return {
                from(table: object) {
                    const select = (projection
                        ? builder.select(projection as never)
                        : builder.select()
                    ).from(table as never) as unknown as Statement['select'];
                    const name = getTableName(table as never);
                    const projected = projection !== undefined;
                    select.execute = async () => rows(name, projected);
                    statements.push({ table: name, projected, select });
                    return select;
                }
            };
        }
    });
    return {
        repo: new DrizzleApiTokenRepository({
            current
        } as unknown as UnitOfWork),
        statements
    };
}

/** The SQL a recorded statement renders to. */
function sqlOf(statement: Statement): string {
    return new PgDialect().sqlToQuery(statement.select.getSQL()).sql;
}

/** The single statement rooted at `table` with the given projection-ness. */
function only(
    statements: Statement[],
    table: string,
    projected: boolean
): Statement {
    const found = statements.filter(
        (statement) =>
            statement.table === table && statement.projected === projected
    );
    expect(found).toHaveLength(1);
    return found[0];
}

/** The default row set: one token, in both workspaces. */
const bothWorkspaces: Rows = (table, projected) => {
    if (table === 'api_tokens') {
        return projected ? [{ total: 1 }] : [ROW];
    }
    return [
        { tokenId: TOKEN, workspaceId: WORKSPACE_A },
        { tokenId: TOKEN, workspaceId: WORKSPACE_B }
    ];
};

describe('DrizzleApiTokenRepository.list', () => {
    it('renders the workspace filter as a set-membership subquery', async () => {
        // `?workspaceId=` is a bucket-*membership* test, and the shape it is
        // written in is the whole invariant: a join against
        // `api_token_workspaces` would return one row per matching workspace,
        // so a token covering three workspaces would appear three times in the
        // page and inflate the total by three. `id IN (SELECT …)` cannot.
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ workspaceId: WORKSPACE_A, limit: 20, offset: 0 });

        const page = sqlOf(only(statements, 'api_tokens', false));
        expect(page).toContain(
            '"api_tokens"."id" in (select "token_id" from "api_token_workspaces"'
        );
        expect(page.toLowerCase()).not.toContain('join');
    });

    it('filters the count with the identical predicate', async () => {
        // The total and the page are two statements sharing one `where`. If
        // they ever drifted, the pager would show a page count for a set the
        // page itself does not come from.
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ workspaceId: WORKSPACE_A, limit: 20, offset: 0 });

        const predicate = (sql: string) => sql.slice(sql.indexOf(' where '));
        const total = sqlOf(only(statements, 'api_tokens', true));
        const page = sqlOf(only(statements, 'api_tokens', false));
        expect(total).toContain('count(*)');
        expect(predicate(total)).toBe(
            predicate(page).replace(/ order by .*$/, '')
        );
    });

    it('returns a multi-workspace token exactly once, with its whole bucket [api-tokens:I-20]', async () => {
        const { repo } = fakeUow(bothWorkspaces);

        const { items, total } = await repo.list({
            workspaceId: WORKSPACE_A,
            limit: 20,
            offset: 0
        });

        expect(items).toHaveLength(1);
        expect(total).toBe(1);
        // The bucket is part of the token's identity, not an expansion: every
        // read hands it back so no caller can observe a token scoped to
        // nothing.
        expect(items[0].workspaceIds).toEqual([WORKSPACE_A, WORKSPACE_B]);
    });

    it('adds no predicate at all when no workspace is named', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ limit: 20, offset: 0 });

        for (const projected of [true, false]) {
            expect(
                sqlOf(only(statements, 'api_tokens', projected))
            ).not.toContain('where');
        }
        // No subquery was built either — an unfiltered list must not pay for
        // one.
        expect(
            statements.filter(
                (statement) =>
                    statement.table === 'api_token_workspaces' &&
                    statement.projected
            )
        ).toEqual([]);
    });

    it('reads every bucket on the page in one batched query', async () => {
        // Never one query per row: a page of tokens costs a constant two reads
        // plus the count, whatever the page size.
        const { repo, statements } = fakeUow((table, projected) => {
            if (table === 'api_tokens') {
                return projected
                    ? [{ total: 2 }]
                    : [ROW, { ...ROW, id: 'token-2' }];
            }
            return [
                { tokenId: TOKEN, workspaceId: WORKSPACE_A },
                { tokenId: 'token-2', workspaceId: WORKSPACE_B }
            ];
        });

        const { items } = await repo.list({ limit: 20, offset: 0 });

        const bucketReads = statements.filter(
            (statement) =>
                statement.table === 'api_token_workspaces' &&
                !statement.projected
        );
        expect(bucketReads).toHaveLength(1);
        expect(sqlOf(bucketReads[0])).toContain('"token_id" in');
        expect(items.map((item) => item.workspaceIds)).toEqual([
            [WORKSPACE_A],
            [WORKSPACE_B]
        ]);
    });

    it('skips the bucket read entirely for an empty page', async () => {
        // `in ()` is not valid SQL, so the short-circuit is correctness, not an
        // optimisation.
        const { repo, statements } = fakeUow((table, projected) =>
            table === 'api_tokens' && projected ? [{ total: 0 }] : []
        );

        const { items } = await repo.list({ limit: 20, offset: 40 });

        expect(items).toEqual([]);
        expect(
            statements.filter(
                (statement) => statement.table === 'api_token_workspaces'
            )
        ).toEqual([]);
    });
});

/** The bound parameters a recorded statement renders with. */
function paramsOf(statement: Statement): unknown[] {
    return new PgDialect().sqlToQuery(statement.select.getSQL()).params;
}

const NOW = new Date('2026-10-24T12:00:00.000Z');

describe('DrizzleApiTokenRepository.list — status and search', () => {
    it('renders `revoked` as a bare revocation test, whatever the expiry', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ status: 'revoked', now: NOW, limit: 20, offset: 0 });

        const page = sqlOf(only(statements, 'api_tokens', false));
        const where = page.slice(page.indexOf(' where '));
        expect(where).toContain('"api_tokens"."revoked_at" is not null');
        expect(where).not.toContain('"expires_at"');
    });

    it('renders `active` as not revoked and not yet expired [api-tokens:I-10]', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ status: 'active', now: NOW, limit: 20, offset: 0 });

        const page = only(statements, 'api_tokens', false);
        const sql = sqlOf(page);
        expect(sql).toContain('"api_tokens"."revoked_at" is null');
        expect(sql).toContain(
            '("api_tokens"."expires_at" is null or "api_tokens"."expires_at" > $1)'
        );
        // Measured at the instant the service passed in, not at whatever the
        // database clock says — so the page and the summary agree.
        expect(paramsOf(page)[0]).toBe(NOW.toISOString());
    });

    it('renders `expired` as not revoked and past its expiry', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ status: 'expired', now: NOW, limit: 20, offset: 0 });

        const sql = sqlOf(only(statements, 'api_tokens', false));
        expect(sql).toContain('"api_tokens"."revoked_at" is null');
        expect(sql).toContain('"api_tokens"."expires_at" is not null');
        expect(sql).toContain('"api_tokens"."expires_at" <= $1');
    });

    it('searches the name and the display prefix, matching wildcards literally', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ search: ' 50%_off ', limit: 20, offset: 0 });

        const page = only(statements, 'api_tokens', false);
        const sql = sqlOf(page);
        expect(sql).toContain('"api_tokens"."name" ilike $1');
        expect(sql).toContain('"api_tokens"."lookup_prefix" ilike $2');
        // A `%` typed into the box is a percent sign, not "anything".
        expect(paramsOf(page).slice(0, 2)).toEqual([
            '%50\\%\\_off%',
            '%50\\%\\_off%'
        ]);
    });

    it('ignores a blank search instead of filtering on `%%`', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({ search: '   ', limit: 20, offset: 0 });

        expect(sqlOf(only(statements, 'api_tokens', false))).not.toContain(
            'where'
        );
    });

    it('filters the count with every filter the page uses', async () => {
        const { repo, statements } = fakeUow(bothWorkspaces);

        await repo.list({
            workspaceId: WORKSPACE_A,
            status: 'active',
            search: 'ci',
            now: NOW,
            limit: 20,
            offset: 0
        });

        const predicate = (sql: string) => sql.slice(sql.indexOf(' where '));
        const total = sqlOf(only(statements, 'api_tokens', true));
        const page = sqlOf(only(statements, 'api_tokens', false));
        expect(predicate(total)).toBe(
            predicate(page).replace(/ order by .*$/, '')
        );
    });
});

describe('DrizzleApiTokenRepository.summarize', () => {
    it('counts every status and the expiring-soon window in one statement', async () => {
        const { repo, statements } = fakeUow((table) =>
            table === 'api_tokens'
                ? [
                      {
                          active: 3,
                          expired: 1,
                          revoked: 1,
                          expiringSoon: 1,
                          nextExpiresAt: new Date('2026-11-05T00:00:00Z')
                      }
                  ]
                : []
        );

        const summary = await repo.summarize({ now: NOW });

        expect(summary).toEqual({
            active: 3,
            expired: 1,
            revoked: 1,
            expiringSoon: 1,
            nextExpiresAt: new Date('2026-11-05T00:00:00Z')
        });
        const statement = only(statements, 'api_tokens', true);
        const sql = sqlOf(statement);
        expect(sql.match(/count\(\*\) filter \(where/g)).toHaveLength(4);
        expect(sql).toContain('min("expires_at") filter (where');
        // No status or search predicate narrows the totals: each chip has to
        // say how many tokens it would reveal.
        expect(sql).not.toContain(' where "');
        // The window ends thirty days after the instant passed in.
        expect(paramsOf(statement)).toContain(
            new Date('2026-11-23T12:00:00.000Z').toISOString()
        );
    });

    it('narrows the totals by workspace, as the list does', async () => {
        const { repo, statements } = fakeUow(() => []);

        await repo.summarize({ workspaceId: WORKSPACE_A, now: NOW });

        expect(sqlOf(only(statements, 'api_tokens', true))).toContain(
            '"api_tokens"."id" in (select "token_id" from "api_token_workspaces"'
        );
    });

    it('reads an empty table as all zeros', async () => {
        const { repo } = fakeUow(() => []);

        await expect(repo.summarize({ now: NOW })).resolves.toEqual({
            active: 0,
            expired: 0,
            revoked: 0,
            expiringSoon: 0,
            nextExpiresAt: null
        });
    });
});

describe('DrizzleApiTokenRepository.creatorsFor', () => {
    const ADA = { id: 'user-1', name: 'Ada Lovelace', email: 'ada@x.dev' };

    it('reads every creator on a page in one batched, deduplicated query', async () => {
        const { repo, statements } = fakeUow((table) =>
            table === 'users' ? [ADA] : []
        );

        const creators = await repo.creatorsFor(['user-1', 'user-1']);

        const reads = statements.filter(
            (statement) => statement.table === 'users'
        );
        expect(reads).toHaveLength(1);
        expect(sqlOf(reads[0])).toContain('"users"."id" in ($1)');
        // Only what the list shows — never the password hash.
        expect(sqlOf(reads[0])).not.toContain('password');
        expect(creators.get('user-1')).toEqual(ADA);
    });

    it('skips the read entirely for an empty page', async () => {
        const { repo, statements } = fakeUow(() => []);

        const creators = await repo.creatorsFor([]);

        expect(creators.size).toBe(0);
        expect(statements).toEqual([]);
    });
});
