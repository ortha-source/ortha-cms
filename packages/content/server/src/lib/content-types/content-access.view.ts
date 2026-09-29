import type {
    SerializedContentType,
    SerializedContentTypeSummary
} from '../registry/content-type-registry';
import type { ContentAccess } from './queries/content-access';

/**
 * `access` on a `GET /content-schema` item (ADR-0019, "Explicit per-source
 * grants"): what the open workspace may do with the type. `own` — it may
 * author records; `sharedSources` — the **available** shared workspaces it
 * reads and links records from (an inert grant is not listed).
 */
export type ContentTypeAccessView = ContentAccess;

/** A catalogue item, with `access` when the request named a workspace. */
export interface ContentTypeSummaryWithAccess
    extends SerializedContentTypeSummary {
    /** Present when `X-Workspace-Id` names a workspace the caller belongs to. */
    access?: ContentTypeAccessView;
}

/** One type's full schema, with the open workspace's `access` to it. */
export interface ContentTypeWithAccess extends SerializedContentType {
    /** What the open workspace may do with this type. */
    access: ContentTypeAccessView;
}

/** No grant at all — a type the workspace cannot reach. */
export const NO_ACCESS: ContentTypeAccessView = Object.freeze({
    own: false,
    sharedSources: []
}) as ContentTypeAccessView;
