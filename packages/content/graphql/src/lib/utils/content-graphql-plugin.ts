import type { ServerPlugin } from '@ortha-cms/bootstrap-server';
import type { ContentServerPlugin } from '@ortha-cms/content-server';
import { ContentGraphqlModule } from '../content-graphql.module';
import { assertNoNameCollisions } from '../schema/naming';
import {
    resolveConfig,
    type ContentGraphqlPluginConfig,
    type ResolvedContentGraphqlConfig
} from '../types/config';

/** Options for {@link ContentGraphqlPlugin}. */
export interface ContentGraphqlPluginOptions
    extends ContentGraphqlPluginConfig {
    /**
     * The content plugin this one serves.
     *
     * Taken as a value rather than resolved through DI so the **name check
     * below runs at composition time**: two content types that would collide in
     * a GraphQL schema should fail the host's boot, not the first request from
     * the one workspace granted both.
     */
    content: ContentServerPlugin;
}

/** The GraphQL plugin's `ServerPlugin`, with its resolved config attached. */
export interface ContentGraphqlServerPlugin extends ServerPlugin {
    graphqlConfig: ResolvedContentGraphqlConfig;
}

/**
 * The public content API over GraphQL — a second protocol in front of the
 * surface `@ortha-cms/content-server` already serves over REST, with the same
 * bearer tokens, the same workspace bucket, the same scopes, and the same
 * visibility rules.
 *
 * Register it **after** `ContentPlugin` (whose global module exports everything
 * this serves with) and after `IdentityPlugin` (whose `AccessPolicy` decides
 * what a token's scope allows). It owns no schema and ships no migrations —
 * adding it changes nothing about the data, and a token minted before it existed
 * works against it unchanged.
 *
 * Leaving it out of the host's plugin list is the off switch; there is no
 * `enabled` flag, because a plugin that is not registered is not there.
 *
 * @example
 *   ContentGraphqlPlugin({
 *       content: contentPlugin,
 *       limits: { maxDepth: 6 }
 *   })
 */
export function ContentGraphqlPlugin(
    options: ContentGraphqlPluginOptions
): ContentGraphqlServerPlugin {
    const { content, ...config } = options;
    // Checked against the WHOLE registry, not per workspace: a collision between
    // two content types is a modelling bug, and finding it only when some
    // workspace happens to be granted both would turn it into a production
    // surprise instead of a failed boot.
    assertNoNameCollisions(content.registry.all().map((type) => type.name));
    const resolved = resolveConfig(config);
    return {
        name: 'content-graphql',
        module: ContentGraphqlModule.forRoot(resolved),
        graphqlConfig: resolved
    };
}
