/**
 * The media endpoints' response shapes as OpenAPI schemas.
 *
 * Hand-written rather than reflected: `AssetView`, `AssetListView`,
 * `FolderView` and `FoldersView` are TypeScript `interface`s, erased at compile
 * time and invisible to `@nestjs/swagger`, and `StoredMediaTrack` lives in
 * `domain/`, where ADR-0003 forbids the `@nestjs/swagger` import a decorated
 * class would need. See `packages/bootstrap/server/AGENTS.md` →
 * "The response-schema gap".
 *
 * Pure data. The mapping from route to schema lives in `describe-media-api.ts`.
 */

import { MEDIA_TRACK_KIND } from '../domain/value-objects/media-track';

/** A JSON Schema fragment, as it appears in the OpenAPI document. */
export type OpenApiSchema = Record<string, unknown>;

/** A `$ref` at one of this plugin's schemas. */
export function ref(name: string): OpenApiSchema {
    return { $ref: `#/components/schemas/${name}` };
}

/**
 * The coarse categories `media_asset.kind` can hold. Mirrors the `media_kind`
 * Postgres enum the column is typed as, so the list is exhaustive by
 * construction — `AssetView.kind` is declared `string`, but no other value can
 * reach the wire.
 */
const MEDIA_KINDS = ['image', 'video', 'audio', 'document', 'archive'];

/** The schemas this plugin contributes, keyed by component name. */
export function buildMediaSchemas(): Record<string, OpenApiSchema> {
    return {
        MediaTrack: {
            type: 'object',
            title: 'MediaTrack',
            description:
                'One timed-text track attached to a video or audio asset. Empty for everything else.',
            properties: {
                kind: {
                    type: 'string',
                    enum: [...MEDIA_TRACK_KIND],
                    description:
                        'What the track carries, mirroring HTML’s `<track kind>`. `captions` and `subtitles` are distinct: captions carry the non-speech audio a deaf viewer needs, subtitles are a translation.'
                },
                srclang: {
                    type: 'string',
                    description:
                        'BCP-47 tag of the track’s language, e.g. `en` or `pt-BR`.'
                },
                label: {
                    type: 'string',
                    description:
                        'The label a player shows in its track menu, e.g. "English (CC)".'
                },
                assetId: {
                    type: 'string',
                    format: 'uuid',
                    description: 'The media asset holding the WebVTT file.'
                },
                default: {
                    type: 'boolean',
                    description:
                        'Marks the track a player should enable by default. Absent when never set.'
                }
            },
            required: ['kind', 'srclang', 'label', 'assetId']
        },
        MediaAsset: {
            type: 'object',
            title: 'MediaAsset',
            description:
                'A stored media asset. The bytes themselves live in the configured storage backend; this is only the row that points at them.',
            properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', description: 'File name.' },
                folderId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description: 'null at the workspace root.'
                },
                kind: {
                    type: 'string',
                    enum: MEDIA_KINDS,
                    description: 'Coarse category derived from the MIME type.'
                },
                mimeType: {
                    type: 'string',
                    description:
                        'The uploader’s own claim — nothing sniffs the bytes. The download route hardens the response accordingly.'
                },
                size: {
                    type: 'integer',
                    minimum: 0,
                    description: 'Size of the original in bytes.'
                },
                url: {
                    type: 'string',
                    description:
                        'Path of the route that streams the original bytes — always the session route `/api/media/assets/{id}/raw`, on both surfaces. A bearer-token client fetches the same asset at `/api/v1/media/assets/{id}/raw` instead.'
                },
                variants: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                        'Names of the generated derivatives — fetch each at `${url}?variant=<name>`. The shipped image processor emits `thumb` and `preview`; the names are not enumerated here because `ImageProcessor` is a port a deployment may swap. Empty for non-images and for images too small to derive.'
                },
                width: {
                    type: 'integer',
                    nullable: true,
                    description: 'Intrinsic width in pixels; null when unknown.'
                },
                height: {
                    type: 'integer',
                    nullable: true,
                    description:
                        'Intrinsic height in pixels; null when unknown.'
                },
                duration: {
                    type: 'integer',
                    nullable: true,
                    description:
                        'Duration in seconds for timed media; null otherwise.'
                },
                tags: { type: 'array', items: { type: 'string' } },
                alt: {
                    type: 'string',
                    nullable: true,
                    description: 'Text alternative; null when never set.'
                },
                tracks: { type: 'array', items: ref('MediaTrack') },
                uploadedBy: {
                    type: 'string',
                    description:
                        'Display name of the uploader, resolved from the stored user id. For a token upload this is whoever minted the token.'
                },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' }
            },
            required: [
                'id',
                'name',
                'folderId',
                'kind',
                'mimeType',
                'size',
                'url',
                'variants',
                'width',
                'height',
                'duration',
                'tags',
                'alt',
                'tracks',
                'uploadedBy',
                'createdAt',
                'updatedAt'
            ]
        },
        MediaAssetPage: {
            type: 'object',
            title: 'MediaAssetPage',
            description: 'One page of assets.',
            properties: {
                items: { type: 'array', items: ref('MediaAsset') },
                total: {
                    type: 'integer',
                    minimum: 0,
                    description: 'Total matching the filter, across all pages.'
                },
                page: { type: 'integer', minimum: 1 },
                pageSize: { type: 'integer', minimum: 1 }
            },
            required: ['items', 'total', 'page', 'pageSize']
        },
        MediaFolder: {
            type: 'object',
            title: 'MediaFolder',
            properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string' },
                parentId: {
                    type: 'string',
                    format: 'uuid',
                    nullable: true,
                    description: 'null for a top-level folder.'
                },
                assetCount: {
                    type: 'integer',
                    minimum: 0,
                    description:
                        'Assets directly inside this folder — not counting its subfolders’.'
                },
                createdAt: { type: 'string', format: 'date-time' }
            },
            required: ['id', 'name', 'parentId', 'assetCount', 'createdAt']
        },
        MediaFolderTree: {
            type: 'object',
            title: 'MediaFolderTree',
            description:
                'The folders listing. Note the envelope: `{ folders, rootAssetCount }`, **not** the `{ items, total }` every other listing here uses — `rootAssetCount` has no folder row to hang off, so it sits beside the array rather than in it.',
            properties: {
                folders: { type: 'array', items: ref('MediaFolder') },
                rootAssetCount: {
                    type: 'integer',
                    minimum: 0,
                    description:
                        'Assets at the workspace root (no folder) — the admin’s "All media" count.'
                }
            },
            required: ['folders', 'rootAssetCount']
        },
        MediaFolderRef: {
            type: 'object',
            title: 'MediaFolderRef',
            description:
                'The id of the folder that was created or renamed. Deliberately not the whole folder: neither write returns a count or a timestamp the caller does not already have.',
            properties: { id: { type: 'string', format: 'uuid' } },
            required: ['id']
        },
        MediaDeleteResult: {
            type: 'object',
            title: 'MediaDeleteResult',
            properties: {
                deleted: {
                    type: 'integer',
                    minimum: 0,
                    description:
                        'How many of the requested assets were actually removed. Ids outside the workspace, and ids already gone, are silently not counted rather than raising.'
                }
            },
            required: ['deleted']
        }
    };
}
