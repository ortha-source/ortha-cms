import { NotFoundException } from '@nestjs/common';
import type { WorkspaceGrantsQuery } from '../../../content-types/queries/workspace-grants.query';
import type { ContentTypeRegistry } from '../../../registry/content-type-registry';
import type { AnyContentType } from '../../../types/content-type';

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
    grants: WorkspaceGrantsQuery,
    typeName: string,
    workspaceId: string
): Promise<AnyContentType> {
    const type = registry.get(typeName);
    const granted = await grants.grantedSlugs(workspaceId);
    if (!type || !granted.has(typeName)) {
        throw new NotFoundException(`Unknown content type "${typeName}".`);
    }
    return type;
}
