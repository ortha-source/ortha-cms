import { Injectable } from '@nestjs/common';
import { PERMISSIONS } from '@ortha-cms/identity-server';
import type {
    CopilotToolProvider,
    ToolContext,
    ToolSpec
} from '@ortha-cms/copilot-domain';
import { InjectContentRegistry } from '../content.tokens';
import type { ContentTypeRegistry } from '../registry/content-type-registry';
import { EntriesService } from '../entries/infrastructure/queries/entries.service';
import { EntryWriterService } from '../entries/infrastructure/persistence/entry-writer.service';
import { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import { MAX_PAGE_SIZE } from '../entries/entries.constants';

/** Rows a single `content.searchEntries` call may return. */
const MAX_TOOL_PAGE_SIZE = 25;

/**
 * The content plugin's contribution to the copilot's tool catalogue — phase 1's
 * three **read-only** tools.
 *
 * Bindings live with their owner: this package already holds `EntriesService`
 * and the registry, so the tools are thin wrappers over the same services the
 * HTTP controllers call, with no refactor and no duplicated query logic. The
 * copilot never imports content ([`docs/design/copilot.md`](../../../../../docs/design/copilot.md) §4).
 *
 * **Every tool re-checks the workspace's content grants.** `WorkspaceGuard`
 * proved the caller belongs to the workspace, but not that the workspace may
 * reach a given type — and the type name arrives from the *model*, which is
 * steerable by content it has read. `resolveGranted` is the one place that
 * check lives, and every tool goes through it.
 */
@Injectable()
export class ContentCopilotToolProvider implements CopilotToolProvider {
    constructor(
        @InjectContentRegistry()
        private readonly registry: ContentTypeRegistry,
        private readonly entries: EntriesService,
        private readonly writer: EntryWriterService,
        private readonly grants: WorkspaceGrantsQuery
    ) {}

    /** The three read tools, in the order the model sees them. */
    tools(): readonly ToolSpec[] {
        return [this.listTypes(), this.searchEntries(), this.getEntry()];
    }

    /**
     * Resolves a model-supplied type name to a registered type the workspace
     * was actually granted, or throws — the error becomes a tool error the
     * model can recover from.
     *
     * "Not granted" and "does not exist" deliberately produce the **same**
     * message: a distinguishable answer would let a run in one workspace
     * enumerate the deployment's other content types.
     */
    private async resolveGranted(typeName: string, workspaceId: string) {
        const type = this.registry.get(typeName);
        const granted = await this.grants.grantedSlugs(workspaceId);
        if (!type || !granted.has(type.name)) {
            throw new Error(
                `Unknown content type "${typeName}" in this workspace.`
            );
        }
        return type;
    }

    /**
     * `content.listTypes` — the workspace's types, and a named type's full
     * field schema on demand.
     *
     * This is the other half of the "summaries in the prompt, schema on
     * demand" decision (`docs/design/copilot.md` §10): the prompt lists types
     * without fields, and the model calls this when it needs one type's fields,
     * costing one round trip instead of a context window.
     */
    private listTypes(): ToolSpec {
        return {
            name: 'content.listTypes',
            description:
                'List the content types available in this workspace. Pass a typeName to get ' +
                'that type’s full field schema (field names, types, required flags, relation ' +
                'targets) — the schema is not in your system prompt, so call this before ' +
                'reasoning about a type’s fields.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description:
                            'Return this one type with its full field schema. Omit to list all types.'
                    }
                },
                additionalProperties: false
            },
            permissions: [PERMISSIONS.CONTENT_READ],
            effect: 'read',
            run: async (input, ctx: ToolContext) => {
                const { typeName } = (input ?? {}) as { typeName?: string };
                const granted = await this.grants.grantedSlugs(ctx.workspaceId);

                if (typeName) {
                    const type = await this.resolveGranted(
                        typeName,
                        ctx.workspaceId
                    );
                    return { type: this.registry.serialize(type.name) };
                }

                return {
                    types: this.registry
                        .summaries()
                        .filter((summary) => granted.has(summary.name))
                };
            }
        };
    }

    /** `content.searchEntries` — one page of a type's entries. */
    private searchEntries(): ToolSpec {
        return {
            name: 'content.searchEntries',
            description:
                'Search a content type’s entries in this workspace. Free-text search runs across ' +
                'the type’s text-like fields. Results are paginated; the response reports the ' +
                'total so you can tell the user how many matched.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description: 'The content type to search, e.g. "article".'
                    },
                    search: {
                        type: 'string',
                        maxLength: 255,
                        description: 'Free-text query. Omit to list everything.'
                    },
                    sort: {
                        type: 'string',
                        maxLength: 255,
                        description:
                            'A field name, or "-" prefixed for descending, e.g. "-updatedAt".'
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
                        description: `Rows per page (max ${MAX_TOOL_PAGE_SIZE}).`
                    }
                },
                required: ['typeName'],
                additionalProperties: false
            },
            permissions: [PERMISSIONS.CONTENT_READ],
            effect: 'read',
            run: async (input, ctx: ToolContext) => {
                const args = (input ?? {}) as {
                    typeName: string;
                    search?: string;
                    sort?: string;
                    page?: number;
                    pageSize?: number;
                };
                const type = await this.resolveGranted(
                    args.typeName,
                    ctx.workspaceId
                );

                // The page size is clamped rather than trusted. The schema
                // already caps it, but the validator is defence in depth, not
                // the boundary — and a model that ignores `maximum` must not be
                // able to pull the whole table into a prompt.
                const pageSize = Math.min(
                    Math.max(args.pageSize ?? 10, 1),
                    Math.min(MAX_TOOL_PAGE_SIZE, MAX_PAGE_SIZE)
                );

                const result = await this.entries.list(
                    type,
                    {
                        ...(args.search ? { search: args.search } : {}),
                        ...(args.sort ? { sort: args.sort } : {}),
                        page: Math.max(args.page ?? 1, 1),
                        pageSize
                    },
                    ctx.workspaceId
                );

                return {
                    typeName: type.name,
                    total: result.total,
                    page: result.page,
                    pageSize: result.pageSize,
                    items: result.items
                };
            }
        };
    }

    /** `content.getEntry` — one entry in full, by id. */
    private getEntry(): ToolSpec {
        return {
            name: 'content.getEntry',
            description:
                'Fetch one entry of a content type by its id, with all of its field values. ' +
                'Use this after content.searchEntries when you need an entry’s full contents.',
            inputSchema: {
                type: 'object',
                properties: {
                    typeName: {
                        type: 'string',
                        description: 'The entry’s content type.'
                    },
                    id: {
                        type: 'string',
                        description: 'The entry’s id, as returned by content.searchEntries.'
                    }
                },
                required: ['typeName', 'id'],
                additionalProperties: false
            },
            permissions: [PERMISSIONS.CONTENT_READ],
            effect: 'read',
            run: async (input, ctx: ToolContext) => {
                const args = (input ?? {}) as { typeName: string; id: string };
                const type = await this.resolveGranted(
                    args.typeName,
                    ctx.workspaceId
                );
                // `getOne` is workspace-scoped and 404s a soft-deleted row, so
                // the tool inherits both without restating either.
                return this.writer.getOne(type, args.id, ctx.workspaceId);
            }
        };
    }
}
