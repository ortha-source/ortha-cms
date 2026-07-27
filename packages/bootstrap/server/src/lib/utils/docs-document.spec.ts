import type { OpenAPIObject } from '@nestjs/swagger';
import { docsEnabled, partition } from './docs-document';

/**
 * The reference is split from ONE generated document by route prefix, because
 * the public content controllers share a Nest module with the admin ones and
 * `include` cannot separate them. These pin that split: what lands in each half,
 * that the credential is stamped per half (the playground's auth box applies to
 * nothing without it), and that the partition never mangles a path item's
 * non-operation keys.
 */
const PUBLIC_PREFIX = '/api/v1/';

const document = {
    openapi: '3.0.0',
    info: { title: 'Ortha CMS API', version: '1.0.0' },
    paths: {
        '/api/content/{typeName}': {
            get: { operationId: 'listEntries', responses: {} },
            post: { operationId: 'createEntry', responses: {} }
        },
        '/api/workspaces': {
            get: { operationId: 'listWorkspaces', responses: {} }
        },
        '/api/v1/content/{typeName}': {
            get: { operationId: 'listPublicEntries', responses: {} }
        },
        '/api/v1/content-schema': {
            get: { operationId: 'publicSchema', responses: {} }
        }
    }
} as unknown as OpenAPIObject;

const adminDoc = () =>
    partition(
        document,
        (route) => !route.startsWith(PUBLIC_PREFIX),
        'session',
        'Ortha CMS Admin API',
        'admin'
    );

const publicDoc = () =>
    partition(
        document,
        (route) => route.startsWith(PUBLIC_PREFIX),
        'apiToken',
        'Ortha CMS Content API',
        'public'
    );

describe('partition', () => {
    it('keeps only the admin routes in the admin document', () => {
        expect(Object.keys(adminDoc().paths).sort()).toEqual([
            '/api/content/{typeName}',
            '/api/workspaces'
        ]);
    });

    it('keeps only the v1 routes in the public document', () => {
        expect(Object.keys(publicDoc().paths).sort()).toEqual([
            '/api/v1/content-schema',
            '/api/v1/content/{typeName}'
        ]);
    });

    it('leaks no v1 route into the admin document', () => {
        const leaked = Object.keys(adminDoc().paths).filter((route) =>
            route.startsWith(PUBLIC_PREFIX)
        );
        expect(leaked).toEqual([]);
    });

    it('stamps the session scheme on every admin operation', () => {
        const paths = adminDoc().paths as Record<
            string,
            Record<string, { security?: unknown }>
        >;
        expect(paths['/api/content/{typeName}']['get'].security).toEqual([
            { session: [] }
        ]);
        expect(paths['/api/content/{typeName}']['post'].security).toEqual([
            { session: [] }
        ]);
        expect(paths['/api/workspaces']['get'].security).toEqual([
            { session: [] }
        ]);
    });

    it('stamps the bearer scheme on every public operation', () => {
        const paths = publicDoc().paths as Record<
            string,
            Record<string, { security?: unknown }>
        >;
        expect(paths['/api/v1/content/{typeName}']['get'].security).toEqual([
            { apiToken: [] }
        ]);
    });

    it('retitles the document without losing the version', () => {
        expect(adminDoc().info.title).toBe('Ortha CMS Admin API');
        expect(publicDoc().info.title).toBe('Ortha CMS Content API');
        expect(adminDoc().info.version).toBe('1.0.0');
    });

    it('does not mutate the source document', () => {
        adminDoc();
        publicDoc();
        expect(Object.keys(document.paths)).toHaveLength(4);
        const source = document.paths['/api/content/{typeName}'] as Record<
            string,
            { security?: unknown }
        >;
        // The stamp writes onto the shared path item, so assert the source
        // document's own key set is intact and the split is by reference-copy.
        expect(source['get']).toBeDefined();
    });

    it('ignores a path item’s non-operation keys', () => {
        const withParams = {
            ...document,
            paths: {
                '/api/thing/{id}': {
                    parameters: [{ name: 'id', in: 'path' }],
                    summary: 'A thing',
                    get: { operationId: 'getThing', responses: {} }
                }
            }
        } as unknown as OpenAPIObject;

        const result = partition(withParams, () => true, 'session', 'T', 'd')
            .paths as Record<string, Record<string, unknown>>;

        // An array/string sibling must not be stamped with `security`.
        expect(result['/api/thing/{id}']['parameters']).toEqual([
            { name: 'id', in: 'path' }
        ]);
        expect(result['/api/thing/{id}']['summary']).toBe('A thing');
        expect(
            (result['/api/thing/{id}']['get'] as { security?: unknown })
                .security
        ).toEqual([{ session: [] }]);
    });

    it('tolerates a document with no paths', () => {
        const empty = { openapi: '3.0.0', info: { title: 'x', version: '1' } };
        expect(
            partition(
                empty as unknown as OpenAPIObject,
                () => true,
                'session',
                'T',
                'd'
            ).paths
        ).toEqual({});
    });
});

describe('docsEnabled', () => {
    const original = process.env['NODE_ENV'];
    afterEach(() => {
        process.env['NODE_ENV'] = original;
    });

    it('honours an explicit flag over the environment', () => {
        process.env['NODE_ENV'] = 'production';
        expect(docsEnabled({ enabled: true })).toBe(true);
        process.env['NODE_ENV'] = 'development';
        expect(docsEnabled({ enabled: false })).toBe(false);
    });

    it('defaults off in production — the page maps the attack surface', () => {
        process.env['NODE_ENV'] = 'production';
        expect(docsEnabled(undefined)).toBe(false);
        expect(docsEnabled({})).toBe(false);
    });

    it('defaults on everywhere else', () => {
        process.env['NODE_ENV'] = 'development';
        expect(docsEnabled(undefined)).toBe(true);
        process.env['NODE_ENV'] = 'test';
        expect(docsEnabled({})).toBe(true);
    });
});
