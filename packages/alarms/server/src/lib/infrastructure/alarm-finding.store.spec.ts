import { AlarmFindingStore } from './alarm-finding.store';

/**
 * The write chunking, which is a correctness bound rather than a tuning knob.
 *
 * Postgres accepts at most 65535 bind parameters in one statement. A finding
 * row carries eight columns, so an unchunked insert of a rescan that matched
 * every row in a large collection does not merely run slowly — the driver
 * refuses the statement and the **whole reconciliation** fails, which on this
 * plugin means the findings stop being refreshed rather than that anything is
 * reported.
 *
 * A database is the wrong place to check this: the failure needs ~8000 matching
 * entries to reproduce, and the property under test is the shape of the
 * statements rather than the rows that end up in the table. A recording
 * executor sees the batch boundaries directly, so the ceiling can be pinned at
 * exactly 500 — one row either side of it — instead of somewhere below 8000.
 */

const RULE = {
    id: 'rule-1',
    workspaceId: '11111111-1111-4111-8111-111111111111',
    contentType: 'article'
};

interface InsertedRow {
    entryId: string;
    firstSeenAt: Date;
    state: string;
}

/**
 * A Drizzle-shaped recorder for the two chains `reconcile` uses:
 * `insert(t).values(rows).onConflictDoUpdate(…).returning(…)` and
 * `update(t).set(…).where(…).returning(…)`.
 */
function executor() {
    const insertedBatches: InsertedRow[][] = [];
    const updateBatches: number[] = [];

    const db = {
        insert: () => ({
            values: (rows: InsertedRow[]) => {
                insertedBatches.push(rows);
                return {
                    onConflictDoUpdate: () => ({
                        // Echoes the rows back the way the real `returning`
                        // does, so the `opened` tally is computed off a real
                        // answer rather than an empty one.
                        returning: async () =>
                            rows.map((row) => ({
                                entryId: row.entryId,
                                firstSeenAt: row.firstSeenAt,
                                state: row.state
                            }))
                    })
                };
            }
        }),
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => {
                        updateBatches.push(updateBatches.length);
                        return [];
                    }
                })
            })
        })
    };

    return { db, insertedBatches, updateBatches };
}

const ids = (prefix: string, count: number) =>
    Array.from({ length: count }, (_, index) => `${prefix}-${index}`);

describe('AlarmFindingStore.reconcile', () => {
    it('writes matched findings 500 rows at a time [alarms:I-25]', async () => {
        const { db, insertedBatches } = executor();
        const store = new AlarmFindingStore(db as never);
        const matched = ids('entry', 1200);

        const result = await store.reconcile(RULE, matched, matched);

        // Not "more than one statement" — the boundary itself. An unchunked
        // write is a single batch of 1200; a chunk of 1000 is two.
        expect(insertedBatches.map((batch) => batch.length)).toEqual([
            500, 500, 200
        ]);
        // Every row still reaches the table exactly once: the chunking must not
        // be a way of dropping the tail.
        expect(insertedBatches.flat().map((row) => row.entryId)).toEqual(
            matched
        );
        expect(result.opened).toBe(1200);
    });

    it('keeps a full chunk in one statement, and splits at 501 [alarms:I-25]', async () => {
        const exactly = executor();
        await new AlarmFindingStore(exactly.db as never).reconcile(
            RULE,
            ids('a', 500),
            ids('a', 500)
        );
        expect(exactly.insertedBatches.map((batch) => batch.length)).toEqual([
            500
        ]);

        const oneMore = executor();
        await new AlarmFindingStore(oneMore.db as never).reconcile(
            RULE,
            ids('b', 501),
            ids('b', 501)
        );
        expect(oneMore.insertedBatches.map((batch) => batch.length)).toEqual([
            500, 1
        ]);
    });

    it('chunks the resolving half as well [alarms:I-25]', async () => {
        const { db, updateBatches, insertedBatches } = executor();
        const store = new AlarmFindingStore(db as never);

        // Everything examined, nothing matched: 1200 findings to close.
        await store.reconcile(RULE, ids('entry', 1200), []);

        // The `IN (…)` list is bound one parameter per id, so the resolve is
        // the same ceiling as the insert and needs the same chunking.
        expect(updateBatches).toHaveLength(3);
        expect(insertedBatches).toEqual([]);
    });

    it('writes nothing at all when the examined set is empty', async () => {
        const { db, insertedBatches, updateBatches } = executor();
        const store = new AlarmFindingStore(db as never);

        const result = await store.reconcile(RULE, [], []);

        expect(insertedBatches).toEqual([]);
        expect(updateBatches).toEqual([]);
        expect(result).toEqual({ opened: 0, resolved: 0 });
    });
});
