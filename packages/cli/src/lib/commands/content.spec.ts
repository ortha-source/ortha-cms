const syncContentManifest = jest.fn();

jest.mock('../content/sync-content-manifest', () => ({
    syncContentManifest: (...args: unknown[]) => syncContentManifest(...args)
}));

import { contentCommand } from './content';

beforeEach(() => jest.clearAllMocks());

describe('contentCommand', () => {
    it('syncs the manifest under the app’s content folder', async () => {
        syncContentManifest.mockResolvedValue({ count: 3, changed: true });
        const log = jest
            .spyOn(console, 'log')
            .mockImplementation(() => undefined);

        await contentCommand('/app', ['sync']);

        expect(syncContentManifest).toHaveBeenCalledWith(
            '/app/apps/server/src/content',
            expect.any(Function)
        );
        expect(log).toHaveBeenCalledWith(
            'content sync: 3 type(s) → apps/server/src/content/index.ts'
        );
        log.mockRestore();
    });

    it('refuses anything but sync', async () => {
        await expect(contentCommand('/app', ['add'])).rejects.toThrow(
            'Unknown content command "add".'
        );
        await expect(contentCommand('/app', [])).rejects.toThrow(
            'Did you mean `orthacms content sync`?'
        );
        expect(syncContentManifest).not.toHaveBeenCalled();
    });
});
