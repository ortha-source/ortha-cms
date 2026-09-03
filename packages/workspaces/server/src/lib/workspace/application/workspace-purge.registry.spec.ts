import { WorkspacePurgeRegistry } from './workspace-purge.registry';
import type {
    WorkspacePurger,
    WorkspacePurgeOutcome
} from './ports/workspace-purger.port';

const WORKSPACE = 'ws-1';

/** A purger that records its calls and returns a fixed outcome. */
function purger(
    purgeName: string,
    outcome: Partial<WorkspacePurgeOutcome> = {},
    calls: string[] = []
): WorkspacePurger {
    return {
        purgeName,
        purge: async (workspaceId) => {
            calls.push(`${purgeName}:${workspaceId}`);
            return { rows: 0, ...outcome };
        }
    };
}

describe('WorkspacePurgeRegistry', () => {
    let registry: WorkspacePurgeRegistry;

    beforeEach(() => {
        registry = new WorkspacePurgeRegistry();
    });

    describe('registration', () => {
        it('starts empty, so a host without contributors purges nothing', async () => {
            const { report } = await registry.purgeAll(WORKSPACE);

            expect(registry.registered).toEqual([]);
            expect(report).toEqual({ rowsByPurger: {}, total: 0 });
        });

        it('refuses a duplicate name rather than double-counting it [workspaces:I-19]', () => {
            registry.register(purger('media'));

            // Registering twice would run the same reclaim twice and report
            // twice the rows — a wiring bug worth failing loudly on.
            expect(() => registry.register(purger('media'))).toThrow(
                /Duplicate workspace purger "media"/
            );
            expect(registry.registered).toEqual(['media']);
        });
    });

    describe('purgeAll', () => {
        it('runs every purger against the workspace and totals the rows', async () => {
            const calls: string[] = [];
            registry.register(purger('media', { rows: 12 }, calls));
            registry.register(purger('identity', { rows: 3 }, calls));

            const { report } = await registry.purgeAll(WORKSPACE);

            expect(calls).toEqual(['media:ws-1', 'identity:ws-1']);
            expect(report).toEqual({
                rowsByPurger: { media: 12, identity: 3 },
                total: 15
            });
        });

        it('propagates a failure so the caller can roll the whole delete back', async () => {
            registry.register(purger('media', { rows: 5 }));
            registry.register({
                purgeName: 'identity',
                purge: async () => {
                    throw new Error('connection lost');
                }
            });

            // A partial purge is exactly the orphaning this exists to prevent.
            await expect(registry.purgeAll(WORKSPACE)).rejects.toThrow(
                'connection lost'
            );
        });
    });

    describe('deferred reclaim', () => {
        it('does not run reclaim during the purge itself', async () => {
            let reclaimed = false;
            registry.register(
                purger('media', {
                    rows: 1,
                    reclaim: async () => {
                        reclaimed = true;
                    }
                })
            );

            // The rows are still uncommitted at this point; destroying bytes
            // now would strand a surviving row's blobs on a rollback.
            const { reclaim } = await registry.purgeAll(WORKSPACE);
            expect(reclaimed).toBe(false);

            await reclaim();
            expect(reclaimed).toBe(true);
        });

        it('swallows a reclaim failure — the rows are already committed [workspaces:I-18]', async () => {
            const ran: string[] = [];
            registry.register(
                purger('media', {
                    rows: 1,
                    reclaim: async () => {
                        throw new Error('storage unreachable');
                    }
                })
            );
            registry.register(
                purger('identity', {
                    rows: 1,
                    reclaim: async () => {
                        ran.push('identity');
                    }
                })
            );

            const { reclaim } = await registry.purgeAll(WORKSPACE);

            // Throwing here would report a failed delete that in fact
            // succeeded — and must not stop the other contributors' cleanup.
            await expect(reclaim()).resolves.toBeUndefined();
            expect(ran).toEqual(['identity']);
        });

        it('is a no-op for purgers that defer nothing', async () => {
            registry.register(purger('identity', { rows: 4 }));

            const { reclaim } = await registry.purgeAll(WORKSPACE);

            await expect(reclaim()).resolves.toBeUndefined();
        });
    });
});
