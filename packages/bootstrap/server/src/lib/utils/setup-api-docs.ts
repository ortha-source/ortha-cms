import { Logger, type INestApplication } from '@nestjs/common';
import {
    DocumentBuilder,
    SwaggerModule,
    type OpenAPIObject
} from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { ApiDocsOptions } from '../types/api-docs';
import type { ServerPlugin } from '../types/server-plugin';

/** The `addSecurity` payload type, without deep-importing `@nestjs/swagger`. */
type SecurityScheme = Parameters<DocumentBuilder['addSecurity']>[1];

/** A request handler the http adapter accepts, whatever its flavour. */
type Handler = (req: unknown, res: unknown) => unknown;

/** The one response capability the JSON route needs. */
interface JsonResponse {
    json(body: unknown): unknown;
}

const DEFAULT_PATH = '/reference';
const DEFAULT_JSON_PATH = '/reference/json';
const DEFAULT_TITLE = 'Ortha CMS API';
const DEFAULT_VERSION = '1.0.0';

/** Ensures a mount path has exactly one leading slash. */
function normalizePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
}

/**
 * Groups every operation under its **resource** — the first route segment after
 * the global prefix (`/api/content/post` → `content`).
 *
 * The alternative, `autoTagControllers`, tags by controller class name; this
 * codebase deliberately runs one controller per use case, so that yields ~50
 * one-operation groups. Grouping by resource gives the reference a sidebar that
 * matches how the API is actually laid out.
 */
function tagByResource(document: OpenAPIObject, globalPrefix: string): void {
    const prefix = globalPrefix.replace(/^\/|\/$/g, '');
    const tags = new Set<string>();

    for (const [route, item] of Object.entries(document.paths)) {
        const segments = route.split('/').filter(Boolean);
        const resource = segments[0] === prefix ? segments[1] : segments[0];
        if (!resource) {
            continue;
        }
        tags.add(resource);
        for (const operation of Object.values(
            item as Record<string, unknown>
        )) {
            if (operation && typeof operation === 'object') {
                (operation as { tags?: string[] }).tags = [resource];
            }
        }
    }

    Object.assign(document, {
        tags: [...tags].sort().map((name) => ({ name }))
    });
}

/**
 * Builds the OpenAPI document for the running app and mounts the Scalar API
 * reference on it.
 *
 * The document is generated from the plugin-contributed controllers and their
 * DTOs — the `@ApiProperty` metadata each DTO carries is what makes the schemas
 * useful — and plugins describe their own auth through
 * {@link ServerPlugin.docs}. Both routes are registered on the http adapter
 * rather than the Nest router, so they sit **outside** the global `api` prefix
 * and outside every guard.
 *
 * Returns the mounted paths, or `null` when docs are disabled.
 */
export function setupApiDocs(
    app: INestApplication,
    plugins: ServerPlugin[],
    options: ApiDocsOptions = {},
    globalPrefix = 'api'
): { path: string; jsonPath: string } | null {
    const {
        enabled = process.env['NODE_ENV'] !== 'production',
        path = DEFAULT_PATH,
        jsonPath = DEFAULT_JSON_PATH,
        title = DEFAULT_TITLE,
        description,
        version = DEFAULT_VERSION,
        cdn
    } = options;

    if (!enabled) {
        return null;
    }

    const builder = new DocumentBuilder()
        .setTitle(title)
        .setVersion(version);

    if (description) {
        builder.setDescription(description);
    }

    for (const plugin of plugins) {
        for (const [name, scheme] of Object.entries(
            plugin.docs?.securitySchemes ?? {}
        )) {
            builder.addSecurity(name, scheme as SecurityScheme);
        }
        for (const name of plugin.docs?.defaultSecurity ?? []) {
            builder.addSecurityRequirements(name);
        }
    }

    // `createDocument` keeps the global prefix in the paths, so the document
    // describes the URLs a client actually calls (`/api/...`).
    const document = SwaggerModule.createDocument(app, builder.build(), {
        autoTagControllers: false
    });
    tagByResource(document, globalPrefix);

    const uiPath = normalizePath(path);
    const documentPath = normalizePath(jsonPath);
    const httpAdapter = app.getHttpAdapter();

    // The JSON route is registered first: it must win over the UI mount for
    // the (default) case where it lives underneath it.
    const sendDocument: Handler = (_req, res) =>
        (res as JsonResponse).json(document);
    httpAdapter.get(documentPath, sendDocument);

    httpAdapter.get(
        uiPath,
        apiReference({
            content: document,
            pageTitle: title,
            ...(cdn ? { cdn } : {})
        }) as Handler
    );

    Logger.log(`📘 API reference: ${uiPath} (OpenAPI JSON: ${documentPath})`);

    return { path: uiPath, jsonPath: documentPath };
}
