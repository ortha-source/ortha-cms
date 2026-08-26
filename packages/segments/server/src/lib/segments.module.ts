import {
    Module,
    type DynamicModule,
    type MiddlewareConsumer,
    type NestModule
} from '@nestjs/common';
import { contentReadScopeRegistrar } from '@orthacms/content-server';
import { SEGMENTS_CONFIG } from './segments.tokens';
import type { SegmentsPluginConfig } from './types/segments-config';
import { SegmentCatalogService } from './application/segment-catalog.service';
import { SegmentsService } from './application/segments.service';
import { EntryAccessService } from './application/entry-access.service';
import { ReaderStore } from './application/reader.store';
import { SegmentReadScope } from './infrastructure/segment-read-scope';
import { ReaderMiddleware } from './http/reader.middleware';
import { SegmentsController } from './http/segments.controller';
import { EntryAccessController } from './http/entry-access.controller';

/**
 * The segmentation plugin's module — two tables, two controllers, one
 * predicate.
 *
 * Global, because {@link SegmentReadScope} has to reach content-server's read
 * path from wherever the query is built.
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
            controllers: [SegmentsController, EntryAccessController],
            providers: [
                { provide: SEGMENTS_CONFIG, useValue: config },
                SegmentCatalogService,
                SegmentsService,
                EntryAccessService,
                ReaderStore,
                SegmentReadScope,
                // A runtime registration rather than a DI binding: Nest has no
                // multi-provider, so two plugins binding one token would leave
                // the second silently replacing the first — and for a
                // visibility rule that means content quietly becoming visible.
                contentReadScopeRegistrar('segments', SegmentReadScope),
                ReaderMiddleware
            ],
            exports: [
                SEGMENTS_CONFIG,
                SegmentCatalogService,
                EntryAccessService,
                ReaderStore
            ]
        };
    }

    /**
     * Resolve the reader on every request.
     *
     * Every route, not a list: who is reading is a property of the request, not
     * of one controller, and a path filter here would be a second place to keep
     * in step each time a protocol is added. The middleware itself decides
     * there is nothing to do — with no segment defined it calls `next()`
     * immediately.
     *
     * The pattern is `{*splat}` rather than the historical `*`: Express 5 uses
     * path-to-regexp 8, where a bare `*` is a parse error rather than a
     * wildcard — a mistake no typecheck catches and that would leave the plugin
     * silently never running.
     */
    configure(consumer: MiddlewareConsumer): void {
        consumer.apply(ReaderMiddleware).forRoutes('{*splat}');
    }
}
