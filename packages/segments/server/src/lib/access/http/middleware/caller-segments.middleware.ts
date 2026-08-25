import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { type SegmentResolver } from '@orthacms/segments-domain';
import { InjectSegmentsConfig } from '../../../segments.tokens';
import type { SegmentsPluginConfig } from '../../../types/segments-config';
import {
    ANONYMOUS_CALLER,
    CallerSegmentsStore
} from '../../application/caller-segments.store';
import { SegmentCatalogService } from '../../application/segment-catalog.service';

/**
 * Resolves the reader's segments once per request and makes them visible to
 * every read below.
 *
 * Middleware rather than a guard or an interceptor for one reason: it has to
 * wrap the **rest of the request** in the `AsyncLocalStorage` context, and only
 * middleware sits early enough and hands us a `next()` to run inside it.
 *
 * Two things it deliberately does not do:
 *
 * **It never rejects.** A resolver that throws, or a credential that will not
 * verify, produces the anonymous reader — unrestricted content still serves,
 * restricted content does not. Turning an unreachable billing system into a 500
 * would take a site down over content most of its readers can see anyway.
 *
 * **It skips the work when nothing is configured.** With no active segment
 * type the resolver is not called at all: an installation that has not adopted
 * segmentation should not pay for a token decode on every request.
 */
@Injectable()
export class CallerSegmentsMiddleware implements NestMiddleware {
    private readonly logger = new Logger(CallerSegmentsMiddleware.name);

    constructor(
        private readonly store: CallerSegmentsStore,
        private readonly catalog: SegmentCatalogService,
        @InjectSegmentsConfig()
        private readonly config: SegmentsPluginConfig
    ) {}

    use(request: Request, response: Response, next: NextFunction): void {
        if (!this.catalog.hasActiveTypes()) {
            next();
            return;
        }

        const resolver = this.config.resolver as
            | SegmentResolver<Request>
            | undefined;
        if (!resolver) {
            this.store.run(ANONYMOUS_CALLER, next);
            return;
        }

        void resolver
            .resolve(request)
            .catch((error: unknown) => {
                // Debug rather than warn: an anonymous reader is the normal
                // case for most requests, and a resolver that declines to
                // answer is not an error the operator needs woken for.
                this.logger.debug(
                    `Segment resolution failed; continuing anonymously: ${String(error)}`
                );
                return new Set<string>();
            })
            .then((tags) => {
                const caller = {
                    tags,
                    byType: this.catalog.resolveTags(tags)
                };
                this.store.run(caller, next);
            });
    }
}
