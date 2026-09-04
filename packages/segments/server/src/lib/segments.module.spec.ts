import type { MiddlewareConsumer } from '@nestjs/common';
import { Router } from 'express';
import { SegmentsModule } from './segments.module';
import { PrincipalMiddleware } from './http/principal.middleware';
import { ReaderMiddleware } from './http/reader.middleware';

/** Records what `configure` asked for, without a Nest application behind it. */
function recordingConsumer() {
    const record = { applied: [] as unknown[], routes: [] as unknown[] };
    const consumer = {
        apply(...middleware: unknown[]) {
            record.applied.push(...middleware);
            return {
                forRoutes(...routes: unknown[]) {
                    record.routes.push(...routes);
                    return consumer;
                },
                exclude() {
                    return this;
                }
            };
        }
    };
    return { record, consumer: consumer as unknown as MiddlewareConsumer };
}

describe('SegmentsModule.configure', () => {
    /**
     * Express 5 parses route patterns with path-to-regexp 8, where the
     * historical bare `*` is a **parse error** rather than a wildcard. Nothing
     * typechecks a route string, so the failure mode is a plugin whose
     * middleware silently never runs — the reader unresolved on every request,
     * which reads as "no entry is restricted" rather than as an error.
     */
    it('registers both middlewares on every route [segments:I-40]', () => {
        const { record, consumer } = recordingConsumer();

        new SegmentsModule().configure(consumer);

        // The principal scope has to wrap the reader's, so `apply` order is
        // part of the claim: both are `AsyncLocalStorage` wrappers and the
        // write path is reached from inside the read path's scope.
        expect(record.applied).toEqual([PrincipalMiddleware, ReaderMiddleware]);
        // One pattern, not a list of routes to keep in step with each protocol
        // the API grows.
        expect(record.routes).toEqual(['{*splat}']);
    });

    it('registers a pattern Express 5 actually matches [segments:I-40]', () => {
        const { record, consumer } = recordingConsumer();
        new SegmentsModule().configure(consumer);
        const pattern = record.routes[0] as string;

        // The real router, so this is path-to-regexp 8 answering rather than a
        // restatement of the string above.
        const router = Router();
        let reached = 0;
        router.use(pattern, (_request, _response, next) => {
            reached += 1;
            next();
        });

        for (const url of [
            '/',
            '/api/v1/content/test_article',
            '/api/v1/graphql',
            '/api/v1/mcp'
        ]) {
            router(
                { method: 'GET', url, headers: {} } as never,
                {} as never,
                (() => undefined) as never
            );
        }

        expect(reached).toBe(4);
        // And the pattern it replaced is not a wildcard here at all — it does
        // not even parse, which is the whole reason the odd-looking spelling is
        // the right one.
        expect(() => Router().use('*', () => undefined)).toThrow();
    });
});
