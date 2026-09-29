import { ForbiddenException } from '@nestjs/common';
import type { AnyContentType } from '../../types/content-type';

/**
 * A **write** to a content type the workspace can see but does not own
 * (ADR-0019, "Explicit per-source grants"): it holds only shared grants of the
 * type, so it may read and link the shared workspaces' records but never
 * author its own. A 403 rather than the unknown-type 404, because the type is
 * visible to the caller — hiding it would contradict every read beside it.
 *
 * Only ever thrown for a **reachable** type, so it discloses nothing a read
 * would not; an unknown or unreachable type keeps its plain 404.
 */
export class SharedOnlyContentTypeException extends ForbiddenException {
    constructor(type: Pick<AnyContentType, 'name' | 'label'>) {
        super(sharedOnlyMessage(type));
    }
}

/** The refusal's text, for surfaces that raise their own error type. */
export function sharedOnlyMessage(
    type: Pick<AnyContentType, 'name' | 'label'>
): string {
    return `This workspace can only use "${type.label || type.name}" records from shared workspaces; it cannot create its own.`;
}
