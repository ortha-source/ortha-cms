// orthacms:if graphql
import type { ContentGraphqlPluginConfig } from '@orthacms/content-graphql';

/** The public GraphQL endpoint's cost budget. */
export function contentGraphqlConfig(): ContentGraphqlPluginConfig {
    return {
        // The cost budget one GraphQL operation may spend. REST bounded a
        // request structurally — one route, one page — and a GraphQL document
        // does not, so these are the replacement bound. Code rather than
        // environment: loosening a cost budget is a change to review.
        limits: {
            maxDepth: 8,
            maxComplexity: 1000,
            maxFields: 500,
            maxQueryLength: 16_384
        },
        // How long a built schema is reused before it is derived again from the
        // workspace's content grants. Freshness only — every read is authorized
        // against the live grants regardless.
        schemaCacheTtlMs: 60_000
    };
}
// orthacms:end
