import { EntryAccessWorkspacePurger } from './entry-access-workspace.purger';
import { entryAccess } from '../../schema/entry-access';

const WORKSPACE = '22222222-2222-4222-8222-222222222222';

/** Records which table each delete targeted; the only chain the purger uses. */
function executor(rows: number) {
    const deletes: unknown[] = [];
    return {
        deletes,
        db: {
            delete(table: unknown) {
                deletes.push(table);
                return {
                    where: () => ({
                        returning: async () =>
                            Array.from({ length: rows }, () => ({}))
                    })
                };
            }
        }
    };
}

describe('EntryAccessWorkspacePurger', () => {
    it('names itself once, so a second registration is a loud wiring bug', () => {
        expect(new EntryAccessWorkspacePurger({} as never).purgeName).toBe(
            'segments:entry-access'
        );
    });

    it('clears the workspace’s per-entry audience rows', async () => {
        const { db, deletes } = executor(3);
        const purger = new EntryAccessWorkspacePurger({
            current: () => db
        } as never);

        const outcome = await purger.purge(WORKSPACE);

        expect(deletes).toEqual([entryAccess]);
        expect(outcome).toEqual({ rows: 3 });
    });

    it('touches only entry_access — segments.workspace_ids is left dangling on purpose', async () => {
        const { db, deletes } = executor(0);
        const purger = new EntryAccessWorkspacePurger({
            current: () => db
        } as never);

        await purger.purge(WORKSPACE);

        // A workspace id that matches nothing *narrows* a segment's audience;
        // pruning it would silently widen who may read an entry, which is the
        // failure this plugin exists to prevent. The column's own docblock
        // records that choice — this assertion is what keeps a later "tidy-up"
        // from quietly reversing it.
        expect(deletes).toEqual([entryAccess]);
    });

    it('tolerates a host with no workspaces plugin', () => {
        expect(() =>
            new EntryAccessWorkspacePurger({} as never).onModuleInit()
        ).not.toThrow();
    });
});
