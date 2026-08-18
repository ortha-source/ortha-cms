import type { DomainEvent } from '@ortha-cms/database';
import { IDENTITY_ACTIVITY_KINDS } from '@ortha-cms/identity-server';

/**
 * The values one audit row needs, derived purely from a {@link DomainEvent}.
 * Mirrors an `activity_events` insert: `id` is the **event's** id (so a
 * re-delivered event maps to the same row — the subscriber inserts it
 * `ON CONFLICT DO NOTHING` for idempotency), and `at` is the event's domain
 * time.
 */
export interface AuditRow {
    /** Primary key = the source event id, making redelivery idempotent. */
    id: string;
    /** The `user.*` / `workspace.*` audit kind (see the mapping table below). */
    kind: string;
    /** The kind of entity acted upon (`'user'` / `'workspace'`). */
    subjectType: string;
    /** The acted-upon entity's id (text). */
    subjectId: string;
    /** Who performed it, or `null` for a system-initiated event. */
    actorId: string | null;
    /** Frozen actor email snapshot, or `null`. */
    actorEmail: string | null;
    /** Open per-kind payload, or `null` when the kind carries none. */
    meta: Record<string, unknown> | null;
    /** Logical event time (the event's `occurredAt`). */
    at: Date;
}

/** What a per-kind mapper decides — the audit-specific bits of the row. */
interface AuditFacet {
    kind: string;
    subjectType: string;
    subjectId: string;
    meta: Record<string, unknown> | null;
}

/**
 * The **user.\*** audit kinds owned by the users context
 * (`USER_ACTIVITY_KINDS` in `@ortha-cms/users-server`). Duplicated here as
 * literals rather than imported, so the audit sink stays decoupled from every
 * producer (activity depends on identity only); the parity unit test pins these
 * strings against the exact rows the old in-band recorder wrote.
 */
const USER_AUDIT_KINDS = {
    INVITED: 'user.invited',
    INVITE_RESENT: 'user.invite_resent',
    /**
     * An admin minted a one-time password-reset link for a member. Recorded at
     * **issue** time, not at redemption: handing someone a link that can take
     * over an account is an administrative act in its own right, and it needs
     * to be attributed to the admin who performed it even if the link is never
     * used. The redemption shows up separately as `user.password_changed`,
     * actored by the account holder.
     */
    PASSWORD_RESET_ISSUED: 'user.password_reset_issued',
    INVITE_REVOKED: 'user.invite_revoked',
    PROFILE_UPDATED: 'user.profile_updated',
    ROLE_CHANGED: 'user.role_changed',
    SUSPENDED: 'user.suspended',
    REACTIVATED: 'user.reactivated',
    /**
     * A credential rotation. Unlike the kinds above this one has no in-band
     * predecessor to stay bug-compatible with — `user.password_changed` was
     * raised on the outbox by identity's aggregate but nothing mapped it, so
     * the log recorded nothing at all when a password changed
     * (BUG-identity-server-05).
     */
    PASSWORD_CHANGED: 'user.password_changed',
    /**
     * An invited account accepted its invite: set a first credential and went
     * `pending` → `active`. Identity's aggregate has raised `user.activated`
     * since the invite flow landed and `accept-invite.use-case.ts` appends it,
     * but nothing mapped it — so the trail showed the invite, then a sign-in,
     * and never the moment the account became usable. Verified against a live
     * stack under ORT-42: one `POST /auth/invite/accept` appended both
     * `user.activated` and `auth.signed_in`, both were stamped dispatched, and
     * only the sign-in produced a row.
     */
    ACTIVATED: 'user.activated'
} as const;

/**
 * The **media.\*** audit kinds. Media's aggregates have raised these on the
 * outbox since the asset/folder aggregates were introduced — their own comment
 * calls the outbox "the post-commit audit + blob-GC seam" — but nothing
 * consumed them, so **every** media write was unaudited: uploading, renaming,
 * re-foldering, duplicating and deleting an asset, and creating, renaming and
 * deleting a folder, all left the log completely silent. Verified live under
 * ORT-42 (eight write paths, eight dispatched outbox rows, zero audit rows).
 *
 * The event kind is the audit kind: unlike `member.*` → `user.*` there is no
 * pre-existing audit catalogue for media to stay bug-compatible with, so
 * inventing a second set of names would only add a mapping to remember.
 */
