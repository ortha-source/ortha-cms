import request from 'supertest';
import {
    closeTestApp,
    createTestApp,
    type TestApp
} from '../../support/test-app';
import { resetDb } from '../../support/seed';

/**
 * The GraphiQL playground and — the part that matters — the switch that keeps
 * it off.
 *
 * The page is deliberately unauthenticated (you cannot paste a token into a
 * page you may not load), so the only thing standing between a production
 * deployment and a public page inviting a bearer token is the `docs.enabled`
 * gate. That gate is registration-level: with it off the controller is never
 * registered, so there is no handler to reach.
 *
 * The flag is fixed at boot, so this file boots the tooling-ON app and nothing
 * else — a second app in one file would end the shared per-file connection
 * pool. The OFF case (the production default: no route, API still up) is
 * asserted in `public-graphql-api.spec.ts`, which already boots a default app.
 */
describe('Public GraphQL playground (/api/v1/graphql/playground)', () => {
    describe('with developer tooling on', () => {
        let harness: TestApp;

        beforeAll(async () => {
            harness = await createTestApp({ docsEnabled: true });
            await resetDb();
        });

        afterAll(async () => {
            await closeTestApp(harness);
        });

        it('serves GraphiQL as HTML, without a token', async () => {
            const res = await request(harness.server)
                .get('/api/v1/graphql/playground')
                .expect(200);

            expect(res.headers['content-type']).toMatch(/text\/html/);
            expect(res.text).toMatch(/<!DOCTYPE html>/i);
            expect(res.text).toContain('graphiql');
        });

        it('points the editor at the API endpoint under the global prefix', async () => {
            // Derived from the request path rather than configured, so it stays
            // correct if the host changes its global prefix.
            const res = await request(harness.server)
                .get('/api/v1/graphql/playground')
                .expect(200);

            expect(res.text).toContain('/api/v1/graphql');
        });

        it('loads no external assets, so an air-gapped install works', async () => {
            const res = await request(harness.server)
                .get('/api/v1/graphql/playground')
                .expect(200);
            const tags = res.text.match(/<(?:script|link)\b[^>]*>/gi) ?? [];
            const remote = tags.filter((tag) =>
                /(?:src|href)\s*=\s*["']https?:\/\//i.test(tag)
            );

            expect(remote).toEqual([]);
        });

        it('serves a byte-identical page on a second request', async () => {
            // The bundle is ~9 MB, so it is rendered once and memoised.
            const first = await request(harness.server)
                .get('/api/v1/graphql/playground')
                .expect(200);
            const second = await request(harness.server)
                .get('/api/v1/graphql/playground')
                .expect(200);

            expect(second.text).toEqual(first.text);
        });

        it('serves every casing of the route, from one rendered page', async () => {
            // Express matches the route case-insensitively, so each of these is
            // a 200 deriving a distinct endpoint. They used to be memoised per
            // key, retaining ~17 MB of heap each and never releasing it — an
            // unauthenticated OOM in a few dozen requests. The memo is one slot
            // now; the unit suite pins that, this pins that they all still work.
            for (const url of [
                '/api/v1/graphql/playground',
                '/API/v1/GRAPHQL/playground',
                '/api/v1/GraphQL/playground'
            ]) {
                const res = await request(harness.server).get(url).expect(200);
                expect(res.text).toContain('graphiql');
            }
        });

        it('derives the endpoint through a trailing slash', async () => {
            // `…/playground/` is the same route to Express. Without trimming it
            // the derivation missed and fell back to a hard-coded default,
            // which is wrong on any host with a non-default global prefix.
            const res = await request(harness.server)
                .get('/api/v1/graphql/playground/')
                .expect(200);

            expect(res.text).toContain('"endpoint":"/api/v1/graphql"');
        });
    });
});
