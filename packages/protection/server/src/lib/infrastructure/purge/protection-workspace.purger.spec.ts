import { ProtectionWorkspacePurger } from './protection-workspace.purger';
import { protectionRules } from '../schema/protection-rules';
import { reviewApprovals } from '../schema/review-approvals';
import { reviewRequests } from '../schema/review-requests';

const WORKSPACE = '33333333-3333-4333-8333-333333333333';

/** Records which table each delete targeted; the only chain the purger uses. */
function executor(rowsPerTable: number) {
    const deletes: unknown[] = [];
    return {
        deletes,
        db: {
            delete(table: unknown) {
                deletes.push(table);
                return {
                    where: () => ({
                        returning: async () =>
                            Array.from({ length: rowsPerTable }, () => ({}))
                    })
                };
            }
        }
    };
}

describe('ProtectionWorkspacePurger', () => {
    it('names itself once, so a second registration is a loud wiring bug', () => {
        expect(new ProtectionWorkspacePurger({} as never).purgeName).toBe(
            'protection:rules-and-reviews'
        );
    });

    /**
     * All three, not just the rules. `review_approvals.revision_id` points at
     * `content_entry_revisions`, which is host-owned and therefore un-FK-able
     * from a plugin — so votes outlive the entries, the revisions *and* the
     * workspace unless something deletes them by workspace.
     */
    it('clears all three of the plugin’s tables [protection:I-16]', async () => {
        const { db, deletes } = executor(2);
        const purger = new ProtectionWorkspacePurger({
            current: () => db
        } as never);

        const outcome = await purger.purge(WORKSPACE);

        expect(deletes).toEqual([
            reviewApprovals,
            reviewRequests,
            protectionRules
        ]);
        expect(outcome).toEqual({ rows: 6 });
    });

    /**
     * Votes and requests before rules. Nothing enforces it — there is no
     * foreign key between the three — but a partial failure that left a rule
     * with no votes reads as an untouched rule, while votes with no rule read
     * as a policy that vanished.
     */
    it('deletes the dependent rows before the rule they belong to', async () => {
        const { db, deletes } = executor(0);
        const purger = new ProtectionWorkspacePurger({
            current: () => db
        } as never);

        await purger.purge(WORKSPACE);

        expect(deletes.indexOf(protectionRules)).toBe(deletes.length - 1);
    });

    it('reports zero on a workspace that never protected anything', async () => {
        const { db } = executor(0);
        const purger = new ProtectionWorkspacePurger({
            current: () => db
        } as never);

        expect(await purger.purge(WORKSPACE)).toEqual({ rows: 0 });
    });

    it('registers itself with the workspaces registry when there is one', () => {
        const registered: unknown[] = [];
        const purger = new ProtectionWorkspacePurger(
            {} as never,
            {
                register: (entry: unknown) => registered.push(entry)
            } as never
        );

        purger.onModuleInit();

        expect(registered).toEqual([purger]);
    });

    /**
     * A host running this plugin without `WorkspacesPlugin` is not a real
     * configuration, but it must boot rather than fail on an injection it
     * cannot influence — the same optional-registry shape every purger uses.
     */
    it('tolerates a host with no workspaces plugin', () => {
        const purger = new ProtectionWorkspacePurger({} as never);

        expect(() => purger.onModuleInit()).not.toThrow();
    });
});
