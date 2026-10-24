import { ReviewQueueController } from './review-queue.controller';

/**
 * The controller is a seam, and the one thing worth pinning here is **whose**
 * votes "Recently approved" asks about: the signed-in user's, in the workspace
 * the guard resolved — never an id from the query string.
 */
describe('ReviewQueueController', () => {
    function make() {
        const calls: { method: string; args: unknown[] }[] = [];
        const controller = new ReviewQueueController({
            list: async (...args: unknown[]) => {
                calls.push({ method: 'list', args });
                return { items: [], total: 0, overdueAfterDays: 3 };
            },
            recentlyApproved: async (...args: unknown[]) => {
                calls.push({ method: 'recentlyApproved', args });
                return { items: [], windowDays: 30 };
            }
        } as never);
        return { controller, calls };
    }

    const user = { id: 'user-1' } as never;

    it('asks for the caller’s own recent approvals', async () => {
        const { controller, calls } = make();
        await expect(controller.approved('ws-1', user)).resolves.toEqual({
            items: [],
            windowDays: 30
        });
        expect(calls).toEqual([
            { method: 'recentlyApproved', args: ['ws-1', 'user-1'] }
        ]);
    });

    it('passes the queue window and the caller through', async () => {
        const { controller, calls } = make();
        await controller.list(
            'ws-1',
            { mine: true, limit: 10, offset: 20 } as never,
            user
        );
        expect(calls).toEqual([
            {
                method: 'list',
                args: ['ws-1', { mine: true, limit: 10, offset: 20 }, 'user-1']
            }
        ]);
    });
});
