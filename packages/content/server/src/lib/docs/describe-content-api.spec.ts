import { describeContentApi } from './describe-content-api';
import { pascalCase } from './content-schemas';
import type { OpenApiDocument } from '@ortha-cms/bootstrap-server';
import type { SerializedContentType } from '../registry/content-type-registry';

const article: SerializedContentType = {
    name: 'article',
    kind: 'collection',
    label: 'Articles',
    publishable: true,
    paranoid: true,
    i18n: false,
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            validation: { maxLength: 200 },
            admin: { label: 'Title' }
        },
        {
            name: 'author',
            type: 'relation',
            required: false,
            validation: {},
            admin: {},
            relation: { to: 'author', many: false, onDelete: 'restrict' }
        },
        {
            name: 'tags',
            type: 'relation',
            required: false,
            validation: {},
            admin: {},
            relation: { to: 'tag', many: true }
        }
    ]
};

const settings: SerializedContentType = {
    name: 'site_settings',
    kind: 'single',
    label: 'Site settings',
    publishable: false,
    paranoid: false,
    i18n: false,
    fields: [
        {
            name: 'siteName',
            type: 'text',
            required: true,
            validation: {},
            admin: {}
        }
    ]
};

/** The shape the swagger scanner produces before this pass runs. */
function scannedDocument(): OpenApiDocument {
    return {
        paths: {
            '/api/content/{typeName}': {
                get: {
                    parameters: [
                        {
                            name: 'typeName',
                            in: 'path',
                            schema: { type: 'string' }
                        }
                    ],
                    responses: { '200': { description: '' } }
                },
                post: {
                    parameters: [
                        {
                            name: 'typeName',
                            in: 'path',
                            schema: { type: 'string' }
                        }
                    ],
                    responses: { '201': { description: '' } }
                }
            },
            '/api/content/{typeName}/{id}': {
                get: { responses: { '200': { description: '' } } },
                delete: { responses: { '204': { description: '' } } }
            },
            '/api/content/{typeName}/bulk/publish': {
                post: { responses: { '201': { description: '' } } }
            },
            '/api/content-schema/{name}': {
                get: { responses: { '200': { description: '' } } }
            },
            '/api/media/assets': {
                get: { responses: { '200': { description: '' } } }
            }
        }
    };
}

/** The schema (or `$ref`) of an operation's success response. */
function successSchema(
    document: OpenApiDocument,
    route: string,
    method: string
): Record<string, unknown> | undefined {
    const operation = document.paths[route][method] as {
        responses: Record<
            string,
            { content?: Record<string, { schema: Record<string, unknown> }> }
        >;
    };
    const code = Object.keys(operation.responses).find((key) =>
        /^2\d\d$/.test(key)
    );
    return code
        ? operation.responses[code].content?.['application/json']?.schema
        : undefined;
}

