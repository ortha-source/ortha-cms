import { AlarmsWorkspacePurger } from './alarms-workspace.purger';
import { alarmFindings } from '../schema/alarm-findings';
import { alarmRules } from '../schema/alarm-rules';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

/**
 * A Drizzle-shaped delete recorder. `delete(table).where(...).returning(...)`
 * is the only chain the purger uses, so a stub of exactly that shape is enough
 * — and it lets the test assert *which* table each delete targeted, which is the
 * property that actually matters here.
 */
function executor(rowsPerTable: Map<unknown, number>) {
    const deletes: unknown[] = [];
    return {
        deletes,
        db: {
            delete(table: unknown) {
                deletes.push(table);
                return {
                    where: () => ({
                        returning: async () =>
                            Array.from(
                                { length: rowsPerTable.get(table) ?? 0 },
                                () => ({})
                            )
                    })
                };
            }
        }
    };
}

function purgerWith(rows: Map<unknown, number>) {
    const { db, deletes } = executor(rows);
    const uow = { current: () => db } as never;
    return { purger: new AlarmsWorkspacePurger(uow), deletes };
}

describe('AlarmsWorkspacePurger', () => {
    it('names itself once, so a second registration is a loud wiring bug', () => {
        expect(new AlarmsWorkspacePurger({} as never).purgeName).toBe(
            'alarms:rules-and-findings'
        );
    });

    it('deletes findings before rules, so the count is not swallowed by the cascade', async () => {
        // Annotated: an unannotated literal infers the key type from the first
        // entry, and the second table then fails to assign.
        const { purger, deletes } = purgerWith(
            new Map<unknown, number>([
                [alarmFindings, 4],
                [alarmRules, 2]
            ])
        );

        const outcome = await purger.purge(WORKSPACE);

        // `alarm_findings.rule_id` cascades from `alarm_rules`, so deleting the
        // rules first would take the findings with them and this purger would
        // report zero for rows it did remove. "Removed 2 rules" and "removed 2
        // rules and 4 000 findings" are very different lines in a delete's log.
        expect(deletes).toEqual([alarmFindings, alarmRules]);
        expect(outcome.rows).toBe(6);
    });

    it('reports nothing to reclaim — alarms own no bytes outside the database', async () => {
        const { purger } = purgerWith(new Map<unknown, number>());

        const outcome = await purger.purge(WORKSPACE);

        // Only media defers work past the commit. A reclaim thunk here would be
        // run after the transaction and could not be rolled back.
        expect(outcome).toEqual({ rows: 0 });
    });

    it('tolerates a host with no workspaces plugin, rather than failing to boot', () => {
        const purger = new AlarmsWorkspacePurger({} as never);

        // The registry is injected `@Optional()`: alarms may run in a
        // deployment that never mounts workspaces at all.
        expect(() => purger.onModuleInit()).not.toThrow();
    });

    it('registers itself with the registry when there is one', () => {
        const registered: unknown[] = [];
        const registry = {
            register: (p: unknown) => registered.push(p)
        } as never;
        const purger = new AlarmsWorkspacePurger({} as never, registry);

        purger.onModuleInit();

        expect(registered).toEqual([purger]);
    });
});
