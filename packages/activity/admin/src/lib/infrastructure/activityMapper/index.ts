import type { ActivityEvent } from '../../types/activityEvent';
import type { ActivityKind } from '../../types/activityKinds';

// The wire→view anti-corruption layer for an audit event. The admin can't
// import the server package (separate apps / module boundaries), so this wire
// type mirrors `@orthacms/activity-server`'s `ActivityEventView`. The HTTP
// gateway (`httpActivityGateway`) maps every event it fetches through
// `toActivityEvent`, so the wire shape and its mapper live together here and the
// rest of the plugin only ever sees the admin's `ActivityEvent` view model.

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
 *
 * `at` is **not** coerced when the wire value doesn't parse: substituting an
 * instant (epoch, "now") for a malformed audit timestamp would be a mapper
 * fallback that silently rewrites the record, which is precisely what an audit
 * trail must never do. The resulting `Invalid Date` is therefore part of this
 * layer's contract, and the presentation renders it through
 * `activityDateTime` / `intl.formatDate`, both of which are total — see that
 * helper for why an unguarded `toISOString()` used to blank the whole SPA.
 */
export function toActivityEvent(dto: ActivityEventResponse): ActivityEvent {
    return {
        id: dto.id,
        kind: dto.kind as ActivityKind,
        subjectType: dto.subjectType,
        subjectId: dto.subjectId,
        actor: dto.actorId ? { id: dto.actorId, email: dto.actorEmail } : null,
        meta: dto.meta ?? null,
        at: new Date(dto.at)
    };
}
