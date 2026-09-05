import { WebhookWorkspacesPurger } from './webhook-workspaces.purger';
import {
    webhookEndpoints,
    webhookEndpointWorkspaces
} from '../schema/webhook-endpoints';

const WORKSPACE = '11111111-1111-4111-8111-111111111111';

/**
 * A Drizzle-shaped delete recorder. `delete(table).where(...).returning(...)`
 * is the only chain the purger uses, so a stub of exactly that shape is enough
 * — and it records both the table and the condition, which is where the two
 * mistakes this purger could make would show.
 */
function executor(rows: number) {
    const deletes: unknown[] = [];
    const conditions: unknown[] = [];
    return {
        deletes,
        conditions,
        db: {
            delete(table: unknown) {
                deletes.push(table);
                return {
                    where: (condition: unknown) => {
                        conditions.push(condition);
                        return {
                            returning: async () =>
                                Array.from({ length: rows }, () => ({}))
                        };
                    }
                };
            }
        }
    };
}

function purgerWith(rows: number) {
    const { db, deletes, conditions } = executor(rows);
    const uow = { current: () => db } as never;
    return {
        purger: new WebhookWorkspacesPurger(uow),
        deletes,
        conditions
    };
}

describe('WebhookWorkspacesPurger', () => {
    it('names itself once, so a second registration is a loud wiring bug', () => {
        expect(new WebhookWorkspacesPurger({} as never).purgeName).toBe(
            'webhooks:endpoint-workspaces'
        );
    });

    it('removes the subscription rows and reports how many', async () => {
        const { purger, deletes } = purgerWith(3);

        const outcome = await purger.purge(WORKSPACE);

        expect(deletes).toEqual([webhookEndpointWorkspaces]);
        expect(outcome.rows).toBe(3);
    });

    it('never deletes the endpoint itself', async () => {
        const { purger, deletes } = purgerWith(1);

        await purger.purge(WORKSPACE);

        // The endpoint holds a URL and a signing secret somebody configured,
        // and a workspace delete says nothing about either. An endpoint left
        // with no workspaces subscribes to no workspace-carrying event, which
        // is the narrowing the domain already reads an empty set as.
        expect(deletes).not.toContain(webhookEndpoints);
    });

    it('scopes the delete by workspace, not by endpoint', async () => {
        const { purger, conditions } = purgerWith(1);

        await purger.purge(WORKSPACE);

        // The one risk a `where` carries here is naming the wrong column: an
        // `endpointId` comparison would type-check, run, and quietly delete
        // another endpoint's rows. Reading the column out of the built
        // condition is what makes that visible without a database.
        const [condition] = conditions as [{ queryChunks: unknown[] }];
        expect(condition.queryChunks).toContain(
            webhookEndpointWorkspaces.workspaceId
        );
        expect(condition.queryChunks).not.toContain(
            webhookEndpointWorkspaces.endpointId
        );
    });

    it('reports nothing to reclaim — webhooks own no bytes outside the database', async () => {
        const { purger } = purgerWith(0);

        const outcome = await purger.purge(WORKSPACE);

        // Only media defers work past the commit. Queued deliveries for the
        // dead workspace are rows, not bytes, and they cascade from the
        // endpoint rather than being reachable from here.
        expect(outcome).toEqual({ rows: 0 });
    });

    it('tolerates a host with no workspaces plugin, rather than failing to boot', () => {
        const purger = new WebhookWorkspacesPurger({} as never);

        expect(() => purger.onModuleInit()).not.toThrow();
    });

    it('registers itself with the registry when there is one', () => {
        const registered: unknown[] = [];
        const registry = {
            register: (p: unknown) => registered.push(p)
        } as never;
        const purger = new WebhookWorkspacesPurger({} as never, registry);

        purger.onModuleInit();

        expect(registered).toEqual([purger]);
    });
});
