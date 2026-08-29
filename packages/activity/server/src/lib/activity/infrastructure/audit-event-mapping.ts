import type { DomainEvent } from '@orthacms/database';
import { IDENTITY_ACTIVITY_KINDS } from '@orthacms/identity-server';

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
    /**
     * What {@link actorId} names — `'user'`, `'api_token'`, or `null` when
     * there is no actor. Defaults to `'user'` for an event whose actor predates
     * the field, which is every actor the product had until API tokens could be
     * one.
     */
    actorType: string | null;
    /** Frozen actor email snapshot, or `null`. */
    actorEmail: string | null;
    /**
     * The workspace the action happened in, or `null` when it happened in none
     * (an invite, a role change, a workspace being created). Read from the
     * event's own `payload.workspaceId` — a producer that has a workspace puts
     * it there.
     */
    workspaceId: string | null;
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
 * (`USER_ACTIVITY_KINDS` in `@orthacms/users-server`). Duplicated here as
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

/**
 * The **transfer.\*** audit kinds — content leaving and entering the system in
 * bulk.
 *
 * `transfer/server` has raised these since the feature landed, and its own
 * `transfer.events.ts` explains at length why an *export* — a read — raises an
 * audit event at all: it is the one operation that takes a workspace's content
 * out of the system, files included, and nothing in the content tables changes
 * to record it. Nothing mapped them, so that reasoning produced no rows: the
 * dispatcher found no subscriber, stamped `dispatched_at`, and every export and
 * import left the log silent. The fourth time this exact failure has happened,
 * after API tokens, entry publishes and the whole media library.
 *
 * An import is *also* visible as the `entry.created` / `entry.updated` rows its
 * writes raise — it goes through `EntryWriterService` like any other write — but
 * those rows say a hundred entries changed, not that one person imported a file.
 * Those are different facts and the second one is the one an operator asks about.
 */
