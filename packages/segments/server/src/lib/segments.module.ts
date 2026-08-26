import {
    Module,
    type DynamicModule,
    type MiddlewareConsumer,
    type NestModule
} from '@nestjs/common';
import {
    contentEntryWriteHookRegistrar,
    contentReadScopeRegistrar
} from '@orthacms/content-server';
import { SEGMENTS_CONFIG } from './segments.tokens';
import type { SegmentsPluginConfig } from './types/segments-config';
import { CallerSegmentsStore } from './access/application/caller-segments.store';
import { SegmentCatalogService } from './access/application/segment-catalog.service';
import { DeclaredTypesReconciler } from './access/application/declared-types.reconciler';
import { ProjectionService } from './access/application/projection.service';
import { SegmentReadScope } from './access/infrastructure/read-scope/segment-read-scope';
import { CallerSegmentsMiddleware } from './access/http/middleware/caller-segments.middleware';
import { AccessResolutionService } from './access/application/access-resolution.service';
import { ReprojectionService } from './access/application/reprojection.service';
import { SegmentTypesService } from './access/application/segment-types.service';
import { SegmentsService } from './access/application/segments.service';
import { AccessRulesService } from './access/application/access-rules.service';
import { AssignmentsService } from './access/application/assignments.service';
import { ExplainService } from './access/application/explain.service';
import { EntryProjectionHook } from './access/infrastructure/write-hook/entry-projection.hook';
import { SegmentTypesController } from './access/http/controllers/segment-types.controller';
import { SegmentsController } from './access/http/controllers/segments.controller';
import { AccessRulesController } from './access/http/controllers/access-rules.controller';
import {
    AssignmentsController,
    GrantsController
} from './access/http/controllers/assignments.controller';
import { ExplainController } from './access/http/controllers/explain.controller';

/**
 * NestJS module for the segmentation plugin — reader entitlements, layered per
 * ADR-0003. The domain kernel is a package of its own
 * (`@orthacms/segments-domain`), so this module holds only the application,
 * infrastructure and transport layers; the same split `transfer/server` has with
 * `transfer/domain`.
 *
 * Global, because {@link SegmentReadScope} has to reach content-server's read
 * path and {@link ProjectionService} is what the management API and the entry
 * write hook will call from their own modules.
 *
 * Registered **after** `ContentPlugin`: the read-scope binding is only
 * meaningful once content's port exists to bind to.
 */
@Module({})
export class SegmentsModule implements NestModule {
    /** Creates the global dynamic module. */
    static forRoot(config: SegmentsPluginConfig): DynamicModule {
        return {
            module: SegmentsModule,
            global: true,
            controllers: [
                SegmentTypesController,
                SegmentsController,
                AccessRulesController,
                AssignmentsController,
                GrantsController,
                ExplainController
            ],
            providers: [
                { provide: SEGMENTS_CONFIG, useValue: config },
                CallerSegmentsStore,
                SegmentCatalogService,
                DeclaredTypesReconciler,
                ProjectionService,
                AccessResolutionService,
                ReprojectionService,
                SegmentTypesService,
                SegmentsService,
                AccessRulesService,
                AssignmentsService,
                ExplainService,
                SegmentReadScope,
                EntryProjectionHook,
                // The projection runs in the entry's own write transaction, so
                // an entry is never live without the rule that governs it. The
                // read scope's sibling, registered the same way.
                contentEntryWriteHookRegistrar('segments', EntryProjectionHook),
                // A runtime registration rather than a DI binding: Nest has no
                // multi-provider, so two plugins binding one token would leave
                // the second silently replacing the first — and for a
                // visibility rule that means content quietly becoming visible.
                // The same shape `copilotToolsRegistrar` uses, for the same
                // reason.
                contentReadScopeRegistrar('segments', SegmentReadScope),
                CallerSegmentsMiddleware
            ],
            exports: [
                SEGMENTS_CONFIG,
                CallerSegmentsStore,
                SegmentCatalogService,
                ProjectionService,
                AccessResolutionService,
                ReprojectionService,
                ExplainService
            ]
        };
    }

    /**
     * Resolve the reader on every request.
     *
     * `'*'` rather than a route list: the segments of a caller are a property of
     * the request, not of one controller, and a path filter here would be a
     * second place to keep in step every time a protocol is added. The
     * middleware itself is what decides there is nothing to do — with no active
     * segment type it calls `next()` immediately.
     *
     * The pattern is `{*splat}` rather than the historical `*`: Express 5 uses
     * path-to-regexp 8, where a bare `*` is a parse error rather than a
     * wildcard. `caller-segments.middleware.spec.ts` boots a real Nest app
     * through this method, so the pattern is verified rather than assumed.
     */
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(CallerSegmentsMiddleware).forRoutes('{*splat}');
    }
}
