import type { ActivityList } from '../../types/activityEvent';
import type { ActivityListParams } from '../activityKeys';

/**
 * The port over the remote activity API — the single seam the admin plugin
 * talks to instead of `apiClient` directly. The activity log is **read-only**
 * (audit events are append-only; there are no mutations), so the port has one
 * method. It returns the admin's mapped `ActivityList` view model (via the
 * `activityMapper` anti-corruption layer), never the wire shape, and normalizes
 * every failure to `ApiError`, so the application hook and presentation stay off
 * the transport. {@link httpActivityGateway} is the HTTP implementation.
 */
export type ActivityGateway = {
    /** Lists one page of audit events via `GET /api/activity`. */
    list(params: ActivityListParams): Promise<ActivityList>;
};