const TRANSFER_AUDIT_KINDS = {
    EXPORTED: 'transfer.content.exported',
    IMPORTED: 'transfer.content.imported'
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
 * (`entry.created`, `entry.published`, `entry.deleted`, …), and the entry's
 * content type rides in `meta` so the log can name *what* happened to without
 * joining anything.
 *
 * The entry's frozen `title` rides alongside, so the row names something a
 * reader recognises.
 *
 * `extra` carries the few facts one kind has and the others do not — the
 * changed `fields` on an update, and whether a delete was a recoverable
 * tombstone (`soft`) or the row leaving the table. Everything else about an
 * entry event is the same shape, which is why one mapper serves all seven.
 */
function entrySubject(
    event: DomainEvent,
    extra: Record<string, unknown> = {}
): AuditFacet {
    return {
        kind: event.kind,
        subjectType: 'content_entry',
        subjectId: event.aggregateId,
        meta: {
            contentType: nullableString(event.payload.contentType),
            // The entry's label **at the time of the event**, frozen by the
            // producer. An audit row keeps no FK and no lookup, so without this
            // the Subject cell is a bare uuid — survivable while the entry
            // exists, and permanently unreadable after `entry.purged`, which is
            // exactly the row this is the last remaining record of.
            title: nullableString(event.payload.title),
            ...extra
        }
    };
}

/**
 * An `'api_token'`-subject facet. The subject is the token, and the acting
 * admin arrives separately as the actor.
 *
 * `meta` records what a reviewer needs to reason about the credential — its
 * label, its scope, its workspace bucket, and the non-secret `lookupPrefix`
 * that identifies it in the admin list, plus whatever `extra` the kind adds. It
 * deliberately carries **neither the plaintext nor the hash**: `api_tokens`
 * stores only a SHA-256 precisely so a read of another table yields nothing
 * usable, and the audit log is another table.
 */
function apiTokenSubject(
    event: DomainEvent,
    auditKind: string,
    extra: Record<string, unknown> = {}
): AuditFacet {
    const payload = event.payload;
    return {
        kind: auditKind,
        subjectType: 'api_token',
        subjectId: event.aggregateId,
        meta: {
            name: nullableString(payload.name),
            scope: nullableString(payload.scope),
            workspaceIds: payload.workspaceIds ?? [],
            lookupPrefix: nullableString(payload.lookupPrefix),
            ...extra
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
 * A `'login_attempt'`-subject facet — the subject is the **address** that was
 * tried, not a user.
 *
 * It has to be: the failures worth reading are exactly the ones where no
 * account exists to key on, and a mapper that insisted on a user id would
 * refuse them (see {@link UnmappableAuditEventError}) and park every guess
 * against an unknown address as a dead letter. `subject_id` is `text` for this
 * kind of subject, and `activity_events_subject_idx` then makes "what has been
 * tried against this login" one indexed read.
 */
function signInAttemptSubject(event: DomainEvent): AuditFacet {
    return {
        kind: IDENTITY_ACTIVITY_KINDS.USER_SIGN_IN_FAILED,
        subjectType: 'login_attempt',
        subjectId: event.aggregateId,
        meta: payloadWithoutActor(event)
    };
}

/**
 * A `'content_type'`-subject facet — the subject of a transfer is the content
 * type that moved, which is what the event's `aggregateId` already carries.
 *
 * There is no single entry to point at: an export names a selection and an
 * import names a file, and both fan out across relations, files and locales.
 * The type is the one stable handle the row can keep, and `meta` carries the
 * rest — the format, how many records were selected, and the per-kind counts the
 * walk actually produced — so a reviewer can see that "12 selected" left as 47
 * records plus 9 files without opening anything.
 */
function transferSubject(event: DomainEvent): AuditFacet {
    return {
        kind: event.kind,
        subjectType: 'content_type',
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
 * | `user.disabled`            | `user.suspended`          | user / `null`                                    |
 * | `user.enabled`             | `user.reactivated`        | user / `null`                                    |
 * | `api_token.created`        | `token.created`           | api_token / `{ name, scope, workspaceIds, lookupPrefix }` |
 * | `api_token.revoked`        | `token.revoked`           | api_token / same shape                           |
 * | `api_token.used`           | `token.used`              | api_token / same shape + `previousUseAt`         |
 * | `user.session_revoked`     | `user.session_revoked`    | user / `{ sessionId }`                           |
 * | `auth.signed_in`           | `user.signed_in`          | user / `null`                                    |
 * | `auth.signed_out`          | `user.signed_out`         | user / `null`                                    |
 * | `auth.sign_in_failed`      | `user.sign_in_failed`     | **login_attempt** / `{ reason, userId, ipAddress, userAgent }` |
 * | `entry.created`            | `entry.created`           | content_entry / `{ contentType, title }`                |
 * | `entry.updated`            | `entry.updated`           | content_entry / `{ contentType, title, fields }`        |
 * | `entry.published`          | `entry.published`         | content_entry / `{ contentType, title }`                |
 * | `entry.unpublished`        | `entry.unpublished`       | content_entry / `{ contentType, title }`                |
 * | `entry.deleted`            | `entry.deleted`           | content_entry / `{ contentType, title, soft }`          |
 * | `entry.restored`           | `entry.restored`          | content_entry / `{ contentType, title }`                |
 * | `entry.purged`             | `entry.purged`            | content_entry / `{ contentType, title }`                |
 * | `media.asset.uploaded`     | `media.asset.uploaded`    | media_asset / payload minus `actor`              |
 * | `media.asset.updated`      | `media.asset.updated`     | media_asset / payload minus `actor`              |
 * | `media.asset.moved`        | `media.asset.moved`       | media_asset / payload minus `actor`              |
 * | `media.asset.deleted`      | `media.asset.deleted`     | media_asset / payload minus `actor`              |
 * | `media.folder.created`     | `media.folder.created`    | media_folder / payload minus `actor`             |
 * | `media.folder.renamed`     | `media.folder.renamed`    | media_folder / payload minus `actor`             |
 * | `media.folder.deleted`     | `media.folder.deleted`    | media_folder / payload minus `actor`             |
 * | `transfer.content.exported`| `transfer.content.exported`| content_type / payload minus `actor`            |
 * | `transfer.content.imported`| `transfer.content.imported`| content_type / payload minus `actor`            |
 *
 * The actor (`actorId`/`actorType`/`actorEmail`) is not here — it rides on the
 * event payload (`attachActor`) and is read uniformly by {@link toAuditRow}, as
 * is `workspaceId` (from the payload's own `workspaceId`, when the producer has
 * one).
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

    // The identity aggregate's own lifecycle pair. Today every disable/enable
    // in the product runs through the users context's `Member` aggregate, whose
    // `member.disabled` / `member.reactivated` are mapped above — these two are
    // raised by `UserAccount.disable()` / `.enable()`, which nothing in the
    // product calls yet. They are mapped anyway, and to the **same** audit kinds
    // as their `member.*` counterparts: the methods are public API of a
    // published package, so the first caller to appear would otherwise reproduce
    // this package's signature failure — an event raised, no subscriber found,
    // the row stamped dispatched, and an account silently locked out with
    // nothing in the log. Which aggregate performed the change is an internal
    // fact; the reader wants "this account was suspended".
    'user.disabled': (e) => userSubject(e, USER_AUDIT_KINDS.SUSPENDED, null),
    'user.enabled': (e) => userSubject(e, USER_AUDIT_KINDS.REACTIVATED, null),

    // Invite acceptance. `accept-invite.use-case.ts` appends this alongside
    // `auth.signed_in`, and only the sign-in was ever mapped — so the trail
    // recorded that an invited person signed in, but never that the account
    // itself went from `pending` to `active` and gained a credential. Those are
    // different facts and a security review wants the first one.
    'user.activated': (e) => userSubject(e, USER_AUDIT_KINDS.ACTIVATED, null),

    // The sign-in itself, plus **how** it happened. A password sign-in carries
    // no method and reads as it always has; an SSO one records the provider, so
    // the log can answer "which of these people came in through the directory,
    // and which still hold a password?" — which is the first question after a
    // provider is misconfigured or retired.
    'auth.signed_in': (e) =>
        userSubject(
            e,
            IDENTITY_ACTIVITY_KINDS.USER_SIGNED_IN,
            e.payload.method === 'sso'
                ? {
                      method: 'sso',
                      provider: nullableString(e.payload.provider)
                  }
                : null
        ),
    'auth.signed_out': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SIGNED_OUT, null),

    // …and the refusal, which had no kind at all. `auth.signed_in` fires on
    // success only, so a log full of successful sign-ins was equally consistent
    // with nobody ever guessing and with a sustained attack — the one question
    // an operator most wants the trail to settle. The row carries the coarse
    // reason, the address, and the IP/User-Agent the attempt came from; the HTTP
    // response is unchanged and still says nothing.
    'auth.sign_in_failed': signInAttemptSubject,

    // Single sign-on. Three separate facts, deliberately not folded into the
    // sign-in above: a link means a second way into the account now exists, a
    // provisioned account is the only kind this product creates without an
    // invite, and a mapped role is an authorization change that an
    // administrator did not make. A reviewer asking "where did this user come
    // from?" is asking for the middle one, and a sign-in row cannot answer it.
    'user.sso_linked': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SSO_LINKED, {
            provider: nullableString(e.payload.provider)
        }),
    'user.sso_provisioned': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SSO_PROVISIONED, {
            provider: nullableString(e.payload.provider),
            role: nullableString(e.payload.role)
        }),
    'user.sso_role_mapped': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SSO_ROLE_MAPPED, {
            provider: nullableString(e.payload.provider),
            role: nullableString(e.payload.role)
        }),

    // An administrator ending somebody else's session. `auth.signed_out` is a
    // person closing their own; this is an act performed *on* an account, and
    // it was the one route under `/users/:id` that wrote nothing at all.
    'user.session_revoked': (e) =>
        userSubject(e, IDENTITY_ACTIVITY_KINDS.USER_SESSION_REVOKED, {
            sessionId: nullableString(e.payload.sessionId)
        }),

    // External-API bearer tokens. Nothing mapped these before, so minting and
    // revoking a long-lived key to workspace content left the log completely
    // silent (BUG-identity-server-01) — the audit trail could not answer "who
    // issued this credential, when, and scoped to what".
    'api_token.created': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_CREATED),
    'api_token.revoked': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_REVOKED),
    // …and the credential actually being used, throttled at the source to one
    // row per token per minute. `last_used_at` on the token row answers "when
    // was this last used" and nothing else: a token dormant for six months that
    // woke up on Tuesday reads exactly like one in daily use, which is the
    // distinction that matters after a key leaks.
    'api_token.used': (e) =>
        apiTokenSubject(e, IDENTITY_ACTIVITY_KINDS.TOKEN_USED, {
            // How long the credential had been quiet before this request. The
            // touch overwrites `last_used_at`, so this is the only copy of it.
            previousUseAt: e.payload.previousUseAt ?? null
        }),

    // Content publish lifecycle. `content-server` has raised these on the outbox
    // since the entry aggregate was introduced — its own comment anticipated
    // this subscriber — but nothing consumed them, so the log carried no content
    // activity at all.
    'entry.published': entrySubject,
    'entry.unpublished': entrySubject,

    // …and the ordinary editing lifecycle, which raised nothing at all until
    // the entry writes moved onto the unit of work. Publishing was the only
    // content action the log could answer for, so an editor could create,
    // rewrite and delete every entry in the product and it stayed silent about
    // the single most frequent action in a CMS.
    'entry.created': (e) => entrySubject(e),
    // `fields` names what actually changed — the `workspace.updated` shape, and
    // what makes the row a review rather than a bare "someone saved this".
    'entry.updated': (e) => entrySubject(e, { fields: e.payload.fields ?? [] }),
    // `soft` is the difference between a tombstone the trash can restore and a
    // row that left the table when this committed.
    'entry.deleted': (e) => entrySubject(e, { soft: e.payload.soft === true }),
    'entry.restored': (e) => entrySubject(e),
    // The one content action with nothing left behind to inspect afterwards,
    // and therefore the one this row is the only remaining record of.
    'entry.purged': (e) => entrySubject(e),

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
    [MEDIA_AUDIT_KINDS.FOLDER_DELETED]: mediaFolderSubject,

    // Bulk export and import. Raised with an actor since the feature shipped and
    // dropped on the floor ever since, so the one operation that moves a
    // workspace's content out of the system wholesale was the one operation the
    // audit log could not answer for.
    [TRANSFER_AUDIT_KINDS.EXPORTED]: transferSubject,
    [TRANSFER_AUDIT_KINDS.IMPORTED]: transferSubject
};

