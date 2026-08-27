import { BadRequestException, HttpException } from '@nestjs/common';
import type { ToolContext, ToolDefinition } from '@orthacms/tools-server';
import { InvalidAssetFilterError } from '../domain/errors';
import type { DownloadAssetQuery } from '../infrastructure/queries/download-asset.query';
import type { ListAssetsQuery } from '../infrastructure/queries/list-assets.query';
import type { ListFoldersQuery } from '../infrastructure/queries/list-folders.query';
import { MediaCopilotToolProvider } from './media-tool.provider';

/**
 * The three media tools omit `surfaces`, so they are offered to **both** the
 * copilot and MCP — and the two flatten a throw differently. The run engine
 * reports `error.message`, while MCP's `toToolError` treats anything that is
 * not an `HttpException` as a bug and answers an opaque 500 with the message
 * withheld. So a bad argument that leaves this provider as a bare `Error` is
 * legible on one surface and a dead end on the other.
 *
 * These assert the boundary itself: what the handlers throw, not what a
 * transport makes of it.
 */
describe('MediaCopilotToolProvider error mapping', () => {
    const ctx: ToolContext = {
        actor: {
            kind: 'token',
            id: 'token-1',
            displayName: 'test',
            grantedPermissions: new Set<string>(),
            userId: null
        },
        workspaceId: 'ws-1',
        surface: 'mcp',
        // Matches the empty grant set above: these assert what a handler
        // throws, so nothing here should widen on a permission.
        can: () => false
    };

    const build = (
        overrides: {
            assets?: Partial<ListAssetsQuery>;
            download?: Partial<DownloadAssetQuery>;
        } = {}
    ) => {
        const assets = {
            execute: jest.fn().mockResolvedValue({
                total: 0,
                page: 1,
                pageSize: 10,
                items: []
            }),
            ...overrides.assets
        } as unknown as ListAssetsQuery;
        const folders = {
            execute: jest.fn().mockResolvedValue([])
        } as unknown as ListFoldersQuery;
        const download = {
            locate: jest.fn().mockResolvedValue(null),
            open: jest.fn(),
            ...overrides.download
        } as unknown as DownloadAssetQuery;

        const provider = new MediaCopilotToolProvider(
            assets,
            folders,
            download
        );
        const byName = (name: string): ToolDefinition => {
            const tool = provider.tools().find((one) => one.name === name);
            if (!tool) throw new Error(`no tool named ${name}`);
            return tool;
        };
        return { assets, download, byName };
    };

    describe('media_assets_search', () => {
        it('maps a rejected filter to a 400 rather than letting it escape raw', async () => {
            // `assertValidFilters` lives inside `ListAssetsQuery` and raises a
            // framework-free domain error — one layer below the `throw new
            // BadRequestException` the provider already does for itself, which
            // is why reading only this file made the class look covered.
            const { byName } = build({
                assets: {
                    execute: jest
                        .fn()
                        .mockRejectedValue(
                            new InvalidAssetFilterError(
                                'folderId',
                                'folderId must be a UUID'
                            )
                        )
                } as Partial<ListAssetsQuery>
            });

            const thrown = await byName('media_assets_search')
                .handler({ folderId: 'not-a-uuid' }, ctx)
                .catch((error: unknown) => error);

            expect(thrown).toBeInstanceOf(BadRequestException);
            // The reason survives the mapping: an opaque 400 is no more use to
            // a model than the opaque 500 was.
            expect((thrown as BadRequestException).message).toBe(
                'folderId must be a UUID'
            );
        });

        it('still lets a genuine fault through as itself', async () => {
            // `toHttp` rethrows what it does not recognize, so a real bug stays
            // a 500 with its message withheld instead of being dressed up as a
            // caller error the model will retry forever.
            const boom = new Error('connection terminated unexpectedly');
            const { byName } = build({
                assets: {
                    execute: jest.fn().mockRejectedValue(boom)
                } as Partial<ListAssetsQuery>
            });

            await expect(
                byName('media_assets_search').handler({}, ctx)
            ).rejects.toBe(boom);
        });

        it('answers an ordinary search untouched', async () => {
            const { byName } = build();

            await expect(
                byName('media_assets_search').handler({ pageSize: 5 }, ctx)
            ).resolves.toMatchObject({ total: 0, items: [] });
        });
    });

    describe('media_asset_read', () => {
        it('refuses a non-uuid assetId before it reaches the driver', async () => {
            // `locate` filters on a `uuid` column, so a non-uuid used to come
            // back as a driver-level `invalid input syntax for type uuid` — a
            // 500 for what is plainly a bad argument. The registry's JSON
            // Schema subset ignores `format`, so nothing upstream checks it.
            const { byName, download } = build();

            await expect(
                byName('media_asset_read').handler(
                    { assetId: 'not-a-uuid' },
                    ctx
                )
            ).rejects.toBeInstanceOf(BadRequestException);
            expect(download.locate).not.toHaveBeenCalled();
        });

        it('reports an unknown but well-formed id as not found', async () => {
            const { byName } = build();

            const thrown = await byName('media_asset_read')
                .handler(
                    { assetId: '11111111-1111-4111-8111-111111111111' },
                    ctx
                )
                .catch((error: unknown) => error);

            expect(thrown).toBeInstanceOf(HttpException);
            expect((thrown as HttpException).getStatus()).toBe(404);
        });
    });
});
