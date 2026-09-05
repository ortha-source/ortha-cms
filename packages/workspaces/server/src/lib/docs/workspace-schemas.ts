/**
 * The workspace endpoints' response shapes as OpenAPI schemas.
 *
 * Hand-written rather than reflected, because every one of them is a TypeScript
 * `interface` ({@link WorkspaceView}, {@link WorkspaceMemberView}) — erased at
 * compile time, invisible to `@nestjs/swagger`, and deliberately not a
 * decorated class. See `packages/bootstrap/server/AGENTS.md` →
 * "The response-schema gap".
 *
 * Pure data: no NestJS, no document, no route table. The mapping from route to
 * schema lives in `describe-workspaces-api.ts`.
 */

import { WORKSPACE_COLORS } from '../workspace/domain/value-objects/workspace-color';
import { WORKSPACE_STATUSES } from '../workspace/domain/value-objects/workspace-status';

/** A JSON Schema fragment, as it appears in the OpenAPI document. */
export type OpenApiSchema = Record<string, unknown>;

/** A `$ref` at one of this plugin's schemas. */
export function ref(name: string): OpenApiSchema {
    return { $ref: `#/components/schemas/${name}` };
}

/**
 * The schemas this plugin contributes, keyed by component name.
 *
 * `color` and `status` are enumerated from the value objects that already
 * constrain them, so the document cannot drift from what the aggregate accepts:
 * `WorkspaceColor.create` and `WorkspaceStatus.create` reject anything outside
 * these lists, and the `status` column is a database enum besides.
 */
export function buildWorkspaceSchemas(): Record<string, OpenApiSchema> {
    return {
        WorkspaceMember: {
            type: 'object',
            title: 'WorkspaceMember',
            description:
                'A member of the workspace. Membership is a pure link — it carries no per-workspace role, so there is no role field here.',
            properties: {
                id: {
                    type: 'string',
                    format: 'uuid',
                    description: 'Directory user id.'
                },
                name: {
                    type: 'string',
                    nullable: true,
                    description: 'Display name; null until the user sets one.'
                },
                email: {
                    type: 'string',
                    format: 'email',
                    description: 'Email address.'
                }
            },
            required: ['id', 'name', 'email']
        },
        Workspace: {
            type: 'object',
            title: 'Workspace',
            description: 'A workspace as the workspace endpoints return it.',
            properties: {
                id: { type: 'string', format: 'uuid' },
                name: { type: 'string', description: 'Display name.' },
                slug: {
                    type: 'string',
                    pattern: '^[a-z0-9-]+$',
                    description: 'URL slug; unique across workspaces.'
                },
                description: {
                    type: 'string',
                    description:
                        'Long description. Never null — an unset description is the empty string.'
                },
                color: {
                    type: 'string',
                    enum: [...WORKSPACE_COLORS],
                    description: 'Accent colour key from the avatar palette.'
                },
                status: {
                    type: 'string',
                    enum: [...WORKSPACE_STATUSES],
                    description:
                        'Lifecycle state. Archiving is a soft state change; nothing is deleted.'
                },
                members: {
                    type: 'array',
                    items: ref('WorkspaceMember'),
                    description:
                        'Members in a stable order — earliest membership first, id breaking ties.'
                },
                content: {
                    type: 'array',
                    items: { type: 'string' },
                    description:
                        'Machine names of the content types this workspace was granted (its `workspace_content` rows). The admin scopes its Content Library to these.'
                }
            },
            required: [
                'id',
                'name',
                'slug',
                'description',
                'color',
                'status',
                'members',
                'content'
            ]
        },
        WorkspaceList: {
            type: 'array',
            title: 'WorkspaceList',
            items: ref('Workspace'),
            description:
                'The workspaces the caller is a member of, newest first. Membership is the tenancy boundary: there is no unscoped listing, so a workspace the caller does not belong to never appears.'
        },
        WorkspaceSlugAvailability: {
            type: 'object',
            title: 'WorkspaceSlugAvailability',
            properties: {
                available: {
                    type: 'boolean',
                    description:
                        'Whether the slug is free. Advisory only — the uniqueness constraint is enforced on the write, so a create can still fail with 409 if the slug is taken in between.'
                }
            },
            required: ['available']
        },
        WorkspaceEntryCount: {
            type: 'object',
            title: 'WorkspaceEntryCount',
            properties: {
                count: {
                    type: 'integer',
                    minimum: 0,
                    description: 'Number of content entries.'
                }
            },
            required: ['count']
        }
    };
}