/**
 * Every event kind the activity subscriber audits — the dispatcher delivers
 * only these to it.
 */
export const AUDITED_EVENT_KINDS = Object.keys(
    FACET_MAPPERS
) as readonly string[];

/**
 * Reads the acting principal off the event payload (`attachActor`'s `actor`
 * key).
 *
 * `type` defaults to `'user'` **only when there is an actor at all**: a row
 * with no `actor_id` must not claim to have been performed by a user, so an
 * absent actor yields `null` on every field. An `actor` written before
 * `attachActor` carried a type is a person by construction — nothing else could
 * be one — so defaulting it is a statement of fact rather than a guess.
 *
 * `label` is the readable name of a non-person actor (an API token's label);
 * for a user the readable name is the email, which already has its own column.
 */
function readActor(payload: Record<string, unknown>): {
    id: string | null;
    email: string | null;
    type: string | null;
} {
    const actor = payload.actor as
        | { id?: unknown; email?: unknown; type?: unknown; label?: unknown }
        | undefined;
    const id = nullableString(actor?.id);
    if (!id) {
        return { id: null, email: null, type: null };
    }
    return {
        id,
        email: nullableString(actor?.email) ?? nullableString(actor?.label),
        type: nullableString(actor?.type) ?? 'user'
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
        actorType: actor.type,
        actorEmail: actor.email,
        workspaceId: nullableString(event.payload.workspaceId),
        meta: facet.meta,
        at: event.occurredAt
    };
}
