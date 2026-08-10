import { Injectable, Optional, type OnModuleInit } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import { ToolRegistry } from '@ortha-cms/tools-server';
import type { ToolDefinition, ToolProvider } from '@ortha-cms/tools-server';
import { ListAssetsQuery } from '../infrastructure/queries/list-assets.query';
import { ListFoldersQuery } from '../infrastructure/queries/list-folders.query';
import { DownloadAssetQuery } from '../infrastructure/queries/download-asset.query';
import { mediaKind } from '../infrastructure/schema/media-asset';
import type { AssetView } from '../types/asset-view';
import {
    MAX_READABLE_BYTES,
    isReadableMimeType,
    readAssetText
} from './asset-text';

/** Assets a single `media_assets_search` call may return. */
const MAX_TOOL_PAGE_SIZE = 25;

/**
 * The media plugin's read contribution to the copilot's tool catalogue —
 * `media_assets_search`, `media_folders_list` and `media_asset_read`.
 *
 * Each is a thin wrapper over the same query the library's own route calls,
 * with departures that answer something a model needs and the admin's browser
 * does not:
 *
 * - **Search spans every folder by default.** The library browses one folder at
 *   a time; a model asked "do we have a logo?" does not know which folder to
 *   look in, and a folder-scoped search would answer "no" for an asset that
 *   exists.
 * - **Search returns a narrowed projection.** A full `AssetView` carries
 *   variant lists and intrinsic dimensions, which cost prompt tokens and answer
 *   nothing.
 * - **Folders come back flat.** `parentId` is enough for a model to rebuild the
 *   tree, and costs fewer tokens than nesting it here would.
 *
 * Every query is workspace-scoped, so an id from another workspace simply does
 * not match — with one explicit exception handled in `readAsset` below.
 */
@Injectable()
export class MediaCopilotToolProvider implements ToolProvider, OnModuleInit {
    constructor(
        private readonly assets: ListAssetsQuery,
        private readonly folders: ListFoldersQuery,
        private readonly download: DownloadAssetQuery,
        @Optional() private readonly toolRegistry?: ToolRegistry
    ) {}

    /**
     * Register with the shared tool registry once the DI graph is built —
     * the same catalogue the MCP endpoint serves, narrowed to the `copilot`
     * surface by each tool's `surfaces`. `@Optional()` because a deployment
     * may run neither consumer, in which case these simply go unregistered.
     */
    onModuleInit(): void {
        this.toolRegistry?.register(this);
    }

    /** The media read tools. */
    tools(): readonly ToolDefinition[] {
        return [this.searchAssets(), this.listFolders(), this.readAsset()];
    }

