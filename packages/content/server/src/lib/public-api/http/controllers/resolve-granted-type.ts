import { NotFoundException } from '@nestjs/common';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import type { AnyContentType } from '../../../types/content-type';
import { SharedOnlyContentTypeException } from '../../../content-types/errors/shared-only-content-type.exception';

/**
 * Where this resolver reads a workspace's content grants from.
 *
 * A structural port rather than `WorkspaceGrantsQuery` itself, so a caller that
 * has **already** read the grant sets for the current request can supply them
 * instead of provoking one query per resolved type. `WorkspaceGrantsQuery`
 * satisfies it as-is; the GraphQL endpoint passes a cache over it, because a
 * single document resolves many types and they must all see one consistent
 * grant set anyway.
 */
export interface ContentGrantsSource {
    /** Every content slug `workspaceId` holds an **own** grant for. */
    grantedSlugs(workspaceId: string): Promise<ReadonlySet<string>>;
    /**
     * Every content slug `workspaceId` may **read** — own grants plus types
     * with an available shared grant (ADR-0019, "Explicit per-source grants").
     */
    reachableSlugs(workspaceId: string): Promise<ReadonlySet<string>>;
}

/**
 * What the caller is about to do with the type: `read` needs it
 * **reachable**, `write` needs the **own** grant.
 */
export type GrantedTypeMode = 'read' | 'write';

/**
 * A resolved type plus the workspace's **reachable** grant set. The set is
 * returned alongside because the filter surface and the relation checks need
 * it to prune traversals into types the workspace cannot read — reading it
 * once per request rather than twice. It is the reachable set in both modes:
 * a write may still *link to* a type it can only read.
 */
export interface GrantedType {
    /** The registered, reachable content type the route targets. */
    type: AnyContentType;
    /** Every content slug the workspace may read. */
    granted: ReadonlySet<string>;
}

/**
 * Resolve a `:typeName` for a public-API request: it must be a registered
 * content type **and** one the target workspace can reach through its grants
 * (`workspace_content`). Anything else — unknown name, or a real type this
 * workspace cannot reach — is the same 404, so a token can't enumerate the
 * content model beyond what its workspace actually exposes.
 *
 * `mode: 'write'` additionally needs the **own** grant: a type reachable only
 * through shared grants is readable and linkable here but never authored, and
 * says so with {@link SharedOnlyContentTypeException} (403) — the type is
 * visible, so a 404 would contradict the reads beside it.
 *
 * Grants are enforced here even though the admin's own entries list doesn't
 * check them: the admin caller is a member of the workspace looking at its own
 * CMS, while a token is an external credential, and the grant set is exactly
 * the workspace's declared content surface. `GET /api/v1/content-types` lists
 * that same set, so a consumer never has to guess which names will 404.
 */
export async function resolveGrantedType(
    registry: ContentTypeRegistry,
    grants: ContentGrantsSource,
    typeName: string,
    workspaceId: string,
    mode: GrantedTypeMode = 'read'
): Promise<GrantedType> {
    const type = registry.get(typeName);
    const granted = await grants.reachableSlugs(workspaceId);
    if (!type || !granted.has(typeName)) {
        throw new NotFoundException(`Unknown content type "${typeName}".`);
    }
    if (mode === 'write') {
        const owned = await grants.grantedSlugs(workspaceId);
        if (!owned.has(typeName)) {
            throw new SharedOnlyContentTypeException(type);
        }
    }
    return { type, granted };
}
