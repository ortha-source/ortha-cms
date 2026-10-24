import {
    defineMessages,
    type IntlShape,
    type MessageDescriptor
} from 'react-intl';
import type { ActivityEvent } from '../../types/activityEvent';
import type {
    ActivityKind,
    ActivitySubjectType
} from '../../types/activityKinds';

/**
 * One feed line per kind — "**Grace Hopper** published **Spring launch**" — the
 * actor, the verb, the object, read as one sentence rather than four columns.
 *
 * Every message takes the same values, and uses the ones it needs:
 * - `actor` — who did it (an email, a token's label, or "System");
 * - `object` — what it was done to: the name the server froze on the row
 *   (`subjectLabel`), else a readable name from `meta`, else a noun for the
 *   subject type ("a member");
 * - `to` / `hasTo` — the new value of a role change;
 * - `origin` / `hasOrigin` — where a sign-in came from.
 *
 * `<b>…</b>` marks the parts the feed sets in medium weight. The workspace
 * ("in Marketing site") is not part of the sentence: it is a quiet suffix the
 * row adds, because a third of the kinds belong to no workspace at all.
 *
 * Typed `Record<ActivityKind, …>` like `ACTION_MESSAGES`, so a kind added to
 * the catalogue without a sentence is a compile error rather than a feed line
 * that silently falls back to the action label.
 */
