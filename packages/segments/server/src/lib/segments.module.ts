import {
    Module,
    type DynamicModule,
    type MiddlewareConsumer,
    type NestModule
} from '@nestjs/common';
import {
    contentReadScopeRegistrar,
    entryWriteExtensionRegistrar
} from '@orthacms/content-server';
import { SEGMENTS_CONFIG } from './segments.tokens';
import type { SegmentsPluginConfig } from './types/segments-config';
import { SegmentCatalogService } from './application/segment-catalog.service';
import { SegmentsService } from './application/segments.service';
import { EntryAccessService } from './application/entry-access.service';
import { ReaderStore } from './application/reader.store';
import { PrincipalStore } from './application/principal.store';
import { SegmentReadScope } from './infrastructure/segment-read-scope';
import { EntryAccessWriteExtension } from './infrastructure/entry-access-write-extension';
import { ReaderMiddleware } from './http/reader.middleware';
import { PrincipalMiddleware } from './http/principal.middleware';
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
                PrincipalStore,
                SegmentReadScope,
                // A runtime registration rather than a DI binding: Nest has no
                // multi-provider, so two plugins binding one token would leave
                // the second silently replacing the first — and for a
                // visibility rule that means content quietly becoming visible.
                contentReadScopeRegistrar('segments', SegmentReadScope),
                EntryAccessWriteExtension,
                // The other half, and registered the same way for the same
                // reason: an entry's audiences are written inside the entry's
                // own save transaction and captured by its version, so a save
                // cannot land with its restriction missing and a restore puts
                // back the audiences the restored version had.
                entryWriteExtensionRegistrar(
                    'segments',
                    EntryAccessWriteExtension
                ),
                ReaderMiddleware,
                PrincipalMiddleware
            ],
            exports: [
                SEGMENTS_CONFIG,
                SegmentCatalogService,
                EntryAccessService,
                ReaderStore,
                PrincipalStore
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
        // Both wrap the whole request in an `AsyncLocalStorage` scope, so both
        // have to be middleware. The principal one never short-circuits: the
        // reader resolution is skippable when no segment exists, but a
        // permission check that silently stopped running would be the failure
        // nobody notices.
        consumer
            .apply(PrincipalMiddleware, ReaderMiddleware)
            .forRoutes('{*splat}');
    }
}
