import { Logger, Module, type INestApplication } from '@nestjs/common';
import { setupApiDocs } from './setup-api-docs';
import type { ServerPlugin } from '../types/server-plugin';

/**
 * Where the reference's authentication comes from.
 *
 * The host has no guards, so it has nothing to describe: every security scheme
 * in the document is a plugin's contribution through `ServerPlugin.docs`. That
 * is a claim about what is *absent*, and absence is only observable against a
 * document generated with no contributor at all — which is why the second case
 * below matters more than the first.
 *
 * `apps/server-e2e` serves this document over HTTP and can assert the schemes
 * identity contributes are present; it always boots with identity registered,
 * so it can never show that the host adds nothing of its own.
 */

/**
 * The scanner, stubbed to hand back the `DocumentBuilder` config plus an empty
 * `paths`. It walks a live Nest container, which no unit test has — and the
 * scanned half (paths, DTO schemas) is not what this file is about. The
 * builder's output *is*, because that is the only place a security scheme is
 * written.
 */
jest.mock('@nestjs/swagger', () => ({
    ...jest.requireActual('@nestjs/swagger'),
    SwaggerModule: {
        createDocument: jest.fn((_app: unknown, config: object) => ({
            ...config,
            paths: {}
        }))
    }
}));

@Module({})
class NoopModule {}

/** Captures the document the JSON route would serve. */
function docsHarness() {
    const routes = new Map<string, (req: unknown, res: unknown) => unknown>();
    const app = {
        getHttpAdapter: () => ({
            get: (
                path: string,
                handler: (req: unknown, res: unknown) => unknown
            ) => {
                routes.set(path, handler);
            }
        })
    } as unknown as INestApplication;

    /** The OpenAPI document as `GET /reference/json` would answer it. */
    const served = (): Record<string, unknown> => {
        let body: unknown;
        routes.get('/reference/json')?.(
            {},
            { json: (value: unknown) => (body = value) }
        );
        return body as Record<string, unknown>;
    };

    return { app, served };
}

function plugin(overrides: Partial<ServerPlugin>): ServerPlugin {
    return { name: 'anonymous', module: NoopModule, ...overrides };
}

describe('setupApiDocs — the document’s authentication', () => {
    beforeAll(() => Logger.overrideLogger(false));

    it('publishes exactly the schemes the plugins contributed [bootstrap:I-21]', () => {
        const harness = docsHarness();

        setupApiDocs(
            harness.app,
            [
                plugin({
                    name: 'identity',
                    docs: {
                        securitySchemes: {
                            session: {
                                type: 'apiKey',
                                in: 'cookie',
                                name: 'ortha_session'
                            },
                            apiToken: { type: 'http', scheme: 'bearer' }
                        },
                        defaultSecurity: ['session', 'apiToken']
                    }
                }),
                plugin({ name: 'content' })
            ],
            { enabled: true }
        );

        const document = harness.served();
        const components = document['components'] as {
            securitySchemes?: Record<string, unknown>;
        };
        // `toEqual` on the key set rather than `toContain`: a scheme the host
        // invented would be an extra key, and a subset assertion would not see
        // it.
        expect(Object.keys(components.securitySchemes ?? {})).toEqual([
            'session',
            'apiToken'
        ]);
        expect(document['security']).toEqual([
            { session: [] },
            { apiToken: [] }
        ]);
    });

    it('declares no scheme at all when no plugin describes one [bootstrap:I-21]', () => {
        const harness = docsHarness();

        setupApiDocs(
            harness.app,
            [plugin({ name: 'content' }), plugin({ name: 'media' })],
            { enabled: true }
        );

        const document = harness.served();
        const components = document['components'] as {
            securitySchemes?: Record<string, unknown>;
        };
        // The one that can actually fail: add an `addBearerAuth()` or an
        // `addCookieAuth()` to `setupApiDocs` — the shape every Nest tutorial
        // reaches for — and the reference starts advertising an auth mechanism
        // no guard in the process implements.
        expect(components.securitySchemes).toBeUndefined();
        expect(document['security']).toBeUndefined();
    });

    it('keeps the later plugins’ contributions when one decorate throws [bootstrap:I-11]', () => {
        const harness = docsHarness();
        const logged = jest
            .spyOn(Logger, 'error')
            .mockImplementation(() => undefined);

        setupApiDocs(
            harness.app,
            [
                plugin({
                    name: 'faulty',
                    docs: {
                        decorate: () => {
                            throw new Error('boom');
                        }
                    }
                }),
                plugin({
                    name: 'content',
                    docs: {
                        decorate: (document) => {
                            (document as unknown as Record<string, unknown>)[
                                'x-content-types'
                            ] = ['article'];
                        }
                    }
                })
            ],
            { enabled: true }
        );

        // `create-server.spec.ts` in `apps/server-e2e` pins that the boot
        // survives — the reference still answers 200. What a 200 cannot show is
        // whether the *rest* of the document survived with it: the loop is
        // guarded per plugin precisely so one plugin's failure costs only its
        // own contribution, and a `try` around the whole loop would answer 200
        // just the same with every later plugin's work missing.
        expect(harness.served()['x-content-types']).toEqual(['article']);
        expect(logged).toHaveBeenCalledWith(
            expect.stringContaining('"faulty"'),
            expect.any(String)
        );
    });
});
