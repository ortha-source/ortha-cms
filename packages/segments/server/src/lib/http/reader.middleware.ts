import {
    Inject,
    Injectable,
    Logger,
    type NestMiddleware
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SEGMENTS_CONFIG } from '../segments.tokens';
import type { SegmentsPluginConfig } from '../types/segments-config';
import { SegmentCatalogService } from '../application/segment-catalog.service';
import { ReaderStore } from '../application/reader.store';

/**
 * Resolves who is reading, once per request, and puts them in scope for the
 * rest of it.
 *
 * Middleware and not a guard or an interceptor, because the reader has to be in
 * scope *around* everything that follows — that is what `AsyncLocalStorage.run`
 * needs, and only middleware is positioned to arrange it.
 *
 * **It never rejects the request.** A resolver that throws or hangs produces
 * the anonymous reader, who still gets every unrestricted entry: an entitlement
 * source going down should degrade the site to its public content, not take it
 * off the air.
 *
 * It also does nothing at all when no segment exists — the common case for an
 * installation that has the plugin registered and has not used it.
 */
@Injectable()
export class ReaderMiddleware implements NestMiddleware {
    private readonly logger = new Logger(ReaderMiddleware.name);

    constructor(
        @Inject(SEGMENTS_CONFIG)
        private readonly config: SegmentsPluginConfig,
        private readonly catalog: SegmentCatalogService,
        private readonly store: ReaderStore
    ) {}

    async use(
        request: Request,
        response: Response,
        next: NextFunction
    ): Promise<void> {
        if (!this.catalog.configured || !this.config.resolver) {
            next();
            return;
        }

        let tags: readonly string[] = [];
        try {
            tags = await this.config.resolver.resolve(request);
        } catch (error) {
            // Deliberately a warning, not a 500 — see the class note.
            this.logger.warn(
                `Reader resolution failed; serving as anonymous. ${String(error)}`
            );
        }

        this.store.run(
            { tags, segmentIds: this.catalog.resolveTags(tags) },
            () => next()
        );
    }
}
