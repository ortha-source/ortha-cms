import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getTableName } from 'drizzle-orm';
import { segments } from '../schema/segments';
import { entryAccess } from '../schema/entry-access';
import { SegmentsService } from './segments.service';
import { SegmentCatalogService } from './segment-catalog.service';

/** One directory row, as `byId` reads it back. */
const ROW = {
    id: '11111111-1111-4111-8111-111111111111',
    key: 'acme',
    label: 'Acme Corp',
    tags: ['acme'],
    workspaceIds: [],
    createdAt: new Date(0),
    updatedAt: new Date(0)
};

/** One statement the service issued, rendered as the SQL Postgres would see. */
interface Statement {
    op: 'insert' | 'update' | 'delete';
    table: string;
    sql: string;
    params: unknown[];
    /** The handle it was issued on, so "one transaction" is checkable. */
    handle: unknown;
    /** Whether a unit of work was open at the time. */
    inTransaction: boolean;
}

/**
 * A recording executor.
 *
 * Writes are built with a **real** Drizzle builder (`drizzle.mock()` compiles
 * without a connection) and rendered with `toSQL()`, so what is asserted below
 * is the statement Postgres would receive rather than a paraphrase of the
 * source. Reads answer with fixed rows.
 */
function harness(read: readonly unknown[] = [ROW]) {
    const compiler = drizzle.mock();
    const statements: Statement[] = [];
    let inTransaction = false;

    const record = (
        op: Statement['op'],
        table: PgTable,
        builder: { toSQL(): { sql: string; params: unknown[] } },
        handle: unknown
    ) => {
        const query = builder.toSQL();
        statements.push({
            op,
            table: getTableName(table),
            sql: query.sql,
            params: query.params,
            handle,
            inTransaction
        });
    };

    const executor = (): unknown => {
        const handle: Record<string, unknown> = {
            select: () => ({
                from: () => ({
                    where: () => ({ limit: async () => [...read] })
                })
            }),
            delete: (table: PgTable) => ({
                where: async (where: never) =>
                    record(
                        'delete',
                        table,
                        compiler.delete(table).where(where),
                        handle
                    )
            }),
            update: (table: PgTable) => ({
                set: (values: never) => ({
                    where: (where: never) => {
                        record(
                            'update',
                            table,
                            compiler.update(table).set(values).where(where),
                            handle
                        );
                        return {
                            then: (resolve: (rows: unknown[]) => unknown) =>
                                Promise.resolve([ROW]).then(resolve),
                            returning: async () => [ROW]
                        };
                    }
                })
            }),
            insert: (table: PgTable) => ({
                values: (values: never) => {
                    record(
                        'insert',
                        table,
                        compiler.insert(table).values(values),
                        handle
                    );
                    return {
                        then: (resolve: (rows: unknown[]) => unknown) =>
                            Promise.resolve([ROW]).then(resolve),
                        returning: async () => [ROW]
                    };
                }
            }),
            execute: async () => ({ rows: [] })
        };
        return handle;
    };

    const db = executor();
    const tx = executor();
    const uow = {
        async run<T>(fn: () => Promise<T>): Promise<T> {
            inTransaction = true;
            try {
                return await fn();
            } finally {
                inTransaction = false;
            }
        },
        current: () => tx
    };
    const events: unknown[] = [];
    const outbox = {
        append: async (batch: unknown[]) => {
            events.push(...batch);
        }
    };
    const reloads: number[] = [];
    const catalog = {
        reload: async () => {
            // Recorded as "how many statements had been issued by then", so the
            // ordering claim — reload *after* the write commits — is checkable.
            reloads.push(statements.length);
        }
    } as unknown as SegmentCatalogService;

    const service = new SegmentsService(
        db as never,
        uow as never,
        outbox as never,
        catalog
    );
    return { service, statements, events, reloads, tx };
}