const sentenceMessages = defineMessages({
    invited: {
        id: 'activity.sentence.user.invited',
        defaultMessage: '<b>{actor}</b> invited <b>{object}</b>'
    },
    inviteResent: {
        id: 'activity.sentence.user.invite_resent',
        defaultMessage: '<b>{actor}</b> resent the invite to <b>{object}</b>'
    },
    inviteRevoked: {
        id: 'activity.sentence.user.invite_revoked',
        defaultMessage: '<b>{actor}</b> revoked the invite for <b>{object}</b>'
    },
    passwordResetIssued: {
        id: 'activity.sentence.user.password_reset_issued',
        defaultMessage:
            '<b>{actor}</b> issued a password reset link for <b>{object}</b>'
    },
    inviteLinkRevealed: {
        id: 'activity.sentence.user.invite_link_revealed',
        defaultMessage:
            '<b>{actor}</b> revealed an undelivered link for <b>{object}</b>'
    },
    activated: {
        id: 'activity.sentence.user.activated',
        defaultMessage: '<b>{actor}</b> activated their account'
    },
    profileUpdated: {
        id: 'activity.sentence.user.profile_updated',
        defaultMessage: '<b>{actor}</b> updated the profile of <b>{object}</b>'
    },
    roleChanged: {
        id: 'activity.sentence.user.role_changed',
        defaultMessage:
            '<b>{actor}</b> changed the role of <b>{object}{hasTo, select, yes { to {to}} other {}}</b>'
    },
    suspended: {
        id: 'activity.sentence.user.suspended',
        defaultMessage: '<b>{actor}</b> suspended <b>{object}</b>'
    },
    reactivated: {
        id: 'activity.sentence.user.reactivated',
        defaultMessage: '<b>{actor}</b> reactivated <b>{object}</b>'
    },
    passwordChanged: {
        id: 'activity.sentence.user.password_changed',
        defaultMessage: '<b>{actor}</b> changed their password'
    },
    signedIn: {
        id: 'activity.sentence.user.signed_in',
        defaultMessage:
            '<b>{actor}</b> signed in{hasOrigin, select, yes { from <b>{origin}</b>} other {}}'
    },
    signedOut: {
        id: 'activity.sentence.user.signed_out',
        defaultMessage: '<b>{actor}</b> signed out'
    },
    signInFailed: {
        id: 'activity.sentence.user.sign_in_failed',
        defaultMessage:
            'A sign-in as <b>{object}</b> was refused{hasOrigin, select, yes { from <b>{origin}</b>} other {}}'
    },
    sessionRevoked: {
        id: 'activity.sentence.user.session_revoked',
        defaultMessage: '<b>{actor}</b> ended a session of <b>{object}</b>'
    },
    ssoLinked: {
        id: 'activity.sentence.user.sso_linked',
        defaultMessage:
            '<b>{actor}</b> linked <b>{object}</b> to an identity provider'
    },
    ssoProvisioned: {
        id: 'activity.sentence.user.sso_provisioned',
        defaultMessage:
            '<b>{object}</b> was provisioned from an identity provider{hasTo, select, yes { as <b>{to}</b>} other {}}'
    },
    ssoRoleMapped: {
        id: 'activity.sentence.user.sso_role_mapped',
        defaultMessage:
            'An identity provider set the role of <b>{object}</b>{hasTo, select, yes { to <b>{to}</b>} other {}}'
    },
    workspaceCreated: {
        id: 'activity.sentence.workspace.created',
        defaultMessage:
            '<b>{actor}</b> created {named, select, yes {the workspace <b>{object}</b>} other {<b>{object}</b>}}'
    },
    workspaceUpdated: {
        id: 'activity.sentence.workspace.updated',
        defaultMessage:
            '<b>{actor}</b> updated {named, select, yes {the workspace <b>{object}</b>} other {<b>{object}</b>}}'
    },
    workspaceArchived: {
        id: 'activity.sentence.workspace.archived',
        defaultMessage:
            '<b>{actor}</b> archived {named, select, yes {the workspace <b>{object}</b>} other {<b>{object}</b>}}'
    },
    workspaceUnarchived: {
        id: 'activity.sentence.workspace.unarchived',
        defaultMessage:
            '<b>{actor}</b> restored {named, select, yes {the workspace <b>{object}</b>} other {<b>{object}</b>}}'
    },
    workspaceDeleted: {
        id: 'activity.sentence.workspace.deleted',
        defaultMessage:
            '<b>{actor}</b> deleted {named, select, yes {the workspace <b>{object}</b>} other {<b>{object}</b>}}'
    },
    workspaceMemberAdded: {
        id: 'activity.sentence.workspace.member_added',
        defaultMessage: '<b>{actor}</b> added <b>{object}</b> as a member'
    },
    workspaceMemberRemoved: {
        id: 'activity.sentence.workspace.member_removed',
        defaultMessage: '<b>{actor}</b> removed <b>{object}</b> as a member'
    },
    workspaceContentGranted: {
        id: 'activity.sentence.workspace.content_granted',
        defaultMessage: '<b>{actor}</b> shared <b>{object}</b>'
    },
    workspaceContentRevoked: {
        id: 'activity.sentence.workspace.content_revoked',
        defaultMessage: '<b>{actor}</b> stopped sharing <b>{object}</b>'
    },
    entryCreated: {
        id: 'activity.sentence.entry.created',
        defaultMessage: '<b>{actor}</b> created <b>{object}</b>'
    },
    entryUpdated: {
        id: 'activity.sentence.entry.updated',
        defaultMessage: '<b>{actor}</b> edited <b>{object}</b>'
    },
    entryPublished: {
        id: 'activity.sentence.entry.published',
        defaultMessage: '<b>{actor}</b> published <b>{object}</b>'
    },
    entryUnpublished: {
        id: 'activity.sentence.entry.unpublished',
        defaultMessage: '<b>{actor}</b> unpublished <b>{object}</b>'
    },
    entryDeleted: {
        id: 'activity.sentence.entry.deleted',
        defaultMessage: '<b>{actor}</b> deleted <b>{object}</b>'
    },
    entryRestored: {
        id: 'activity.sentence.entry.restored',
        defaultMessage: '<b>{actor}</b> restored <b>{object}</b>'
    },
    entryPurged: {
        id: 'activity.sentence.entry.purged',
        defaultMessage: '<b>{actor}</b> permanently deleted <b>{object}</b>'
    },
    tokenCreated: {
        id: 'activity.sentence.token.created',
        defaultMessage:
            '<b>{actor}</b> created {named, select, yes {the API token <b>{object}</b>} other {<b>{object}</b>}}'
    },
    tokenRevoked: {
        id: 'activity.sentence.token.revoked',
        defaultMessage:
            '<b>{actor}</b> revoked {named, select, yes {the API token <b>{object}</b>} other {<b>{object}</b>}}'
    },
    tokenUsed: {
        id: 'activity.sentence.token.used',
        defaultMessage:
            '{named, select, yes {The API token <b>{object}</b>} other {An API token}} was used'
    },
    assetUploaded: {
        id: 'activity.sentence.media.asset.uploaded',
        defaultMessage: '<b>{actor}</b> uploaded <b>{object}</b>'
    },
    assetUpdated: {
        id: 'activity.sentence.media.asset.updated',
        defaultMessage: '<b>{actor}</b> updated <b>{object}</b>'
    },
    assetMoved: {
        id: 'activity.sentence.media.asset.moved',
        defaultMessage: '<b>{actor}</b> moved <b>{object}</b>'
    },
    assetDeleted: {
        id: 'activity.sentence.media.asset.deleted',
        defaultMessage: '<b>{actor}</b> deleted <b>{object}</b>'
    },
    folderCreated: {
        id: 'activity.sentence.media.folder.created',
        defaultMessage:
            '<b>{actor}</b> created {named, select, yes {the folder <b>{object}</b>} other {<b>{object}</b>}}'
    },
    folderRenamed: {
        id: 'activity.sentence.media.folder.renamed',
        defaultMessage: '<b>{actor}</b> renamed a folder to <b>{object}</b>'
    },
    folderDeleted: {
        id: 'activity.sentence.media.folder.deleted',
        defaultMessage: '<b>{actor}</b> deleted <b>{object}</b>'
    },
    contentExported: {
        id: 'activity.sentence.transfer.content.exported',
        defaultMessage: '<b>{actor}</b> exported <b>{object}</b> content'
    },
    contentImported: {
        id: 'activity.sentence.transfer.content.imported',
        defaultMessage: '<b>{actor}</b> imported <b>{object}</b> content'
    },
    segmentCreated: {
        id: 'activity.sentence.segment.created',
        defaultMessage:
            '<b>{actor}</b> created {named, select, yes {the audience <b>{object}</b>} other {<b>{object}</b>}}'
    },
    segmentUpdated: {
        id: 'activity.sentence.segment.updated',
        defaultMessage:
            '<b>{actor}</b> updated {named, select, yes {the audience <b>{object}</b>} other {<b>{object}</b>}}'
    },
    segmentDeleted: {
        id: 'activity.sentence.segment.deleted',
        defaultMessage:
            '<b>{actor}</b> deleted {named, select, yes {the audience <b>{object}</b>} other {<b>{object}</b>}}'
    },
    entryAccessChanged: {
        id: 'activity.sentence.segment.entry_access_changed',
        defaultMessage: '<b>{actor}</b> changed who can read <b>{object}</b>'
    },
    alarmRuleCreated: {
        id: 'activity.sentence.alarm.rule.created',
        defaultMessage:
            '<b>{actor}</b> created {named, select, yes {the check <b>{object}</b>} other {<b>{object}</b>}}'
    },
    alarmRuleUpdated: {
        id: 'activity.sentence.alarm.rule.updated',
        defaultMessage:
            '<b>{actor}</b> updated {named, select, yes {the check <b>{object}</b>} other {<b>{object}</b>}}'
    },
    alarmRuleDeleted: {
        id: 'activity.sentence.alarm.rule.deleted',
        defaultMessage:
            '<b>{actor}</b> deleted {named, select, yes {the check <b>{object}</b>} other {<b>{object}</b>}}'
    },
    alarmRuleRescanned: {
        id: 'activity.sentence.alarm.rule.rescanned',
        defaultMessage:
            '<b>{actor}</b> rescanned {named, select, yes {the check <b>{object}</b>} other {<b>{object}</b>}}'
    },
    savedViewCreated: {
        id: 'activity.sentence.saved_view.created',
        defaultMessage:
            '<b>{actor}</b> saved {named, select, yes {the view <b>{object}</b>} other {<b>{object}</b>}}'
    },
    savedViewUpdated: {
        id: 'activity.sentence.saved_view.updated',
        defaultMessage:
            '<b>{actor}</b> updated {named, select, yes {the view <b>{object}</b>} other {<b>{object}</b>}}'
    },
    savedViewDeleted: {
        id: 'activity.sentence.saved_view.deleted',
        defaultMessage:
            '<b>{actor}</b> deleted {named, select, yes {the view <b>{object}</b>} other {<b>{object}</b>}}'
    },
    skillCreated: {
        id: 'activity.sentence.copilot.skill.created',
        defaultMessage:
            '<b>{actor}</b> created {named, select, yes {the copilot skill <b>{object}</b>} other {<b>{object}</b>}}'
    },
    skillUpdated: {
        id: 'activity.sentence.copilot.skill.updated',
        defaultMessage:
            '<b>{actor}</b> updated {named, select, yes {the copilot skill <b>{object}</b>} other {<b>{object}</b>}}'
    },
    skillDeleted: {
        id: 'activity.sentence.copilot.skill.deleted',
        defaultMessage:
            '<b>{actor}</b> deleted {named, select, yes {the copilot skill <b>{object}</b>} other {<b>{object}</b>}}'
    },
    toolPermissionDecided: {
        id: 'activity.sentence.copilot.tool_permission.decided',
        defaultMessage: '<b>{actor}</b> answered a copilot request'
    },
    reviewRequested: {
        id: 'activity.sentence.review.requested',
        defaultMessage: '<b>{actor}</b> requested a review of <b>{object}</b>'
    },
    reviewApproved: {
        id: 'activity.sentence.review.approved',
        defaultMessage: '<b>{actor}</b> approved a version of <b>{object}</b>'
    },
    reviewChangesRequested: {
        id: 'activity.sentence.review.changes_requested',
        defaultMessage: '<b>{actor}</b> requested changes to <b>{object}</b>'
    },
    protectionRuleChanged: {
        id: 'activity.sentence.protection.rule_changed',
        defaultMessage: '<b>{actor}</b> changed <b>{object}</b>'
    },
    entryPublishBypassed: {
        id: 'activity.sentence.entry.publish_bypassed',
        defaultMessage:
            '<b>{actor}</b> published <b>{object}</b> without review'
    },
    outboxEventRetried: {
        id: 'activity.sentence.outbox.event_retried',
        defaultMessage: '<b>{actor}</b> retried <b>{object}</b>'
    }
});