const MEDIA_AUDIT_KINDS = {
    ASSET_UPLOADED: 'media.asset.uploaded',
    ASSET_UPDATED: 'media.asset.updated',
    ASSET_MOVED: 'media.asset.moved',
    ASSET_DELETED: 'media.asset.deleted',
    FOLDER_CREATED: 'media.folder.created',
    FOLDER_RENAMED: 'media.folder.renamed',
    FOLDER_DELETED: 'media.folder.deleted'
} as const;

/** Reads a payload field as a string (or `null` when absent/nullish). */
function nullableString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

/** A `'user'`-subject facet whose subject is the event's aggregate. */
function userSubject(
    event: DomainEvent,
    kind: string,
    meta: Record<string, unknown> | null
): AuditFacet {
    return { kind, subjectType: 'user', subjectId: event.aggregateId, meta };
}

/** A `'workspace'`-subject facet whose subject is the event's aggregate. */
function workspaceSubject(
    event: DomainEvent,
    meta: Record<string, unknown> | null
): AuditFacet {
    // Workspace audit kinds are identical strings to their event kinds
    // (identity owns them via IDENTITY_ACTIVITY_KINDS), so the event kind is the
    // audit kind.
    return {
        kind: event.kind,
        subjectType: 'workspace',
        subjectId: event.aggregateId,
        meta
    };
}

/**
 * A `'content_entry'`-subject facet. The audit kind mirrors the event kind
 * (`entry.published` / `entry.unpublished`), and the entry's content type rides
 * in `meta` so the log can name *what* was published without joining anything.
 */
function entrySubject(event: DomainEvent): AuditFacet {
    return {
        kind: event.kind,
        subjectType: 'content_entry',
        subjectId: event.aggregateId,
        meta: { contentType: nullableString(event.payload.contentType) }
    };
}

/**
 * An `'api_token'`-subject facet. The subject is the token, and the acting
 * admin arrives separately as the actor.
 *
 * `meta` records what a reviewer needs to reason about the credential — its
 * label, its scope, its workspace bucket, and the non-secret `lookupPrefix`
 * that identifies it in the admin list. It deliberately carries **neither the
 * plaintext nor the hash**: `api_tokens` stores only a SHA-256 precisely so a
 * read of another table yields nothing usable, and the audit log is another
 * table.
 */
function apiTokenSubject(event: DomainEvent, auditKind: string): AuditFacet {
    const payload = event.payload;
    return {
        kind: auditKind,
        subjectType: 'api_token',
        subjectId: event.aggregateId,
        meta: {
            name: nullableString(payload.name),
            scope: nullableString(payload.scope),
            workspaceIds: payload.workspaceIds ?? [],
            lookupPrefix: nullableString(payload.lookupPrefix)
        }
    };
}

/**
 * Thrown when an event cannot be mapped to a row that identifies its subject.
 *
 * Refusing is the point. `subject_id` is the **only** handle an audit row keeps
 * on the entity it is about — there is no FK, no denormalised name, and
 * `actor_email` belongs to the actor — so a row written with an empty subject
 * is not a degraded record, it is an unreadable one, and nothing downstream can
 * repair it. Throwing leaves the outbox row undispatched, so the dispatcher
 * retries it with backoff and parks it at `MAX_DELIVERY_ATTEMPTS` where the
 * dead-letter query (`dispatched_at IS NULL AND attempts >= 15`) surfaces it.
 * The gap becomes loud instead of becoming a row nobody can read.
 */
export class UnmappableAuditEventError extends Error {
    constructor(event: DomainEvent, reason: string) {
        super(
            `Cannot map ${event.kind} (event ${event.eventId}) to an audit row: ${reason}`
        );
        this.name = 'UnmappableAuditEventError';
    }
}

