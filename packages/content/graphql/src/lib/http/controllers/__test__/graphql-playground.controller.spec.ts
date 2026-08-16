import type { Request } from 'express';
import { GraphqlPlaygroundController } from '../graphql-playground.controller';

/**
 * The playground is ~9 MB of self-contained HTML, served on a route that takes
 * **no credential** — so what it retains between requests is a security
 * property, not a performance one.
 */
describe('GraphqlPlaygroundController', () => {
    const controller = () => new GraphqlPlaygroundController();
    const get = (url: string, on = controller()) =>
        on.playground({ originalUrl: url } as Request);

    it('points the editor at the endpoint the page was served from', () => {
        // Derived rather than configured: the plugin does not know the host's
        // global prefix, and the page and the endpoint are siblings by
        // construction.
        expect(get('/custom/v1/graphql/playground')).toContain(
            '"endpoint":"/custom/v1/graphql"'
        );
    });

    it('derives the endpoint through a trailing slash', () => {
        // Express serves `…/playground/` from the same route. Without trimming
        // it the derivation missed and fell back to a hard-coded default, which
        // is wrong on any host with a non-default prefix.
        expect(get('/custom/v1/graphql/playground/')).toContain(
            '"endpoint":"/custom/v1/graphql"'
        );
    });

    it('ignores a query string when deriving the endpoint', () => {
        expect(get('/api/v1/graphql/playground?theme=dark')).toContain(
            '"endpoint":"/api/v1/graphql"'
        );
    });

    it('reuses the rendered page for the same endpoint', () => {
        const on = controller();

        expect(get('/api/v1/graphql/playground', on)).toBe(
            get('/api/v1/graphql/playground', on)
        );
    });

    it('holds one page, whatever spelling the caller asks for', () => {
        // Express matches the route case-insensitively, so `graphql` alone has
        // 2^7 spellings that all 200 and all derive a distinct endpoint.
        // Memoising per key retained ~17 MB of heap each and never released it
        // — measured, sixteen spellings grew RSS by 269 MB — which is an
        // unauthenticated out-of-memory in a few dozen requests.
        const on = controller();
        for (const url of [
            '/api/v1/graphql/playground',
            '/API/v1/GRAPHQL/playground',
            '/api/v1/GraphQL/playground',
            '/api/v1/gRaPhQl/playground'
        ]) {
            expect(get(url, on)).toContain('graphiql');
        }

        const held = (on as unknown as Record<string, unknown>)['rendered'];

        expect(held).toEqual({
            endpoint: '/api/v1/gRaPhQl',
            html: expect.any(String)
        });
    });
});
