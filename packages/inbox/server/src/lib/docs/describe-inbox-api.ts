/**
 * The inbox plugin's pass over the host's OpenAPI document: its routes answer
 * hand-written `interface`s the scanner cannot see (see
 * `packages/bootstrap/server/AGENTS.md` → "The response-schema gap"), so the
 * success schemas are written here. Pure: it mutates only `/api/inbox` paths.
 */

import type { OpenApiDocument } from '@orthacms/bootstrap-server';
import { INBOX_CATEGORIES, INBOX_KINDS } from '@orthacms/inbox-domain';

type Schema = Record<string, unknown>;

interface Operation {
    responses?: Record<string, { description?: string; content?: unknown }>;
}

const CATEGORY: Schema = { type: 'string', enum: [...INBOX_CATEGORIES] };

/** The component schemas this plugin publishes. */
export const INBOX_SCHEMAS: Record<string, Schema> = {
    InboxItem: {
        type: 'object',
        required: [
            'id',
            'kind',
            'category',
            'workspaceId',
            'payload',
            'link',
            'createdAt',
            'readAt'
        ],
        properties: {
            id: { type: 'string', format: 'uuid' },
            kind: { type: 'string', enum: Object.values(INBOX_KINDS) },
            category: CATEGORY,
            workspaceId: { type: 'string', format: 'uuid', nullable: true },
            payload: {
                type: 'object',
                additionalProperties: true,
                description:
                    'What the sentence is rendered from — its shape depends on `kind` (`InboxPayloads` in `@orthacms/inbox-domain`).'
            },
            link: {
                type: 'string',
                example: 'workspaces/2b6c…/reviews',
                description: 'App-relative path the item opens.'
            },
            createdAt: { type: 'string', format: 'date-time' },
            readAt: { type: 'string', format: 'date-time', nullable: true }
        }
    },
    InboxPage: {
        type: 'object',
        required: ['items', 'nextCursor'],
        properties: {
            items: {
                type: 'array',
                items: { $ref: '#/components/schemas/InboxItem' }
            },
            nextCursor: {
                type: 'string',
                nullable: true,
                description:
                    'Pass as `before` for the next page; null on the last.'
            }
        }
    },
    InboxSummary: {
        type: 'object',
        required: ['unread', 'byCategory'],
        properties: {
            unread: { type: 'integer', example: 6 },
            byCategory: {
                type: 'object',
                required: [...INBOX_CATEGORIES],
                properties: Object.fromEntries(
                    INBOX_CATEGORIES.map((category) => [
                        category,
                        { type: 'integer' }
                    ])
                )
            }
        }
    },
    InboxMarked: {
        type: 'object',
        required: ['marked'],
        properties: { marked: { type: 'integer', example: 4 } }
    }
};

/** The routes, keyed by what follows `/api/inbox`. */
const ROUTES: Record<
    string,
    Record<string, { schema: string; code: string; description: string }>
> = {
    '': {
        get: {
            schema: 'InboxPage',
            code: '200',
            description: 'One page of the caller’s items, newest first.'
        }
    },
    '/summary': {
        get: {
            schema: 'InboxSummary',
            code: '200',
            description: 'The caller’s unread counts, in total and per tab.'
        }
    },
    '/read': {
        post: {
            schema: 'InboxMarked',
            code: '200',
            description: 'How many items were marked read.'
        }
    }
};

/** Writes this plugin's response shapes onto `document`. */
export function describeInboxApi(document: OpenApiDocument): void {
    const components = (document.components ??= {});
    const schemas = (components.schemas ??= {}) as Record<string, unknown>;
    Object.assign(schemas, INBOX_SCHEMAS);

    for (const [suffix, methods] of Object.entries(ROUTES)) {
        const path = document.paths[`/api/inbox${suffix}`];
        if (!path) continue;
        for (const [method, spec] of Object.entries(methods)) {
            const operation = path[method] as Operation | undefined;
            if (!operation) continue;
            operation.responses = {
                ...operation.responses,
                [spec.code]: {
                    description: spec.description,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: `#/components/schemas/${spec.schema}`
                            }
                        }
                    }
                }
            };
        }
    }
}
