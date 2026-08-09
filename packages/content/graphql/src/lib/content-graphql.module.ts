import { Module, type DynamicModule } from '@nestjs/common';
import { CONTENT_GRAPHQL_CONFIG } from './content-graphql.tokens';
import { GraphqlController } from './http/controllers/graphql.controller';
import { GraphqlPlaygroundController } from './http/controllers/graphql-playground.controller';
import type { ResolvedContentGraphqlConfig } from './types/config';

/**
 * The content GraphQL plugin's NestJS module.
 *
 * Registers **one controller and one config provider**, and that is the whole
 * module — a measure of how little this package owns. Everything it serves with
 * comes from `ContentModule`, which is `global: true` and exports the public
 * API's collaborators (`PublicEntriesQuery`, `PublicEntryWritesService`,
 * `WorkspaceGrantsQuery`, and the two bearer guards), so nothing needs importing
 * here and there is no second copy of any read, write, or authorization rule.
 *
 * Not `global` itself: no other plugin injects anything from it, and a module
 * that contributes only a route has no reason to be visible everywhere.
 */
@Module({})
export class ContentGraphqlModule {
    /**
     * Creates the module around a resolved config.
     *
     * `features.playground` decides whether the GraphiQL controller is
     * registered **at all**. Gating by registration rather than by a check
     * inside the handler means a deployment with it off serves no such route —
     * there is no live handler to reach, and nothing to get wrong later.
     */
    static forRoot(
        config: ResolvedContentGraphqlConfig,
        features: { playground: boolean } = { playground: false }
    ): DynamicModule {
        return {
            module: ContentGraphqlModule,
            controllers: [
                ...(features.playground ? [GraphqlPlaygroundController] : []),
                GraphqlController
            ],
            providers: [{ provide: CONTENT_GRAPHQL_CONFIG, useValue: config }]
        };
    }
}
