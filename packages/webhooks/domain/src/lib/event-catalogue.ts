/**
 * The catalogue of event kinds a webhook endpoint may subscribe to.
 *
 * It is **data, not a `switch`**: the admin's multi-select, the DTO validation,
 * the `GET /api/webhook-events` response and the documentation all read this
 * one array, so adding a kind is one entry rather than four edits that drift.
 */

/** The groups the admin UI renders as sections in its event picker. */
export const WEBHOOK_EVENT_GROUPS = ['content', 'system'] as const;

/** One of {@link WEBHOOK_EVENT_GROUPS}. */
export type WebhookEventGroup = (typeof WEBHOOK_EVENT_GROUPS)[number];

/** What one subscribable event kind is, and how the filters apply to it. */
export interface WebhookEventDescriptor {
    /** The dotted kind, matching the domain event on the outbox. */
    readonly kind: string;
    /** Which section of the picker it belongs to. */
    readonly group: WebhookEventGroup;
    /** Default English label; the admin translates by `kind`. */
    readonly label: string;
    /**
     * Whether the endpoint's content-type filter applies to this kind.
     *
     * Separate from {@link carriesWorkspace} because "not tied to a content
     * type" and "not tied to a workspace" are different facts. Conflating them
     * either drops deliveries an endpoint asked for or sends ones it did not.
     */
    readonly scopedByContentType: boolean;
    /** Whether the endpoint's workspace filter applies to this kind. */
    readonly carriesWorkspace: boolean;
}

/**
 * Every subscribable kind in v1 — the entry lifecycle, plus the synthetic
 * `ping` the "Send test" button produces.
 *
 * Media, transfer and account events already exist on the outbox and are
 * deliberately **not** here: media events do not yet carry their workspace on
 * the payload (the same gap this release closes for entries), and account or
 * workspace events are administrative audit rather than content changes, with a
 * different audience and different sensitivity.
 */
export const WEBHOOK_EVENTS: readonly WebhookEventDescriptor[] = [
    {
        kind: 'entry.created',
        group: 'content',
        label: 'Entry created',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        kind: 'entry.updated',
        group: 'content',
        label: 'Entry updated',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        kind: 'entry.published',
        group: 'content',
        label: 'Entry published',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        kind: 'entry.unpublished',
        group: 'content',
        label: 'Entry unpublished',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        kind: 'entry.deleted',
        group: 'content',
        label: 'Entry deleted',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        kind: 'entry.restored',
        group: 'content',
        label: 'Entry restored',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        kind: 'entry.purged',
        group: 'content',
        label: 'Entry purged',
        scopedByContentType: true,
        carriesWorkspace: true
    },
    {
        // Addressed to one endpoint by hand, so neither filter can apply: it is
        // never queued and never fanned out.
        kind: 'ping',
        group: 'system',
        label: 'Test ping',
        scopedByContentType: false,
        carriesWorkspace: false
    }
] as const;

/** Every kind in the catalogue — what a subscription may name. */
export const WEBHOOK_EVENT_KINDS: readonly string[] = WEBHOOK_EVENTS.map(
    (event) => event.kind
);

/** The kinds that actually come off the outbox, i.e. everything but `ping`. */
export const SUBSCRIBABLE_OUTBOX_KINDS: readonly string[] =
    WEBHOOK_EVENTS.filter((event) => event.kind !== 'ping').map(
        (event) => event.kind
    );

/** The descriptor for `kind`, or `undefined` when it is not in the catalogue. */
export function describeEvent(
    kind: string
): WebhookEventDescriptor | undefined {
    return WEBHOOK_EVENTS.find((event) => event.kind === kind);
}

/** Whether `kind` is something an endpoint may subscribe to at all. */
export function isKnownEventKind(kind: string): boolean {
    return describeEvent(kind) !== undefined;
}