/**
 * A workspace membership facet — subject is the affected **user**, not the
 * workspace.
 *
 * A payload with no `userId` is refused rather than defaulted. It used to write
 * `subjectId: '' `, which inserts cleanly against `subject_id text NOT NULL`
 * and produces a row naming an action, a workspace and an actor but no subject
 * — silent corruption of the trail, and (as ♿ A11Y-activity-server-01 records)
 * a row whose Subject cell has no accessible name that no client can repair.
 */
function membershipSubject(event: DomainEvent, auditKind: string): AuditFacet {
    const payload = event.payload;
    const userId = nullableString(payload.userId);
    if (!userId) {
        throw new UnmappableAuditEventError(
            event,
            'payload.userId is missing, and the membership subject is the affected user'
        );
    }
    return {
        kind: auditKind,
        subjectType: 'user',
        subjectId: userId,
        meta: {
            workspaceId: event.aggregateId,
            email: nullableString(payload.email)
        }
    };
}

/**
 * A `'media_asset'`-subject facet. `meta` passes the event payload's own
 * descriptive fields through — media's payloads differ per kind (`name`/`kind`
 * on upload, the changed field on update, `folderId` on move, the storage key
 * on delete) and each is exactly what a reviewer asking "what happened to this
 * asset" wants, so the facet forwards the payload minus the actor rather than
 * flattening every kind into one shape.
 */
function mediaAssetSubject(event: DomainEvent): AuditFacet {
    return {
        kind: event.kind,
        subjectType: 'media_asset',
        subjectId: event.aggregateId,
        meta: payloadWithoutActor(event)
    };
}

/** A `'media_folder'`-subject facet. Same payload-passthrough as the asset one. */
function mediaFolderSubject(event: DomainEvent): AuditFacet {
    return {
        kind: event.kind,
        subjectType: 'media_folder',
        subjectId: event.aggregateId,
        meta: payloadWithoutActor(event)
    };
}

/**
 * The event payload with `attachActor`'s `actor` key removed — the actor is
 * lifted onto the row's own `actorId`/`actorEmail` columns by
 * {@link toAuditRow}, so repeating it inside `meta` would only duplicate it.
 */
function payloadWithoutActor(event: DomainEvent): Record<string, unknown> {
    const { actor: _actor, ...rest } = event.payload;
    return rest;
}

/**
 * The event-kind → audit-facet table. Each entry reproduces **exactly** the row
 * the old in-band `recorder.record(...)` wrote for that action:
 *
 * | domain event               | audit kind                | subject / meta                                   |
 * | -------------------------- | ------------------------- | ------------------------------------------------ |
 * | `workspace.created`        | `workspace.created`       | workspace / `{ name, slug }`                      |
 * | `workspace.updated`        | `workspace.updated`       | workspace / `{ fields }`                          |
 * | `workspace.archived`       | `workspace.archived`      | workspace / `{}`                                  |
 * | `workspace.unarchived`     | `workspace.unarchived`    | workspace / `{}`                                  |
 * | `workspace.deleted`        | `workspace.deleted`       | workspace / `{ name, slug }`                      |
 * | `workspace.member_added`   | `workspace.member_added`  | **user** / `{ workspaceId, email }`              |
 * | `workspace.member_removed` | `workspace.member_removed`| **user** / `{ workspaceId, email }`              |
 * | `workspace.content_granted`| `workspace.content_granted`| workspace / `{ slug, kind }`                     |
 * | `workspace.content_revoked`| `workspace.content_revoked`| workspace / `{ slug }`                           |
 * | `member.invited`           | `user.invited`            | user / `{ email }`                               |
 * | `member.invite_resent`     | `user.invite_resent`      | user / `{ email }`                               |
 * | `member.password_reset_issued` | `user.password_reset_issued` | user / `{ email }`                     |
 * | `member.removed`           | `user.invite_revoked`     | user / `{ email }`                               |
 * | `member.profile_updated`   | `user.profile_updated`    | user / `{ name: { from, to } }`                  |
 * | `member.role_changed`      | `user.role_changed`       | user / `{ from, to }`                            |
 * | `member.disabled`          | `user.suspended`          | user / `null`                                    |
 * | `member.reactivated`       | `user.reactivated`        | user / `null`                                    |
 * | `user.password_changed`    | `user.password_changed`   | user / `{ sessionsRevoked }`                     |
 * | `user.activated`           | `user.activated`          | user / `null`                                    |
 * | `api_token.created`        | `token.created`           | api_token / `{ name, scope, workspaceIds, lookupPrefix }` |
 * | `api_token.revoked`        | `token.revoked`           | api_token / same shape                           |
 * | `auth.signed_in`           | `user.signed_in`          | user / `null`                                    |
 * | `auth.signed_out`          | `user.signed_out`         | user / `null`                                    |
 * | `entry.published`          | `entry.published`         | content_entry / `{ contentType }`                |
 * | `entry.unpublished`        | `entry.unpublished`       | content_entry / `{ contentType }`                |
 * | `media.asset.uploaded`     | `media.asset.uploaded`    | media_asset / payload minus `actor`              |
 * | `media.asset.updated`      | `media.asset.updated`     | media_asset / payload minus `actor`              |
 * | `media.asset.moved`        | `media.asset.moved`       | media_asset / payload minus `actor`              |
 * | `media.asset.deleted`      | `media.asset.deleted`     | media_asset / payload minus `actor`              |
 * | `media.folder.created`     | `media.folder.created`    | media_folder / payload minus `actor`             |
 * | `media.folder.renamed`     | `media.folder.renamed`    | media_folder / payload minus `actor`             |
 * | `media.folder.deleted`     | `media.folder.deleted`    | media_folder / payload minus `actor`             |
 *
 * The actor (`actorId`/`actorEmail`) is not here — it rides on the event payload
 * (`attachActor`) and is read uniformly by {@link toAuditRow}.
 */
