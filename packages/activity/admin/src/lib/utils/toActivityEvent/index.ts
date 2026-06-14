import type { ActivityEvent } from '../../types/activityEvent';
import type { ActivityKind } from '../activityKinds';

// The shared wire→model contract for an audit event. The admin can't import the
// server package (separate apps / module boundaries), so this wire type mirrors
// `@ortha-cms/activity-server`'s `ActivityEventView`. Every request function
// that returns events maps through `toActivityEvent`, so shape and mapper live
// together here.

/** An audit event as returned by `GET /api/activity`. */
export type ActivityEventResponse = {
    id: string;
    kind: string;
    subjectType: string;
    subjectId: string;
    actorId: string | null;
    actorEmail: string | null;
    meta: Record<string, unknown> | null;
    at: string;
};

/**
 * Maps an audit event from the wire to the admin's `ActivityEvent` model. A
 * null `actorId` collapses the actor to `null` (a system event); `meta` is
 * passed through typed per kind by the contract; `at` becomes a `Date`.
 */
export function toActivityEvent(dto: ActivityEventResponse): ActivityEvent {
    return {
        id: dto.id,
        kind: dto.kind as ActivityKind,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        actor: dto.actorId
            ? { id: dto.actorId, email: dto.actorEmail }
            : null,
        meta: dto.meta ?? null,
        at: new Date(dto.at)
    };
}
