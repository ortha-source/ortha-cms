import type { ExecutorContext } from '@nx/devkit';

const syncContentManifest = jest.fn();

jest.mock('@orthacms/cli', () => ({
    syncContentManifest: (...args: unknown[]) => syncContentManifest(...args)
}));

import contentSyncExecutor from './executor';

describe('content-sync executor', () => {
    it('syncs the host content folder, resolved against the workspace', async () => {
        syncContentManifest.mockResolvedValue({ count: 10, changed: false });
        const log = jest
            .spyOn(console, 'log')
            .mockImplementation(() => undefined);

        await expect(
            contentSyncExecutor({ contentDir: 'apps/server/src/content' }, {
                root: '/repo'
            } as ExecutorContext)
        ).resolves.toEqual({ success: true });

        expect(syncContentManifest).toHaveBeenCalledWith(
            '/repo/apps/server/src/content',
            expect.any(Function)
        );
        expect(log).toHaveBeenCalledWith(
            'content sync: apps/server/src/content/index.ts is already up to date (10 type(s))'
        );
        log.mockRestore();
    });
});