    /** `media_assets_search` — one page of the workspace's media library. */
    private searchAssets(): ToolDefinition {
        return {
            name: 'media_assets_search',
            title: 'Search media assets',
            description:
                'Search the workspace’s media library by file name, across every folder. ' +
                'Filter by `kind` to narrow to images, video, audio, documents or archives. ' +
                'Returns each asset’s id, name, kind, MIME type, size, alt text and a ' +
                '`downloadPath` you can offer the user as a link — use the id to reference an ' +
                'asset in an answer or pass it to another tool, and note that an asset with no ' +
                'alt text reports `alt: null`. To search one folder, get its id from ' +
                'media_folders_list first.',
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
                            'Restrict to one folder, as returned by media_folders_list. Omit to ' +
                            'search every folder — usually what you want.'
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
            requires: [PERMISSIONS.MEDIA_READ],
            readOnly: true,
            effect: 'read',
            surfaces: ['copilot'],
            handler: async (input, ctx) => {
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

    /**
     * `media_folders_list` — every folder in the workspace, flat.
     *
     * This is what makes `media_assets_search`'s `folderId` usable at all.
     * Nothing else in the catalogue tells a model that folders exist or what
     * their ids are, so before this tool "what's in the Brand folder?" was
     * unanswerable however the search tool was described.
     *
     * No pagination and no arguments: a workspace has tens of folders, not
     * thousands, and the whole list is smaller than the paging metadata that
     * would describe it. If that stops being true, cap it then.
     */
    private listFolders(): ToolDefinition {
        return {
            name: 'media_folders_list',
            title: 'List media folders',
            description:
                'List every folder in the workspace’s media library, each with the number of ' +
                'assets directly inside it. The list is flat — follow `parentId` to rebuild the ' +
                'tree, where `null` means a top-level folder. `rootAssetCount` is how many ' +
                'assets sit outside any folder. Call this first whenever the user names a ' +
                'folder, to turn that name into the id the other media tools take.',
            inputSchema: {
                type: 'object',
                properties: {},
                additionalProperties: false
            },
            requires: [PERMISSIONS.MEDIA_READ],
            readOnly: true,
            effect: 'read',
            surfaces: ['copilot'],
            handler: async (_input, ctx) =>
                this.folders.execute(ctx.workspaceId)
        };
    }

    /**
     * `media_asset_read` — the decoded contents of a text asset.
     *
     * The one tool here that reads bytes rather than rows, and the one that
     * widens the prompt-injection surface: until now the copilot read content
     * the team authored, and this reads a file anyone holding `media:create`
     * put in the library. A `.md` file is a perfect vehicle for "ignore your
     * previous instructions".
     *
     * The defence is the one every tool result already gets — the run engine
     * wraps this output in `fenceUntrusted` before the model sees it, which
     * makes the closing delimiter unforgeable from inside the payload
     * (ADR-0005 §8). That makes injection harder, not impossible, and the real
     * ceiling stays the capability profile: a viewer whose copilot reads a
     * hostile file still cannot write anything, because it was never offered a
     * write tool.
     */
    private readAsset(): ToolDefinition {
        return {
            name: 'media_asset_read',
            title: 'Read a text asset',
            description:
                'Read the contents of a text file in the media library — Markdown, CSV, JSON, ' +
                'XML, HTML or plain text. Find the asset with media_assets_search first and ' +
                'pass its id. Binary files (PDF, Word, images, archives) cannot be read and ' +
                'return an error saying so. Files larger than ' +
                `${Math.round(MAX_READABLE_BYTES / 1024)}KB come back cut short with ` +
                '`truncated: true` — say so rather than describing a partial file as if it ' +
                'were whole.',
            inputSchema: {
                type: 'object',
                properties: {
                    assetId: {
                        type: 'string',
                        description:
                            'The asset’s id, as returned by media_assets_search.'
                    }
                },
                required: ['assetId'],
                additionalProperties: false
            },
            requires: [PERMISSIONS.MEDIA_READ],
            readOnly: true,
            effect: 'read',
            surfaces: ['copilot'],
            handler: async (input, ctx) => {
                const { assetId } = (input ?? {}) as { assetId: string };

                // `locate` is deliberately UNSCOPED — the download route
                // derives the workspace from the row because an `<img>` tag
                // cannot send `X-Workspace-Id`. Nothing upstream has scoped
                // this call, so the check belongs here, and a mismatch reports
                // the same "no such asset" as a missing row: an id from another
                // workspace must not be distinguishable from one that does not
                // exist, or the tool becomes an asset-id oracle.
                const location = await this.download.locate(assetId);
                if (!location || location.workspaceId !== ctx.workspaceId) {
                    throw new Error(`No asset "${assetId}".`);
                }

                if (!isReadableMimeType(location.mimeType)) {
                    throw new Error(
                        `"${location.name}" is ${location.mimeType}, which is not a text format. ` +
                            'Only text files can be read.'
                    );
                }

                const stream = await this.download.open(location);
                const { text, truncated, bytesRead } =
                    await readAssetText(stream);

                return {
                    id: assetId,
                    name: location.name,
                    mimeType: location.mimeType,
                    size: location.size,
                    bytesRead,
                    truncated,
                    text
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
        createdAt: asset.createdAt,
        // The full `AssetView.url` is still dropped — it is a session-gated
        // route the *model* cannot fetch, so spending tokens on it buys
        // nothing. The path is kept because the model is not the only reader:
        // the person asking "list the files in the library" wants links they
        // can click, and their browser is signed in. The raw route derives its
        // scope from workspace membership precisely so a browser can load it
        // directly, which is what makes this safe to hand out.
        downloadPath: `/api/media/assets/${asset.id}/raw`
    };
}
