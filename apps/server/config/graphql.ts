/** The public GraphQL endpoint's cost budget. */
import type { ContentGraphqlPluginConfig } from '@orthacms/content-graphql';

/**
 * The public GraphQL endpoint's cost budget — the replacement for the
 * structural bound a REST route gets for free (ADR-0008). Code rather than
 * environment: loosening it is a decision to review, not a dashboard value.
 */
export function contentGraphqlConfig(): ContentGraphqlPluginConfig {
    return {
        limits: {
            maxDepth: 8,
            maxComplexity: 1000,
            maxFields: 500,
            maxQueryLength: 16_384
        },
        // How long a workspace's built schema is reused before it is derived
        // again from its content grants. Freshness only — every read is still
        // authorized against the live grants.
        schemaCacheTtlMs: 60_000
    };
}
