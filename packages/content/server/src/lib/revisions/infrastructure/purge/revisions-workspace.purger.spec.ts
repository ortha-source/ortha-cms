import { RevisionsWorkspacePurger } from './revisions-workspace.purger';
import { contentEntryRevisions } from '../persistence/revision-table';

const WORKSPACE = '33333333-3333-4333-8333-333333333333';

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

describe('RevisionsWorkspacePurger', () => {
    it('names itself once, so a second registration is a loud wiring bug', () => {
        expect(new RevisionsWorkspacePurger({} as never).purgeName).toBe(
            'content:entry-revisions'
        );
    });

    it('clears the workspace’s revision history', async () => {
        const { db, deletes } = executor(7);
        const purger = new RevisionsWorkspacePurger({
            current: () => db
        } as never);

        const outcome = await purger.purge(WORKSPACE);

        // Content otherwise refuses rather than purges, but revisions fall
        // outside that protection in both directions: no FK to `workspaces`,
        // and `countWorkspaceEntries` sums live entry tables only — so a
        // workspace whose entries were all deleted counts as empty, deletes
        // cleanly, and used to strand its whole version timeline.
        expect(deletes).toEqual([contentEntryRevisions]);
        expect(outcome).toEqual({ rows: 7 });
    });

    it('tolerates a host with no workspaces plugin', () => {
        expect(() =>
            new RevisionsWorkspacePurger({} as never).onModuleInit()
        ).not.toThrow();
    });
});
