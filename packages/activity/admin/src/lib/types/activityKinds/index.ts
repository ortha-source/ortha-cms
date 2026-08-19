/**
 * The audit-event kinds the Activity Log renders. The admin can't import the
 * server plugins (separate apps / module boundaries), so it restates the kind
 * strings here — exactly as it restates wire types — as the source for the
 * `ActivityKind` type and the action-label map. Each string mirrors a kind an
 * emitting plugin records (identity owns auth/workspace/token, users owns
 * member lifecycle, content owns the entry publish lifecycle, media owns the
 * asset/folder lifecycle).
 *
 * **This list must stay in step with the server's audit catalogue**
 * (`FACET_MAPPERS` in `@ortha-cms/activity-server`'s `audit-event-mapping.ts`,
 * whose *output* `kind`s these are — not its input event kinds). A kind the
 * server writes and this list omits is not a type error anywhere: the mapper
 * casts `dto.kind as ActivityKind`, `formatActivityAction` finds no descriptor,
 * and the Action column prints the raw dotted wire token untranslated. That is
 * exactly what happened to the six `workspace.*` kinds, `user.activated` and
 * all seven `media.*` kinds before ORT-48. `apps/admin-e2e`'s
 * `activity-kinds.spec.ts` pins the whole catalogue so a new server kind is
 * caught by a failing test rather than by a reader seeing `media.asset.uploaded`
 * in the UI.
 */
export const ACTIVITY_KINDS = [
    'user.invited',
    'user.invite_resent',
    'user.invite_revoked',
    'user.password_reset_issued',
    'user.activated',
    'user.profile_updated',
    'user.role_changed',
    'user.suspended',
    'user.reactivated',
    'user.password_changed',
    'user.signed_in',
    'user.signed_out',
    'workspace.created',
    'workspace.updated',
    'workspace.archived',
    'workspace.unarchived',
    'workspace.deleted',
    'workspace.member_added',
    'workspace.member_removed',
    'workspace.content_granted',
    'workspace.content_revoked',
    'entry.created',
    'entry.updated',
    'entry.published',
    'entry.unpublished',
    'entry.deleted',
    'entry.restored',
    'entry.purged',
    'token.created',
    'token.revoked',
    'media.asset.uploaded',
    'media.asset.updated',
    'media.asset.moved',
    'media.asset.deleted',
    'media.folder.created',
    'media.folder.renamed',
    'media.folder.deleted'
] as const;

/** A kind the Activity Log knows how to render. */
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * The subject types the server stamps on an audit row — the `subjectType`
 * column's whole range. Restated here for the same reason as the kinds, and
 * used to give the Subject cell a localized label: the raw values are
 * snake_cased machine tokens (`media_asset`, `content_entry`), which a bare CSS
 * `capitalize` renders as "Media_asset" rather than "Media asset".
 */
export const ACTIVITY_SUBJECT_TYPES = [
    'user',
    'workspace',
    'content_entry',
    'api_token',
    'media_asset',
    'media_folder'
] as const;

/** A subject type the Activity Log knows how to name. */
export type ActivitySubjectType = (typeof ACTIVITY_SUBJECT_TYPES)[number];
