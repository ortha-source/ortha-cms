import type { OpenAPIObject } from '@nestjs/swagger';
import type { ServerDocsConfig } from '../types/server-plugin';

/**
 * The **pure** half of the API-reference setup: how one generated OpenAPI
 * document is split into the admin and external references, and whether the
 * reference should be mounted at all.
 *
 * Kept free of `@scalar/nestjs-api-reference` on purpose — that package ships a
 * bundle the unit-test runner can't load, so importing it here would make this
 * policy untestable. `mount-docs.ts` owns the rendering side-effects; this owns
 * the decisions.
 */

/** Security scheme name for the admin API's session cookie. */
export const SESSION_SCHEME = 'session';

/** Security scheme name for the external API's bearer token. */
export const TOKEN_SCHEME = 'apiToken';

/** The cookie identity issues on login (`CookieService`). */
export const SESSION_COOKIE = 'ortha_session';

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
export function partition(
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

/** Leading slash, no trailing slash — so `${path}/public` is well-formed. */
export function normalizePath(path: string): string {
    const withLeading = path.startsWith('/') ? path : `/${path}`;
    return withLeading.endsWith('/') ? withLeading.slice(0, -1) : withLeading;
}
