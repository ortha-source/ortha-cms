/**
 * Whether one event belongs to one endpoint.
 *
 * The whole subscription model is the intersection of three sets — workspaces,
 * event kinds, content types — evaluated against the event envelope. There is
 * deliberately no expression language: a second query grammar is a second thing
 * to document, a second parser to keep in step, and a second place for a rule
 * to mean something the UI does not.
 */

import { describeEvent } from './event-catalogue';

/** The three filters an endpoint carries, plus whether it is switched on. */
export interface WebhookSubscription {
    /** Skip a disabled endpoint entirely — manual switch or auto-disabled. */
    enabled: boolean;
    /**
     * `true` when the endpoint takes every workspace, including ones created
     * later. Stored explicitly rather than inferred from an empty join table,
     * so fan-out never has to ask "no rows — all, or none?".
     */
    allWorkspaces: boolean;
    /** The workspaces it takes when {@link allWorkspaces} is false. */
    workspaceIds: readonly string[];
    /** The kinds it takes. **Empty means every kind**, including future ones. */
    eventKinds: readonly string[];
    /** The content types it takes. **Empty means every type.** */
    contentTypes: readonly string[];
}

/** The parts of an event the filters are evaluated against. */
export interface WebhookRoutableEvent {
    /** The dotted event kind. */
    kind: string;
    /** The owning workspace, or `null` when the record has none. */
    workspaceId: string | null;
    /** The content type, or `null` for an event that is not about content. */
    contentType: string | null;
}

/**
 * Whether `event` should be delivered to `subscription`.
 *
 * An **empty filter means "everything"** for all three sets, so "all
 * workspaces" survives the creation of a new workspace and "all events"
 * survives a new kind being added to the catalogue. That is the opposite of an
 * API token's workspace bucket, which forbids an empty set — but a token's set
 * is the *bounds of its authority*, where "all" would be a hole, while this one
 * is a *subscription filter*, where "all" is an ordinary answer.
 */
export function matches(
    subscription: WebhookSubscription,
    event: WebhookRoutableEvent
): boolean {
    if (!subscription.enabled) return false;

    if (
        subscription.eventKinds.length > 0 &&
        !subscription.eventKinds.includes(event.kind)
    ) {
        return false;
    }

    const descriptor = describeEvent(event.kind);
    // An unknown kind is not deliverable: it has no descriptor, so there is no
    // way to know whether the filters below even apply to it.
    if (!descriptor) return false;

    if (descriptor.carriesWorkspace && !subscription.allWorkspaces) {
        // A record with no workspace cannot satisfy a filter that names
        // specific ones. It reaches only the endpoints that take them all —
        // which is why the admin says so next to the field.
        if (
            event.workspaceId === null ||
            !subscription.workspaceIds.includes(event.workspaceId)
        ) {
            return false;
        }
    }

    if (
        descriptor.scopedByContentType &&
        subscription.contentTypes.length > 0
    ) {
        if (
            event.contentType === null ||
            !subscription.contentTypes.includes(event.contentType)
        ) {
            return false;
        }
    }

    return true;
}
