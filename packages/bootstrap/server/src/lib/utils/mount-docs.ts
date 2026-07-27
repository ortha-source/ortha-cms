import { Logger, type INestApplication } from '@nestjs/common';
import {
    DocumentBuilder,
    SwaggerModule,
    type OpenAPIObject
} from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import type { ServerDocsConfig } from '../types/server-plugin';

/** Security scheme name for the admin API's session cookie. */
const SESSION_SCHEME = 'session';

/** Security scheme name for the external API's bearer token. */
const TOKEN_SCHEME = 'apiToken';

/** The cookie identity issues on login (`CookieService`). */
const SESSION_COOKIE = 'ortha_session';

/**
 * Mount the Scalar API reference over the app's own OpenAPI document.
 *
 * Two references are served, because the server hosts two genuinely different
 * APIs with different callers and different credentials:
 *
 * - **Admin API** (`<path>`) — everything the admin SPA calls (content, media,
 *   workspaces, users, …), authenticated by the `ortha_session` cookie.
 * - **External API** (`<path>/public`) — the `/{prefix}/v1/...` routes an
 *   integrator calls with an `Authorization: Bearer` token.
 *
 * The split is by **route prefix**, not by Nest module: the public content
 * controllers live in the same `ContentModule` as the admin ones, so
 * `SwaggerModule`'s `include` option cannot separate them. One document is
 * generated from the live app and then partitioned.
 *
 * The document is derived from the running app's metadata at boot, so it can
 * never drift from the routes actually mounted — there is no spec file to keep
 * in sync.
 */
export function mountDocs(
    app: INestApplication,
    globalPrefix: string,
    docs: ServerDocsConfig
): void {
    const path = normalizePath(docs.path ?? '/docs');
    const version = docs.version ?? '1.0.0';

    const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder()
            .setTitle('Ortha CMS API')
            .setVersion(version)
            .addCookieAuth(
                SESSION_COOKIE,
                { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE },
                SESSION_SCHEME
            )
            .addBearerAuth({ type: 'http', scheme: 'bearer' }, TOKEN_SCHEME)
            .build()
    );

    // `/{prefix}/v1/` is the external surface; everything else is the admin API.
    const publicPrefix = `/${globalPrefix}/v1/`;
    const adminDoc = partition(
        document,
        (route) => !route.startsWith(publicPrefix),
        SESSION_SCHEME,
        'Ortha CMS Admin API',
        'The session-authenticated API behind the admin UI — content, media, workspaces, users, and settings. Sign in to the admin first; the browser sends the `ortha_session` cookie with each try-it request.'
    );
    const publicDoc = partition(
        document,
        (route) => route.startsWith(publicPrefix),
        TOKEN_SCHEME,
        'Ortha CMS Content API',
        'The external, read-only content API. Authenticate with a workspace API token: `Authorization: Bearer orthacms_…`. The token itself carries the workspace, so no workspace header is needed.'
    );

    // ORDER IS LOAD-BEARING. `app.use(path, …)` matches by **prefix**, so a
    // handler mounted at `/docs` also catches `/docs/public`. The specific
    // routes must be registered first or they are unreachable — the same trap
    // that made a `/api` dev proxy swallow the `/api-tokens` page.
    app.use(`${path}/public/openapi.json`, jsonOf(publicDoc));
    app.use(`${path}/public`, apiReference({ content: publicDoc }));
    app.use(`${path}/openapi.json`, jsonOf(adminDoc));
    app.use(path, apiReference({ content: adminDoc }));

    Logger.log(
        `📚 API reference: ${path} (admin) · ${path}/public (content API)`,
        'Docs'
    );
}

/**
 * Whether the reference should be mounted: explicit config wins, otherwise it
 * is on everywhere **except** production. The page enumerates every route and
 * auth scheme, so exposing it publicly is a decision to make on purpose.
 */
export function docsEnabled(docs: ServerDocsConfig | undefined): boolean {
    if (docs?.enabled !== undefined) return docs.enabled;
    return process.env['NODE_ENV'] !== 'production';
}

/**
 * Narrow a document to the routes matching `keep`, retitle it, and mark every
 * remaining operation as requiring `scheme`.
 *
 * The security stamp is applied here rather than by decorating ~40 controllers
 * with `@ApiSecurity`: the credential is a property of *which API a route
 * belongs to*, which is exactly what this partition already decides. Without it
 * the scheme would be declared but attached to nothing, and the playground's
 * auth box would not apply to any request.
 */
function partition(
    document: OpenAPIObject,
    keep: (route: string) => boolean,
    scheme: string,
    title: string,
    description: string
): OpenAPIObject {
    const paths: OpenAPIObject['paths'] = {};
    for (const [route, item] of Object.entries(document.paths ?? {})) {
        if (!keep(route)) continue;
        paths[route] = item;
        for (const operation of Object.values(item ?? {})) {
            // A path item also holds non-operation keys (`parameters`,
            // `summary`), which are arrays/strings — only stamp real operations.
            if (
                operation &&
                typeof operation === 'object' &&
                !Array.isArray(operation)
            ) {
                (operation as { security?: unknown[] }).security = [
                    { [scheme]: [] }
                ];
            }
        }
    }
    return {
        ...document,
        info: { ...document.info, title, description },
        paths
    };
}

/** An Express handler serving a document as JSON — the raw spec for tooling. */
function jsonOf(document: OpenAPIObject) {
    return (_req: unknown, res: { json: (body: unknown) => void }): void => {
        res.json(document);
    };
}

/** Leading slash, no trailing slash — so `${path}/public` is well-formed. */
function normalizePath(path: string): string {
    const withLeading = path.startsWith('/') ? path : `/${path}`;
    return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}
