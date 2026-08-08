import { Module, type DynamicModule } from '@nestjs/common';
import { CONTENT_GRAPHQL_CONFIG } from './content-graphql.tokens';
import { GraphqlController } from './http/controllers/graphql.controller';
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
    /** Creates the module around a resolved config. */
    static forRoot(config: ResolvedContentGraphqlConfig): DynamicModule {
        return {
            module: ContentGraphqlModule,
            controllers: [GraphqlController],
            providers: [{ provide: CONTENT_GRAPHQL_CONFIG, useValue: config }]
        };
    }
}