/** The feed sentence for every known kind — see {@link sentenceMessages}. */
export const SENTENCE_MESSAGES: Record<ActivityKind, MessageDescriptor> = {
    'user.invited': sentenceMessages.invited,
    'user.invite_resent': sentenceMessages.inviteResent,
    'user.invite_revoked': sentenceMessages.inviteRevoked,
    'user.password_reset_issued': sentenceMessages.passwordResetIssued,
    'user.invite_link_revealed': sentenceMessages.inviteLinkRevealed,
    'user.activated': sentenceMessages.activated,
    'user.profile_updated': sentenceMessages.profileUpdated,
    'user.role_changed': sentenceMessages.roleChanged,
    'user.suspended': sentenceMessages.suspended,
    'user.reactivated': sentenceMessages.reactivated,
    'user.password_changed': sentenceMessages.passwordChanged,
    'user.signed_in': sentenceMessages.signedIn,
    'user.signed_out': sentenceMessages.signedOut,
    'user.sign_in_failed': sentenceMessages.signInFailed,
    'user.session_revoked': sentenceMessages.sessionRevoked,
    'user.sso_linked': sentenceMessages.ssoLinked,
    'user.sso_provisioned': sentenceMessages.ssoProvisioned,
    'user.sso_role_mapped': sentenceMessages.ssoRoleMapped,
    'workspace.created': sentenceMessages.workspaceCreated,
    'workspace.updated': sentenceMessages.workspaceUpdated,
    'workspace.archived': sentenceMessages.workspaceArchived,
    'workspace.unarchived': sentenceMessages.workspaceUnarchived,
    'workspace.deleted': sentenceMessages.workspaceDeleted,
    'workspace.member_added': sentenceMessages.workspaceMemberAdded,
    'workspace.member_removed': sentenceMessages.workspaceMemberRemoved,
    'workspace.content_granted': sentenceMessages.workspaceContentGranted,
    'workspace.content_revoked': sentenceMessages.workspaceContentRevoked,
    'entry.created': sentenceMessages.entryCreated,
    'entry.updated': sentenceMessages.entryUpdated,
    'entry.published': sentenceMessages.entryPublished,
    'entry.unpublished': sentenceMessages.entryUnpublished,
    'entry.deleted': sentenceMessages.entryDeleted,
    'entry.restored': sentenceMessages.entryRestored,
    'entry.purged': sentenceMessages.entryPurged,
    'token.created': sentenceMessages.tokenCreated,
    'token.revoked': sentenceMessages.tokenRevoked,
    'token.used': sentenceMessages.tokenUsed,
    'media.asset.uploaded': sentenceMessages.assetUploaded,
    'media.asset.updated': sentenceMessages.assetUpdated,
    'media.asset.moved': sentenceMessages.assetMoved,
    'media.asset.deleted': sentenceMessages.assetDeleted,
    'media.folder.created': sentenceMessages.folderCreated,
    'media.folder.renamed': sentenceMessages.folderRenamed,
    'media.folder.deleted': sentenceMessages.folderDeleted,
    'transfer.content.exported': sentenceMessages.contentExported,
    'transfer.content.imported': sentenceMessages.contentImported,
    'segment.created': sentenceMessages.segmentCreated,
    'segment.updated': sentenceMessages.segmentUpdated,
    'segment.deleted': sentenceMessages.segmentDeleted,
    'segment.entry_access_changed': sentenceMessages.entryAccessChanged,
    'alarm.rule.created': sentenceMessages.alarmRuleCreated,
    'alarm.rule.updated': sentenceMessages.alarmRuleUpdated,
    'alarm.rule.deleted': sentenceMessages.alarmRuleDeleted,
    'alarm.rule.rescanned': sentenceMessages.alarmRuleRescanned,
    'saved_view.created': sentenceMessages.savedViewCreated,
    'saved_view.updated': sentenceMessages.savedViewUpdated,
    'saved_view.deleted': sentenceMessages.savedViewDeleted,
    'copilot.skill.created': sentenceMessages.skillCreated,
    'copilot.skill.updated': sentenceMessages.skillUpdated,
    'copilot.skill.deleted': sentenceMessages.skillDeleted,
    'copilot.tool_permission.decided': sentenceMessages.toolPermissionDecided,
    'review.requested': sentenceMessages.reviewRequested,
    'review.approved': sentenceMessages.reviewApproved,
    'review.changes_requested': sentenceMessages.reviewChangesRequested,
    'protection.rule_changed': sentenceMessages.protectionRuleChanged,
    'entry.publish_bypassed': sentenceMessages.entryPublishBypassed,
    'outbox.event_retried': sentenceMessages.outboxEventRetried
};

