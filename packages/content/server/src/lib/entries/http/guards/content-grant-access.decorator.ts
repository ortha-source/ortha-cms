import { SetMetadata } from '@nestjs/common';

/**
 * What a `:typeName` route does with the type, as {@link ContentGrantGuard}
 * reads it (ADR-0019, "Explicit per-source grants"):
 *
 * - `read` — list, open, link to, render: needs the type to be **reachable**
 *   (an own grant or an available shared grant);
 * - `write` — create, edit, publish, delete, restore, import: needs the
 *   **own** grant.
 */
export type ContentGrantAccessMode = 'read' | 'write';

/** Metadata key {@link ContentGrantAccess} stores the mode under. */
export const CONTENT_GRANT_ACCESS = 'orthacms:content-grant-access';

/**
 * Marks a controller or handler as a **read** of its `:typeName` for
 * {@link ContentGrantGuard}. Unmarked routes are treated as writes, so a new
 * route fails closed: forgetting the decorator refuses a shared-only type
 * rather than letting a workspace author records of a type it does not own.
 */
export const ContentGrantAccess = (
    mode: ContentGrantAccessMode
): ClassDecorator & MethodDecorator => SetMetadata(CONTENT_GRANT_ACCESS, mode);
