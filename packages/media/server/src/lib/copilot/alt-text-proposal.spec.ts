import type { ToolContext } from '@orthacms/tools-server';
import { AltTextProposalToolProvider } from './alt-text-proposal.provider';

/**
 * The asset id is the model's own argument, and `AssetViewQuery.byId` filters
 * a `uuid` column — so a malformed one used to come back as a Postgres cast
 * error rather than the "no such asset" a missing id gets.
 */
describe('media_propose_alt_text with a malformed asset id', () => {
    it('is the same "no such asset" as a missing one, without a lookup', async () => {
        const assets = { byId: jest.fn(async () => null) };
        const [tool] = new AltTextProposalToolProvider(assets as never).tools();

        await expect(
            tool.handler(
                { assetId: 'logo.png', alt: 'Our logo', summary: 'Alt text' },
                { workspaceId: 'ws' } as ToolContext
            )
        ).rejects.toThrow('No asset "logo.png".');
        expect(assets.byId).not.toHaveBeenCalled();
    });
});