/**
 * What a sentence says when the row names its subject nowhere — the noun for
 * the subject type, in running text ("changed the role of **a member**").
 */
const nounMessages = defineMessages({
    user: { id: 'activity.noun.user', defaultMessage: 'a member' },
    workspace: { id: 'activity.noun.workspace', defaultMessage: 'a workspace' },
    contentEntry: {
        id: 'activity.noun.content_entry',
        defaultMessage: 'an entry'
    },
    contentType: {
        id: 'activity.noun.content_type',
        defaultMessage: 'a content type'
    },
    apiToken: { id: 'activity.noun.api_token', defaultMessage: 'a token' },
    mediaAsset: { id: 'activity.noun.media_asset', defaultMessage: 'an asset' },
    mediaFolder: {
        id: 'activity.noun.media_folder',
        defaultMessage: 'a folder'
    },
    loginAttempt: {
        id: 'activity.noun.login_attempt',
        defaultMessage: 'an account'
    },
    segment: { id: 'activity.noun.segment', defaultMessage: 'an audience' },
    alarmRule: { id: 'activity.noun.alarm_rule', defaultMessage: 'a check' },
    savedView: { id: 'activity.noun.saved_view', defaultMessage: 'a view' },
    copilotSkill: {
        id: 'activity.noun.copilot_skill',
        defaultMessage: 'a copilot skill'
    },
    copilotRun: {
        id: 'activity.noun.copilot_run',
        defaultMessage: 'a copilot run'
    },
    protectionRule: {
        id: 'activity.noun.protection_rule',
        defaultMessage: 'a protection rule'
    },
    outboxEvent: {
        id: 'activity.noun.outbox_event',
        defaultMessage: 'a stuck event'
    },
    unknown: { id: 'activity.noun.unknown', defaultMessage: 'something' }
});