const FACET_MAPPERS: Record<string, (event: DomainEvent) => AuditFacet> = {
    'workspace.created': (e) =>
        workspaceSubject(e, {
            name: nullableString(e.payload.name),
            slug: nullableString(e.payload.slug)
        }),
    'workspace.updated': (e) =>
        workspaceSubject(e, { fields: e.payload.fields ?? [] }),
    'workspace.archived': (e) => workspaceSubject(e, {}),
    'workspace.unarchived': (e) => workspaceSubject(e, {}),
    'workspace.deleted': (e) =>
        workspaceSubject(e, {
            name: nullableString(e.payload.name),
            slug: nullableString(e.payload.slug)
        }),
    'workspace.member_added': (e) =>
        membershipSubject(e, IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED),
    'workspace.member_removed': (e) =>
        membershipSubject(e, IDENTITY_ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED),
    'workspace.content_granted': (e) =>
        workspaceSubject(e, {
            slug: nullableString(e.payload.slug),
            kind: nullableString(e.payload.kind)
        }),
    'workspace.content_revoked': (e) =>
        workspaceSubject(e, { slug: nullableString(e.payload.slug) }),

    'member.invited': (e) =>
        userSubject(e, USER_AUDIT_KINDS.INVITED, {
            email: nullableString(e.payload.email)
        }),
    'member.invite_resent': (e) =>
        userSubject(e, USER_AUDIT_KINDS.INVITE_RESENT, {
            email: nullableString(e.payload.email)
        }),
    'member.password_reset_issued': (e) =>
        userSubject(e, USER_AUDIT_KINDS.PASSWORD_RESET_ISSUED, {
            email: nullableString(e.payload.email)
        }),
    'member.removed': (e) =>
        userSubject(e, USER_AUDIT_KINDS.INVITE_REVOKED, {
            email: nullableString(e.payload.email)
        }),
    'member.profile_updated': (e) =>
        userSubject(e, USER_AUDIT_KINDS.PROFILE_UPDATED, {
            name: e.payload.name ?? null
        }),
    'member.role_changed': (e) =>
        userSubject(e, USER_AUDIT_KINDS.ROLE_CHANGED, {
            from: nullableString(e.payload.from),
            to: nullableString(e.payload.to)
        }),
    'member.disabled': (e) => userSubject(e, USER_AUDIT_KINDS.SUSPENDED, null),
    'member.reactivated': (e) =>
        userSubject(e, USER_AUDIT_KINDS.REACTIVATED, null),

    // Credential rotation. The kind is passed straight through (identity's
    // event kind and the audit kind are the same string), and `meta` records
    // how many live sessions the change evicted — the number a security review
    // actually wants: "the password changed AND N devices were signed out".
    'user.password_changed': (e) =>
        userSubject(e, USER_AUDIT_KINDS.PASSWORD_CHANGED, {
            sessionsRevoked: e.payload.sessionsRevoked ?? null
        }),

    // Invite acceptance. `accept-invite.use-case.ts` appends this alongside
    // `auth.signed_in`, and only the sign-in was ever mapped — so the trail
    // recorded that an invited person signed in, but never that the account
    // itself went from `pending` to `active` and gained a credential. Those are
    // different facts and a security review wants the first one.
    'user.activated': (e) => userSubject(e, USER_AUDIT_KINDS.ACTIVATED, null),

    'auth.signed_in': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SIGNED_IN, null),
    'auth.signed_out': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SIGNED_OUT, null),

    // External-API bearer tokens. Nothing mapped these before, so minting and
    // revoking a long-lived key to workspace content left the log completely
    // silent (BUG-identity-server-01) — the audit trail could not answer "who
    // issued this credential, when, and scoped to what".
    'api_token.created': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_CREATED),
    'api_token.revoked': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_REVOKED),

    // Content publish lifecycle. `content-server` has raised these on the outbox
    // since the entry aggregate was introduced — its own comment anticipated
    // this subscriber — but nothing consumed them, so the log carried no content
    // activity at all.
    'entry.published': entrySubject,
    'entry.unpublished': entrySubject,

    // The media library. Every one of these was raised on the outbox and
    // dropped on the floor: the dispatcher found no subscriber for the kind,
    // stamped the row dispatched, and the audit log stayed silent about every
    // upload, rename, move and deletion in the asset store.
    [MEDIA_AUDIT_KINDS.ASSET_UPLOADED]: mediaAssetSubject,
    [MEDIA_AUDIT_KINDS.ASSET_UPDATED]: mediaAssetSubject,
    [MEDIA_AUDIT_KINDS.ASSET_MOVED]: mediaAssetSubject,
    [MEDIA_AUDIT_KINDS.ASSET_DELETED]: mediaAssetSubject,
    [MEDIA_AUDIT_KINDS.FOLDER_CREATED]: mediaFolderSubject,
    [MEDIA_AUDIT_KINDS.FOLDER_RENAMED]: mediaFolderSubject,
    [MEDIA_AUDIT_KINDS.FOLDER_DELETED]: mediaFolderSubject
};

