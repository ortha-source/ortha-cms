import { Controller, Get, Module, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
    SEGMENT_KIND,
    SEGMENT_TYPE_MANAGED_BY,
    SEGMENT_TYPE_STATE,
    staticSegmentResolver,
    type Segment,
    type SegmentType
} from '@orthacms/segments-domain';
import { SEGMENTS_CONFIG } from '../../../segments.tokens';
import { CallerSegmentsStore } from '../../application/caller-segments.store';
import { SegmentCatalogService } from '../../application/segment-catalog.service';
import { CallerSegmentsMiddleware } from './caller-segments.middleware';

/**
 * Boots a real Nest app through the same `configure()` the plugin's module
 * uses.
 *
 * This is not a formality. The middleware's route pattern is interpreted by
 * Express 5's path-to-regexp 8, where the historical `'*'` is a parse error
 * rather than a wildcard — a mistake no typecheck catches and that would
 * surface as the entire plugin silently never running. The other half it pins
 * is the `AsyncLocalStorage` wrapping: a middleware that resolves the reader but
 * calls `next()` outside the store leaves every read below it anonymous.
 */

const ORG: SegmentType = {
    id: 'type-org',
    key: 'org',
    label: 'Organisation',
    cardinality: 'low',
    slot: 1,
    state: SEGMENT_TYPE_STATE.Active,
    managedBy: SEGMENT_TYPE_MANAGED_BY.Ui
};

const ACME: Segment = {
    id: 'seg-acme',
    typeKey: 'org',
    key: 'acme',
    label: 'Acme',
    kind: SEGMENT_KIND.Set,
    tags: ['org:acme']
};

/** A catalogue stub — the real one needs a database, which this test does not. */
class StubCatalog {
    types: SegmentType[] = [ORG];
    segments: Segment[] = [ACME];

    snapshot() {
        return { types: this.types, segments: this.segments, version: 1 };
    }

    hasActiveTypes(): boolean {
        return this.types.some(
            (type) => type.state === SEGMENT_TYPE_STATE.Active
        );
    }

    resolveTags(tags: Iterable<string>) {
        const wanted = new Set(tags);
        const ids = this.segments
            .filter((segment) => segment.tags.some((tag) => wanted.has(tag)))
            .map((segment) => segment.id);
        return ids.length ? new Map([['org', ids]]) : new Map();
    }
}

/** Reports what the store held while the handler ran. */
@Controller()
class ProbeController {
    constructor(private readonly store: CallerSegmentsStore) {}

    @Get('probe')
    read() {
        const caller = this.store.current();
        return {
            resolved: caller !== undefined,
            org: caller?.byType.get('org') ?? [],
            tags: [...(caller?.tags ?? [])]
        };
    }
}

async function bootstrap(options: {
    tags?: string[];
    withResolver?: boolean;
    catalog?: StubCatalog;
}): Promise<{ app: INestApplication; catalog: StubCatalog }> {
    const catalog = options.catalog ?? new StubCatalog();

    @Module({
        controllers: [ProbeController],
        providers: [
            CallerSegmentsStore,
            CallerSegmentsMiddleware,
            { provide: SegmentCatalogService, useValue: catalog },
            {
                provide: SEGMENTS_CONFIG,
                useValue: {
                    resolver:
                        options.withResolver === false
                            ? undefined
                            : staticSegmentResolver(options.tags ?? [])
                }
            }
        ]
    })
    class ProbeModule {
        configure(consumer: {
            apply: (m: unknown) => { forRoutes: (r: string) => void };
        }) {
            consumer.apply(CallerSegmentsMiddleware).forRoutes('{*splat}');
        }
    }

    const moduleRef = await Test.createTestingModule({
        imports: [ProbeModule]
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();
    return { app, catalog };
}

describe('CallerSegmentsMiddleware', () => {
    let app: INestApplication | undefined;

    afterEach(async () => {
        await app?.close();
        app = undefined;
    });

    it('runs on every route under the wildcard Express 5 accepts', async () => {
        const booted = await bootstrap({ tags: ['org:acme'] });
        app = booted.app;
        const response = await request(app.getHttpServer()).get('/probe');
        expect(response.status).toBe(200);
        expect(response.body.resolved).toBe(true);
    });

    it('makes the resolved segments visible to the handler', async () => {
        const booted = await bootstrap({ tags: ['org:acme'] });
        app = booted.app;
        const response = await request(app.getHttpServer()).get('/probe');
        expect(response.body.org).toEqual(['seg-acme']);
        expect(response.body.tags).toEqual(['org:acme']);
    });

    it('resolves a reader with no matching tag to no segments', async () => {
        const booted = await bootstrap({ tags: ['org:nobody'] });
        app = booted.app;
        const response = await request(app.getHttpServer()).get('/probe');
        expect(response.body.resolved).toBe(true);
        expect(response.body.org).toEqual([]);
    });

    it('still establishes an anonymous context with no resolver configured', async () => {
        const booted = await bootstrap({ withResolver: false });
        app = booted.app;
        const response = await request(app.getHttpServer()).get('/probe');
        expect(response.body.resolved).toBe(true);
        expect(response.body.org).toEqual([]);
    });

    it('skips the work entirely when no segment type is active', async () => {
        const catalog = new StubCatalog();
        catalog.types = [{ ...ORG, state: SEGMENT_TYPE_STATE.Draining }];
        const booted = await bootstrap({ tags: ['org:acme'], catalog });
        app = booted.app;
        const response = await request(app.getHttpServer()).get('/probe');
        // No context at all — the read scope reads that as anonymous, and an
        // unconfigured installation pays nothing per request.
        expect(response.body.resolved).toBe(false);
    });

    it('serves the request anonymously when the resolver throws', async () => {
        const catalog = new StubCatalog();

        @Module({
            controllers: [ProbeController],
            providers: [
                CallerSegmentsStore,
                CallerSegmentsMiddleware,
                { provide: SegmentCatalogService, useValue: catalog },
                {
                    provide: SEGMENTS_CONFIG,
                    useValue: {
                        resolver: {
                            resolve: () =>
                                Promise.reject(new Error('billing is down'))
                        }
                    }
                }
            ]
        })
        class FailingModule {
            configure(consumer: {
                apply: (m: unknown) => { forRoutes: (r: string) => void };
            }) {
                consumer.apply(CallerSegmentsMiddleware).forRoutes('{*splat}');
            }
        }

        const moduleRef = await Test.createTestingModule({
            imports: [FailingModule]
        }).compile();
        app = moduleRef.createNestApplication();
        await app.init();

        const response = await request(app.getHttpServer()).get('/probe');
        // An unreachable entitlement source must degrade to "public content
        // only", never to a 500 that takes the site down.
        expect(response.status).toBe(200);
        expect(response.body.resolved).toBe(true);
        expect(response.body.org).toEqual([]);
    });
});