/** The running-text noun for every known subject type. */
export const SUBJECT_NOUN_MESSAGES: Record<
    ActivitySubjectType,
    MessageDescriptor
> = {
    user: nounMessages.user,
    workspace: nounMessages.workspace,
    content_entry: nounMessages.contentEntry,
    content_type: nounMessages.contentType,
    api_token: nounMessages.apiToken,
    media_asset: nounMessages.mediaAsset,
    media_folder: nounMessages.mediaFolder,
    login_attempt: nounMessages.loginAttempt,
    segment: nounMessages.segment,
    alarm_rule: nounMessages.alarmRule,
    saved_view: nounMessages.savedView,
    copilot_skill: nounMessages.copilotSkill,
    copilot_run: nounMessages.copilotRun,
    protection_rule: nounMessages.protectionRule,
    outbox_event: nounMessages.outboxEvent
};

/** The actor's name when there is none. */
const actorMessages = defineMessages({
    system: { id: 'activity.sentence.system', defaultMessage: 'System' }
});

/**
 * The `meta` keys that name a subject, in the order the server's
 * `subjectLabelOf` reads them. Used only for a row the server wrote before it
 * froze `subjectLabel`, so an older row still reads as a sentence.
 */
const LABEL_KEYS = ['title', 'name', 'label', 'email', 'key', 'slug'] as const;

