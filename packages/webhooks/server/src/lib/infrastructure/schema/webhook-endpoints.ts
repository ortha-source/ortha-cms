import {
    boolean,
    index,
    integer,
    jsonb,
    pgTable,
    primaryKey,
    text,
    timestamp,
    uuid
} from 'drizzle-orm/pg-core';

/**
 * One configured destination for outgoing webhooks.
 *
 * Global rather than workspace-scoped: an endpoint spans whichever workspaces
 * it was pointed at, holds a signing secret, and is deployment configuration
 * rather than editorial content — the same reasoning that puts API tokens in
 * the directory section instead of inside a workspace.
 *
 * **The secret is stored in the clear.** That is a decision, not an oversight:
 * an API token is only ever *verified*, so a hash is enough, but a webhook
 * secret is used to *sign*, and a signing key that cannot be read back cannot
 * sign anything. What is done instead is to show it exactly once on mint, never
 * return it from the API again (`secretHint` is what the UI shows), and let a
 * deployment encrypt the column at rest.
 *
 * `createdBy` is a plain uuid with no FK, like `alarm_rules.createdBy`: the
 * person who added the endpoint may be deleted and the endpoint must outlive
 * them.
 */
export const webhookEndpoints = pgTable(
    'webhook_endpoints',
    {
        id: uuid('id').primaryKey().defaultRandom(),
        /** Human label shown in the list, e.g. "Rebuild the storefront". */
        name: text('name').notNull(),
        /** Where deliveries are POSTed. Re-checked against the URL policy on
         * every send, not only when it was saved. */
        url: text('url').notNull(),
        /** The HMAC signing key. See the note above on why it is not hashed. */
        secret: text('secret').notNull(),
        /** The last few characters, so the UI can tell two secrets apart after
         * a rotation without ever showing one again. */
        secretHint: text('secret_hint').notNull(),
        /** The manual switch. Auto-disabling clears this too. */
        enabled: boolean('enabled').notNull().default(true),
        /**
         * Subscribed event kinds. **Empty means every kind**, including ones
         * added to the catalogue later — an endpoint that asked for everything
         * should not silently stop covering a new event.
         */
        eventKinds: jsonb('event_kinds').notNull().default([]),
        /** Subscribed content types. **Empty means every type.** */
        contentTypes: jsonb('content_types').notNull().default([]),
        /**
         * Whether the endpoint takes every workspace.
         *
         * Stored explicitly rather than inferred from an empty
         * {@link webhookEndpointWorkspaces} set: fan-out runs on every event
         * and must never have to disambiguate "no rows" between "all" and
         * "none".
         */
        allWorkspaces: boolean('all_workspaces').notNull().default(false),
        /** Extra static headers, filtered through the reserved-name allow-list. */
        headers: jsonb('headers').notNull().default({}),
        /**
         * Whether to inline a snapshot of the record in the body. Off by
         * default: the reference-only envelope makes a receiver read the record
         * back through the public API, where visibility rules and audience
         * entitlements still apply.
         */
        includeEntry: boolean('include_entry').notNull().default(false),
        /** Why the endpoint was switched off automatically; null otherwise. */
        disabledReason: text('disabled_reason'),
        /** Consecutive dead deliveries; any success resets it to zero. */
        consecutiveFailures: integer('consecutive_failures')
            .notNull()
            .default(0),
        /** Who created it. No FK — the endpoint outlives its author. */
        createdBy: uuid('created_by'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow()
    },
    (table) => [
        // Fan-out's only query is "every enabled endpoint", run once per
        // content write. The table is small enough that this index mostly
        // documents the access path — it earns its keep on an install with
        // many endpoints, most of them switched off.
        index('webhook_endpoints_enabled_idx').on(table.enabled)
    ]
);

/**
 * The workspaces an endpoint subscribes to, when it does not take them all.
 *
 * No FK on `workspaceId`: the `workspaces` table belongs to another plugin, and
 * cross-plugin foreign keys are not how this codebase scopes rows — the same
 * convention as `api_token_workspaces` and the generated content tables.
 */
export const webhookEndpointWorkspaces = pgTable(
    'webhook_endpoint_workspaces',
    {
        endpointId: uuid('endpoint_id')
            .notNull()
            .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
        workspaceId: uuid('workspace_id').notNull()
    },
    (table) => [
        primaryKey({ columns: [table.endpointId, table.workspaceId] }),
        // "Which endpoints take this workspace" — the fan-out lookup.
        index('webhook_endpoint_workspaces_workspace_idx').on(table.workspaceId)
    ]
);
