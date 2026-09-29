import type { ContentTypeRegistry } from '../registry/content-type-registry';
import type { AnyContentType } from '../types/content-type';
import type { WorkspaceGrantsQuery } from '../content-types/queries/workspace-grants.query';
import { isReachable } from '../content-types/queries/content-access';
import { SharedOnlyContentTypeException } from '../content-types/errors/shared-only-content-type.exception';

/**
 * Resolves a model-supplied type name for a copilot **write** (a proposal, its
 * applier, a revision tool): the type must be registered and **owned** by the
 * workspace (ADR-0019, "Explicit per-source grants").
 *
 * An unknown and an unreachable type share one message, so a run cannot
 * enumerate the deployment's other types. A type the workspace reaches only
 * through shared grants is visible to the model already — the read tools list
 * it — so it gets the honest refusal instead: it can be linked, not authored.
 */
export async function resolveOwnedType(
    registry: ContentTypeRegistry,
    grants: WorkspaceGrantsQuery,
    typeName: unknown,
    workspaceId: string
): Promise<AnyContentType> {
    const name = typeof typeName === 'string' ? typeName : '';
    const type = registry.get(name);
    const access = (await grants.access(workspaceId)).get(name);
    if (!type || !isReachable(access)) {
        throw new Error(`Unknown content type "${name}" in this workspace.`);
    }
    if (!access?.own) {
        throw new SharedOnlyContentTypeException(type);
    }
    return type;
}