/** Reads a non-blank string field off the open `meta` record. */
function metaString(
    meta: Record<string, unknown> | null,
    key: string
): string | null {
    const value = meta?.[key];
    return typeof value === 'string' && value.trim() !== ''
        ? value.trim()
        : null;
}

/**
 * The readable name of what an event was done to, or `null` when the row
 * names it nowhere. The server's frozen `subjectLabel` first; then the same
 * `meta` keys it reads (for rows written before the column); then, for a
 * content type, its id — a type's id **is** its slug, which reads.
 */
export function activityObjectName(event: ActivityEvent): string | null {
    if (event.subjectLabel && event.subjectLabel.trim() !== '') {
        return event.subjectLabel;
    }
    for (const key of LABEL_KEYS) {
        const value = metaString(event.meta, key);
        if (value) return value;
    }
    if (event.subjectType === 'content_type' && event.subjectId) {
        return event.subjectId;
    }
    return null;
}

/** The new value a role-shaped kind carries, or `null`. */
function roleOf(event: ActivityEvent): string | null {
    switch (event.kind) {
        case 'user.role_changed':
            return metaString(event.meta, 'to');
        case 'user.sso_provisioned':
        case 'user.sso_role_mapped':
            return metaString(event.meta, 'role');
        default:
            return null;
    }
}

/**
 * A role key as a reader says it: `admin` → "Admin". Role keys are machine
 * tokens the server owns and the admin cannot localize, so this only fixes the
 * case — a custom role named in the server's catalogue reads as it was named.
 */
export function formatRole(role: string): string {
    return role.charAt(0).toUpperCase() + role.slice(1);
}