/**
 * Every event kind the activity subscriber audits — the dispatcher delivers
 * only these to it.
 */
export const AUDITED_EVENT_KINDS = Object.keys(
    FACET_MAPPERS
) as readonly string[];

/** Reads the acting user off the event payload (`attachActor`'s `actor` key). */
function readActor(payload: Record<string, unknown>): {
    id: string | null;
    email: string | null;
} {
    const actor = payload.actor as
        | { id?: unknown; email?: unknown }
        | undefined;
    return {
        id: nullableString(actor?.id),
        email: nullableString(actor?.email)
    };
}

/**
 * Maps a domain event to the audit row it should produce, or `null` when the
 * kind is not audited. Pure and DB-free — the safety-net unit test asserts each
 * kind's row equals what the old in-band recorder wrote.
 *
 * Throws {@link UnmappableAuditEventError} when the kind **is** audited but the
 * payload cannot identify its subject. `null` and a throw mean different things
 * on purpose: `null` is "not our event, skip it" and the dispatcher marks the
 * row delivered; a throw is "this should have been audited and cannot be", so
 * the row stays undispatched, is retried with backoff, and finally parks as a
 * dead letter rather than becoming a row nobody can read.
 */
export function toAuditRow(event: DomainEvent): AuditRow | null {
    const mapper = FACET_MAPPERS[event.kind];
    if (!mapper) {
        return null;
    }
    const facet = mapper(event);
    const actor = readActor(event.payload);
    return {
        id: event.eventId,
        kind: facet.kind,
        subjectType: facet.subjectType,
        subjectId: facet.subjectId,
        actorId: actor.id,
        actorEmail: actor.email,
        meta: facet.meta,
        at: event.occurredAt
    };
}
