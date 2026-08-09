import { NotFoundException } from '@nestjs/common';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import type { AnyContentType } from '../../../types/content-type';

/**
 * Where this resolver reads a workspace's content grants from.
 *
 * A structural port rather than `WorkspaceGrantsQuery` itself, so a caller that
 * has **already** read the grant set for the current request can supply it
 * instead of provoking one query per resolved type. `WorkspaceGrantsQuery`
 * satisfies it as-is; the GraphQL endpoint passes a cache over it, because a
 * single document resolves many types and they must all see one consistent
 * grant set anyway.
 */
export interface ContentGrantsSource {
    /** Every content slug granted to `workspaceId`. */
    grantedSlugs(workspaceId: string): Promise<ReadonlySet<string>>;
}

/**
 * A resolved type plus the workspace's full grant set. The grants are returned
 * alongside because the filter surface needs them to prune relation traversals
 * into ungranted types — reading them once per request rather than twice.
 */
export interface GrantedType {
    /** The registered, granted content type the route targets. */
    type: AnyContentType;
    /** Every content slug the workspace was granted. */
    granted: ReadonlySet<string>;
}

/**
 * Resolve a `:typeName` for a public-API request: it must be a registered
 * content type **and** one the target workspace has been granted
 * (`workspace_content`). Anything else — unknown name, or a real type this
 * workspace was never granted — is the same 404, so a token can't enumerate
 * the content model beyond what its workspace actually exposes.
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
    workspaceId: string
): Promise<GrantedType> {
    const type = registry.get(typeName);
    const granted = await grants.grantedSlugs(workspaceId);
    if (!type || !granted.has(typeName)) {
        throw new NotFoundException(`Unknown content type "${typeName}".`);
    }
    return { type, granted };
}