describe('describeContentApi', () => {
    it('adds a Values/Entry/ListPage trio per registered type', () => {
        const document = scannedDocument();
        describeContentApi(document, [article, settings]);

        const schemas = document.components?.schemas ?? {};
        for (const name of ['article', 'site_settings']) {
            const base = pascalCase(name);
            expect(schemas[`${base}Values`]).toBeDefined();
            expect(schemas[`${base}Entry`]).toBeDefined();
            expect(schemas[`${base}ListPage`]).toBeDefined();
        }
    });

    it('pascal-cases snake_case type names', () => {
        expect(pascalCase('site_settings')).toBe('SiteSettings');
    });

    it('describes each value field, dropping the join-backed relations', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        const values = document.components?.schemas?.['ArticleValues'] as {
            properties: Record<string, unknown>;
        };
        expect(Object.keys(values.properties)).toEqual(['title', 'author']);
    });

    it('omits `required` on a publishable type — a draft may be incomplete', () => {
        const document = scannedDocument();
        describeContentApi(document, [article, settings]);

        const schemas = document.components?.schemas ?? {};
        expect(
            (schemas['ArticleValues'] as Record<string, unknown>)['required']
        ).toBeUndefined();
        expect(
            (schemas['SiteSettingsValues'] as Record<string, unknown>)[
                'required'
            ]
        ).toEqual(['siteName']);
    });

    it('gives a publishable type the publish envelope, and others none', () => {
        const document = scannedDocument();
        describeContentApi(document, [article, settings]);

        const schemas = document.components?.schemas ?? {};
        const articleProps = (
            schemas['ArticleEntry'] as { properties: Record<string, unknown> }
        ).properties;
        const settingsProps = (
            schemas['SiteSettingsEntry'] as {
                properties: Record<string, unknown>;
            }
        ).properties;
        expect(articleProps['status']).toBeDefined();
        expect(articleProps['publishedAt']).toBeDefined();
        expect(settingsProps['status']).toBeUndefined();
    });

    it('constrains typeName to the registered names', () => {
        const document = scannedDocument();
        describeContentApi(document, [article, settings]);

        const parameters = (
            document.paths['/api/content/{typeName}']['get'] as {
                parameters: { name: string; schema: Record<string, unknown> }[];
            }
        ).parameters;
        expect(parameters[0].schema['enum']).toEqual([
            'article',
            'site_settings'
        ]);
    });

    it('unions the per-type schemas onto the generic list and read routes', () => {
        const document = scannedDocument();
        describeContentApi(document, [article, settings]);

        expect(
            successSchema(document, '/api/content/{typeName}', 'get')
        ).toEqual({
            oneOf: [
                { $ref: '#/components/schemas/ArticleListPage' },
                { $ref: '#/components/schemas/SiteSettingsListPage' }
            ]
        });
        expect(
            successSchema(document, '/api/content/{typeName}/{id}', 'get')
        ).toEqual({
            oneOf: [
                { $ref: '#/components/schemas/ArticleEntry' },
                { $ref: '#/components/schemas/SiteSettingsEntry' }
            ]
        });
    });

    it('needs no union for a single registered type', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        expect(
            successSchema(document, '/api/content/{typeName}', 'get')
        ).toEqual({
            $ref: '#/components/schemas/ArticleListPage'
        });
    });

    it('writes onto the status code the scanner emitted, 201 included', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        const post = document.paths['/api/content/{typeName}']['post'] as {
            responses: Record<string, unknown>;
        };
        expect(Object.keys(post.responses)).toContain('201');
        expect(post.responses['200']).toBeUndefined();
    });

    it('leaves a 204 without a body', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        expect(
            successSchema(document, '/api/content/{typeName}/{id}', 'delete')
        ).toBeUndefined();
    });

    it('documents 404 everywhere and 422 only on the validated writes', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        const list = document.paths['/api/content/{typeName}']['get'] as {
            responses: Record<string, unknown>;
        };
        const create = document.paths['/api/content/{typeName}']['post'] as {
            responses: Record<string, unknown>;
        };
        expect(list.responses['404']).toBeDefined();
        expect(list.responses['422']).toBeUndefined();
        expect(create.responses['422']).toBeDefined();
    });

    it('describes the content-schema reads', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        expect(
            successSchema(document, '/api/content-schema/{name}', 'get')
        ).toEqual({ $ref: '#/components/schemas/ContentTypeSchema' });
    });

    it('touches no route it does not own', () => {
        const document = scannedDocument();
        describeContentApi(document, [article]);

        expect(document.paths['/api/media/assets']['get']).toEqual({
            responses: { '200': { description: '' } }
        });
    });

    it('adds no entry schema when nothing is registered', () => {
        const document = scannedDocument();
        describeContentApi(document, []);

        expect(
            successSchema(document, '/api/content/{typeName}', 'get')
        ).toBeUndefined();
        expect(document.components?.schemas?.['RelationRef']).toBeDefined();
    });
});