/** The values one feed sentence is formatted with — see {@link sentenceMessages}. */
export type SentenceValues = {
    actor: string;
    object: string;
    to: string;
    hasTo: 'yes' | 'no';
    origin: string;
    hasOrigin: 'yes' | 'no';
    /**
     * Whether `object` is the subject's own name or only the noun for its
     * type — "archived the workspace **Marketing**" against "archived **a
     * workspace**", never "the workspace a workspace".
     */
    named: 'yes' | 'no';
};

/** Who did it, as the sentence names them. */
export function actorName(intl: IntlShape, event: ActivityEvent): string {
    return event.actor?.email ?? intl.formatMessage(actorMessages.system);
}

/**
 * Everything a sentence needs, except the markup — pure apart from the
 * formatter, so the choice of object and role is unit-tested.
 */
export function sentenceValues(
    intl: IntlShape,
    event: ActivityEvent
): SentenceValues {
    const noun =
        SUBJECT_NOUN_MESSAGES[event.subjectType as ActivitySubjectType] ??
        nounMessages.unknown;
    const to = roleOf(event);
    const origin = metaString(event.meta, 'ipAddress');
    const name = activityObjectName(event);
    return {
        actor: actorName(intl, event),
        object: name ?? intl.formatMessage(noun),
        named: name ? 'yes' : 'no',
        to: to ? formatRole(to) : '',
        hasTo: to ? 'yes' : 'no',
        origin: origin ?? '',
        hasOrigin: origin ? 'yes' : 'no'
    };
}

/**
 * The sentence descriptor for an event's kind, or `null` for a kind this
 * admin does not know — the feed then falls back to the action label, which
 * itself falls back to the raw kind, so the row still says *something*.
 */
export function sentenceDescriptor(kind: string): MessageDescriptor | null {
    return SENTENCE_MESSAGES[kind as ActivityKind] ?? null;
}

/** The colour family of a feed row's action tile. */
export type ActivityTone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

/**
 * Kinds that are not what their last segment suggests. Checked first.
 */
const TONE_OVERRIDES: Partial<Record<ActivityKind, ActivityTone>> = {
    'entry.published': 'success',
    'entry.restored': 'success',
    'entry.unpublished': 'warning',
    'entry.publish_bypassed': 'warning',
    'review.approved': 'success',
    'review.changes_requested': 'warning',
    'review.requested': 'info',
    'token.created': 'warning',
    'token.used': 'muted',
    'user.password_reset_issued': 'warning',
    'user.invite_link_revealed': 'warning',
    'user.session_revoked': 'warning',
    'user.sign_in_failed': 'danger',
    'user.suspended': 'danger',
    'user.reactivated': 'success',
    'user.activated': 'success',
    'user.role_changed': 'info',
    'workspace.archived': 'warning',
    'workspace.unarchived': 'success',
    'workspace.member_added': 'info',
    'workspace.member_removed': 'danger',
    'workspace.content_granted': 'info',
    'segment.entry_access_changed': 'info',
    'protection.rule_changed': 'warning',
    'outbox.event_retried': 'muted',
    'copilot.tool_permission.decided': 'info'
};

/**
 * The tone of a kind's tile: green for something made or put live, red for
 * something removed or refused, amber for an access-shaped action worth a
 * second look, blue for people and permissions, grey for everything routine.
 * Colour is never the only signal — the sentence says the same thing in words.
 */
export function activityTone(kind: string): ActivityTone {
    const override = TONE_OVERRIDES[kind as ActivityKind];
    if (override) return override;
    const verb = kind.slice(kind.lastIndexOf('.') + 1);
    if (/^(created|uploaded|imported)$/.test(verb)) return 'success';
    if (/^(deleted|purged|revoked|invite_revoked|content_revoked)$/.test(verb))
        return 'danger';
    if (
        /^(invited|invite_resent|sso_linked|sso_provisioned|sso_role_mapped)$/.test(
            verb
        )
    )
        return 'info';
    return 'muted';
}