describe('SegmentsService.remove', () => {
    // What these cannot show: no database executes them. The statements are the
    // ones Postgres would receive, which is enough to catch a sweep that was
    // dropped, narrowed wrongly or moved out of the transaction — and not enough
    // to catch a statement that is well-formed and means the wrong thing. That
    // is the failure `uuid-array.spec.ts` exists for, and a server-e2e case over
    // a real delete is where the row outcome belongs.
    /**
     * The sweep, and why it is not optional.
     *
     * An id left behind on an entry names a segment that resolves to nobody:
     * on the allow side that silently closes content, on the deny side it
     * silently opens it, and neither has anything on any screen to say why. The
     * dossier records four all-empty orphan rows found in a development
     * database, so the last statement here is the one that has already been got
     * wrong once.
     */
    it('sweeps the audience out of every entry and drops the rows it emptied [segments:I-12]', async () => {
        const { service, statements } = harness();

        await service.remove(ROW.id);

        expect(statements.map((s) => [s.op, s.table])).toEqual([
            ['delete', getTableName(segments)],
            ['update', getTableName(entryAccess)],
            ['delete', getTableName(entryAccess)]
        ]);

        const [, sweep, prune] = statements;
        // Both sides, in one statement. `array_remove` rather than a read
        // -modify-write, so a concurrent save cannot land between them.
        expect(sweep.sql).toContain(
            'set "allow" = array_remove("entry_access"."allow", $1::uuid)'
        );
        expect(sweep.sql).toContain(
            '"deny" = array_remove("entry_access"."deny", $2::uuid)'
        );
        // Narrowed to the rows that actually name it — an unscoped sweep would
        // stamp `updated_at` on every restricted entry in the installation.
        expect(sweep.sql).toContain(
            'where "entry_access"."allow" @> ARRAY[$4::uuid] OR "entry_access"."deny" @> ARRAY[$5::uuid]'
        );
        // Five binds and no more: the id four times, plus the `updated_at`
        // stamp between them.
        expect(sweep.params).toHaveLength(5);
        expect([0, 1, 3, 4].map((i) => sweep.params[i])).toEqual(
            Array(4).fill(ROW.id)
        );

        // "An entry left with two empty lists loses its row" — the same "no row
        // means open" the writer maintains. Without it the read predicate's
        // `COALESCE(…, true)` still answers correctly, but the records list's
        // `accessRestricted` field — which *is* "has a row" — reports an entry
        // nobody has restricted as restricted, forever.
        expect(prune.sql).toBe(
            'delete from "entry_access" where cardinality("entry_access"."allow") = 0 AND cardinality("entry_access"."deny") = 0'
        );
    });

    it('issues all three on one transaction [segments:I-12]', async () => {
        const { service, statements, tx } = harness();

        await service.remove(ROW.id);

        // Not three requests that happen to follow each other: a directory row
        // gone while its mentions survive is the exact state the sweep exists to
        // prevent, so a failure between them has to take the delete with it.
        expect(statements.every((s) => s.inTransaction)).toBe(true);
        expect(statements.every((s) => s.handle === tx)).toBe(true);
    });

    it('records what the audience was before it stopped existing', async () => {
        // After the commit there is nowhere left to look the details up, and the
        // entries that named it lost the mention with no screen saying so.
        const { service, events } = harness();

        await service.remove(ROW.id);

        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            payload: { key: 'acme', label: 'Acme Corp', tags: ['acme'] }
        });
    });
});

describe('SegmentsService catalogue reloads', () => {
    /**
     * The read path holds the catalogue in memory and consults it
     * **synchronously**, so a write that does not reach it is a write nobody
     * sees: a rename that does not show, a new audience the entry editor
     * refuses as "unknown segment", a deleted one still offered in the picker.
     */
    it.each([
        [
            'create',
            // Nothing stored, so the duplicate-key probe finds no collision.
            [] as unknown[],
            (service: SegmentsService) =>
                service.create({ key: 'acme', label: 'Acme Corp' })
        ],
        [
            'update',
            [ROW] as unknown[],
            (service: SegmentsService) =>
                service.update(ROW.id, { label: 'Acme Ltd' })
        ],
        [
            'delete',
            [ROW] as unknown[],
            (service: SegmentsService) => service.remove(ROW.id)
        ]
    ])(
        'reloads the catalogue after a %s [segments:I-36]',
        async (_name, read, act) => {
            const { service, statements, reloads } = harness(read);

            await act(service);

            expect(reloads).toHaveLength(1);
            // After the write, not before it: a reload that ran first would
            // repopulate the cache from the state the write is about to leave.
            expect(reloads[0]).toBe(statements.length);
            expect(statements.length).toBeGreaterThan(0);
        }
    );
});
