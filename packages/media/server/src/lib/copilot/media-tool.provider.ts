import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import type {
    CopilotToolProvider,
    ToolContext,
    ToolSpec
} from '@ortha-cms/copilot-domain';
import { ListAssetsQuery } from '../infrastructure/queries/list-assets.query';
import { mediaKind } from '../infrastructure/schema/media-asset';
import type { AssetView } from '../types/asset-view';

/** Assets a single `media.searchAssets` call may return. */
const MAX_TOOL_PAGE_SIZE = 25;

/**
 * The media plugin's contribution to the copilot's tool catalogue —
 * `media.searchAssets`.
 *
 * A thin wrapper over the same `ListAssetsQuery` the library's own route calls,
 * with two departures, each answering something a model needs and the admin's
 * browser does not:
 *
 * - **It searches every folder by default.** The library browses one folder at
 *   a time; a model asked "do we have a logo?" does not know which folder to
 *   look in, and a folder-scoped search would answer "no" for an asset that
 *   exists.
 * - **It returns a narrowed projection.** A full `AssetView` carries storage
 *   URLs, variant lists and intrinsic dimensions, which cost prompt tokens and
 *   answer nothing — and whose `url` is a session-gated route the model cannot
 *   fetch anyway. What is left is what a sentence about an asset is made of.
 *
 * The query is workspace-scoped on every read, so an id from another workspace
 * simply does not match.
 */
@Injectable()
export class MediaCopilotToolProvider implements CopilotToolProvider {
    constructor(private readonly assets: ListAssetsQuery) {}

    /** The one media read tool. */
    tools(): readonly ToolSpec[] {
        return [this.searchAssets()];
    }

    /** `media.searchAssets` — one page of the workspace's media library. */
    private searchAssets(): ToolSpec {
        return {
            name: 'media.searchAssets',
            description:
                'Search the workspace’s media library by file name, across every folder. ' +
                'Filter by `kind` to narrow to images, video, audio, documents or archives. ' +
                'Returns each asset’s id, name, kind, MIME type, size and alt text — use the ' +
                'id to reference an asset in an answer, and note that an asset with no alt ' +
                'text reports `alt: null`.',
            inputSchema: {
                type: 'object',
                properties: {
                    search: {
                        type: 'string',
                        maxLength: 255,
                        description:
                            'Case-insensitive substring of the file name. Omit to list everything.'
                    },
                    kind: {
                        type: 'string',
                        enum: [...mediaKind.enumValues],
                        description: 'Restrict to one coarse media category.'
                    },
                    folderId: {
                        type: 'string',
                        description:
                            'Restrict to one folder. Omit to search every folder — usually what you want.'
                    },
                    sort: {
                        type: 'string',
                        enum: [
                            'newest',
                            'oldest',
                            'name-asc',
                            'name-desc',
                            'largest',
                            'smallest'
                        ],
                        description: 'Result order. Defaults to newest first.'
                    },
                    page: {
                        type: 'integer',
                        minimum: 1,
                        description: '1-based page number.'
                    },
                    pageSize: {
                        type: 'integer',
                        minimum: 1,
                        maximum: MAX_TOOL_PAGE_SIZE,
                        description: `Assets per page (max ${MAX_TOOL_PAGE_SIZE}).`
                    }
                },
                additionalProperties: false
            },
            permissions: [PERMISSIONS.MEDIA_READ],
            effect: 'read',
            run: async (input, ctx: ToolContext) => {
                const args = (input ?? {}) as {
                    search?: string;
                    kind?: string;
                    folderId?: string;
                    sort?: string;
                    page?: number;
                    pageSize?: number;
                };

                // Clamped in `run` as well as declared in the schema: the
                // validator is defence in depth, not the boundary.
                const pageSize = Math.min(
                    Math.max(args.pageSize ?? 10, 1),
                    MAX_TOOL_PAGE_SIZE
                );
                const result = await this.assets.execute({
                    workspaceId: ctx.workspaceId,
                    // Spread rather than pass `folderId: args.folderId`: the
                    // query distinguishes an absent key (every folder) from an
                    // explicit `null` (the root folder), and passing
                    // `undefined` under the key would read as the root.
                    ...(args.folderId ? { folderId: args.folderId } : {}),
                    ...(args.search ? { search: args.search } : {}),
                    ...(args.kind ? { kind: args.kind } : {}),
                    ...(args.sort ? { sort: args.sort } : {}),
                    page: Math.max(args.page ?? 1, 1),
                    pageSize
                });

                return {
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    items: result.items.map(summarizeAsset)
                };
            }
        };
    }
}

/** The fields of an asset worth spending prompt tokens on. */
function summarizeAsset(asset: AssetView) {
    return {
        id: asset.id,
        name: asset.name,
        kind: asset.kind,
        mimeType: asset.mimeType,
        size: asset.size,
        alt: asset.alt,
        tags: asset.tags,
        folderId: asset.folderId,
        createdAt: asset.createdAt
    };
}
