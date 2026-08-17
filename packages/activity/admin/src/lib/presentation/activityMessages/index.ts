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
 * Human-readable "Action" labels, one per known {@link ActivityKind}. The admin
 * restates the kind strings (it can't import the server plugins), so this map
 * is keyed by those literals; an unknown kind falls back to the raw string.
 */
const actionMessages = defineMessages({
    invited: {
        id: 'activity.action.user.invited',
        defaultMessage: 'Invited member'
    },
    inviteResent: {
        id: 'activity.action.user.invite_resent',
        defaultMessage: 'Resent invite'
    },
    inviteRevoked: {
        id: 'activity.action.user.invite_revoked',
        defaultMessage: 'Revoked invite'
    },
    activated: {
        id: 'activity.action.user.activated',
        defaultMessage: 'Activated account'
    },
    profileUpdated: {
        id: 'activity.action.user.profile_updated',
        defaultMessage: 'Updated profile'
    },
    roleChanged: {
        id: 'activity.action.user.role_changed',
        defaultMessage: 'Changed role'
    },
    suspended: {
        id: 'activity.action.user.suspended',
        defaultMessage: 'Suspended member'
    },
    reactivated: {
        id: 'activity.action.user.reactivated',
        defaultMessage: 'Reactivated member'
    },
    passwordChanged: {
        id: 'activity.action.user.password_changed',
        defaultMessage: 'Changed password'
    },
    signedIn: {
        id: 'activity.action.user.signed_in',
        defaultMessage: 'Signed in'
    },
    signedOut: {
        id: 'activity.action.user.signed_out',
        defaultMessage: 'Signed out'
    },
    workspaceCreated: {
        id: 'activity.action.workspace.created',
        defaultMessage: 'Created workspace'
    },
    workspaceUpdated: {
        id: 'activity.action.workspace.updated',
        defaultMessage: 'Updated workspace'
    },
    workspaceArchived: {
        id: 'activity.action.workspace.archived',
        defaultMessage: 'Archived workspace'
    },
    workspaceUnarchived: {
        id: 'activity.action.workspace.unarchived',
        defaultMessage: 'Restored workspace'
    },
    workspaceDeleted: {
        id: 'activity.action.workspace.deleted',
        defaultMessage: 'Deleted workspace'
    },
    workspaceMemberAdded: {
        id: 'activity.action.workspace.member_added',
        defaultMessage: 'Added workspace member'
    },
    workspaceMemberRemoved: {
        id: 'activity.action.workspace.member_removed',
        defaultMessage: 'Removed workspace member'
    },
    workspaceContentGranted: {
        id: 'activity.action.workspace.content_granted',
        defaultMessage: 'Granted content access'
    },
    workspaceContentRevoked: {
        id: 'activity.action.workspace.content_revoked',
        defaultMessage: 'Revoked content access'
    },
    entryPublished: {
        id: 'activity.action.entry.published',
        defaultMessage: 'Published content'
    },
    entryUnpublished: {
        id: 'activity.action.entry.unpublished',
        defaultMessage: 'Unpublished content'
    },
    tokenCreated: {
        id: 'activity.action.token.created',
        defaultMessage: 'Created API token'
    },
    tokenRevoked: {
        id: 'activity.action.token.revoked',
        defaultMessage: 'Revoked API token'
    },
    assetUploaded: {
        id: 'activity.action.media.asset.uploaded',
        defaultMessage: 'Uploaded asset'
    },
    assetUpdated: {
        id: 'activity.action.media.asset.updated',
        defaultMessage: 'Updated asset'
    },
    assetMoved: {
        id: 'activity.action.media.asset.moved',
        defaultMessage: 'Moved asset'
    },
    assetDeleted: {
        id: 'activity.action.media.asset.deleted',
        defaultMessage: 'Deleted asset'
    },
    folderCreated: {
        id: 'activity.action.media.folder.created',
        defaultMessage: 'Created folder'
    },
    folderRenamed: {
        id: 'activity.action.media.folder.renamed',
        defaultMessage: 'Renamed folder'
    },
    folderDeleted: {
        id: 'activity.action.media.folder.deleted',
        defaultMessage: 'Deleted folder'
    }
});

/**
 * The "Action" label descriptor for every known kind.
 *
 * Typed `Record<ActivityKind, …>` on purpose: adding a string to
 * `ACTIVITY_KINDS` without a label here is a **compile error**, so the two
 * halves of the catalogue cannot drift apart within this package. (The
 * server-side half is pinned by `apps/admin-e2e/src/activity/activity-kinds.spec.ts`.)
 */
export const ACTION_MESSAGES: Record<ActivityKind, MessageDescriptor> = {
    'user.invited': actionMessages.invited,
    'user.invite_resent': actionMessages.inviteResent,
    'user.invite_revoked': actionMessages.inviteRevoked,
    'user.activated': actionMessages.activated,
    'user.profile_updated': actionMessages.profileUpdated,
    'user.role_changed': actionMessages.roleChanged,
    'user.suspended': actionMessages.suspended,
    'user.reactivated': actionMessages.reactivated,
    'user.password_changed': actionMessages.passwordChanged,
    'user.signed_in': actionMessages.signedIn,
    'user.signed_out': actionMessages.signedOut,
    'workspace.created': actionMessages.workspaceCreated,
    'workspace.updated': actionMessages.workspaceUpdated,
    'workspace.archived': actionMessages.workspaceArchived,
    'workspace.unarchived': actionMessages.workspaceUnarchived,
    'workspace.deleted': actionMessages.workspaceDeleted,
    'workspace.member_added': actionMessages.workspaceMemberAdded,
    'workspace.member_removed': actionMessages.workspaceMemberRemoved,
    'workspace.content_granted': actionMessages.workspaceContentGranted,
    'workspace.content_revoked': actionMessages.workspaceContentRevoked,
    'entry.published': actionMessages.entryPublished,
    'entry.unpublished': actionMessages.entryUnpublished,
    'token.created': actionMessages.tokenCreated,
    'token.revoked': actionMessages.tokenRevoked,
    'media.asset.uploaded': actionMessages.assetUploaded,
    'media.asset.updated': actionMessages.assetUpdated,
    'media.asset.moved': actionMessages.assetMoved,
    'media.asset.deleted': actionMessages.assetDeleted,
    'media.folder.created': actionMessages.folderCreated,
    'media.folder.renamed': actionMessages.folderRenamed,
    'media.folder.deleted': actionMessages.folderDeleted
};

/** Display labels for the `subjectType` column's machine tokens. */
const subjectTypeMessages = defineMessages({
    user: { id: 'activity.subjectType.user', defaultMessage: 'User' },
    workspace: {
        id: 'activity.subjectType.workspace',
        defaultMessage: 'Workspace'
    },
    contentEntry: {
        id: 'activity.subjectType.content_entry',
        defaultMessage: 'Content entry'
    },
    apiToken: {
        id: 'activity.subjectType.api_token',
        defaultMessage: 'API token'
    },
    mediaAsset: {
        id: 'activity.subjectType.media_asset',
        defaultMessage: 'Media asset'
    },
    mediaFolder: {
        id: 'activity.subjectType.media_folder',
        defaultMessage: 'Media folder'
    }
});

/** The Subject-cell label descriptor for every known subject type. */
const SUBJECT_TYPE_MESSAGES: Record<ActivitySubjectType, MessageDescriptor> = {
    user: subjectTypeMessages.user,
    workspace: subjectTypeMessages.workspace,
    content_entry: subjectTypeMessages.contentEntry,
    api_token: subjectTypeMessages.apiToken,
    media_asset: subjectTypeMessages.mediaAsset,
    media_folder: subjectTypeMessages.mediaFolder
};

/** Detail-template descriptors for the kinds that render a "Details" string. */
const detailMessages = defineMessages({
    transition: {
        id: 'activity.details.transition',
        defaultMessage: '{from} → {to}'
    },
    fields: {
        id: 'activity.details.workspace.updated',
        defaultMessage: 'Changed {fields}'
    },
    contentGranted: {
        id: 'activity.details.workspace.content_granted',
        defaultMessage: '{slug} ({kind})'
    }
});

/** Reads a string field off the open `meta` record, or `''` when absent. */
function metaStr(meta: Record<string, unknown> | null, key: string): string {
    const value = meta?.[key];
    return typeof value === 'string' ? value : '';
}

/** Reads a `{ from, to }` transition off `meta[key]`, or `null` when absent. */
function metaTransition(
    meta: Record<string, unknown> | null,
    key: string
): { from: string; to: string } | null {
    const value = meta?.[key];
    if (!value || typeof value !== 'object') {
        return null;
    }
    const { from, to } = value as { from?: unknown; to?: unknown };
    if (typeof from !== 'string' && typeof to !== 'string') {
        return null;
    }
    return {
        from: typeof from === 'string' ? from : '',
        to: typeof to === 'string' ? to : ''
    };
}

/** The "Action" label for an event; unknown kinds fall back to the raw kind. */
export function formatActivityAction(intl: IntlShape, kind: string): string {
    const descriptor = ACTION_MESSAGES[kind as ActivityKind];
    return descriptor ? intl.formatMessage(descriptor) : kind;
}

/**
 * The Subject-cell type label; an unknown type falls back to the raw token so
 * the cell never goes blank on a subject type the server added since.
 */
export function formatActivitySubjectType(
    intl: IntlShape,
    subjectType: string
): string {
    const descriptor =
        SUBJECT_TYPE_MESSAGES[subjectType as ActivitySubjectType];
    return descriptor ? intl.formatMessage(descriptor) : subjectType;
}

/**
 * A short "Details" summary for an event, derived from its open `meta`. Returns
 * an empty string for kinds that carry no extra payload (sign-in/out, suspend,
 * reactivate, archive), and the row then omits the Details line entirely.
 *
 * The media kinds deliberately read **one** descriptive field each rather than
 * assuming a shared shape: media's payloads differ per kind by design (`name` +
 * `kind` on upload, only the changed field on update, `folderId` on move, the
 * storage key on delete), and the full record is always visible in the
 * expanded row's Metadata line.
 */
export function formatActivityDetails(
    intl: IntlShape,
    event: ActivityEvent
): string {
    const meta = event.meta;
    switch (event.kind) {
        case 'user.invited':
        case 'user.invite_resent':
        case 'user.invite_revoked':
            return metaStr(meta, 'email');
        case 'user.role_changed': {
            const from = metaStr(meta, 'from');
            const to = metaStr(meta, 'to');
            return from || to
                ? intl.formatMessage(detailMessages.transition, { from, to })
                : '';
        }
        case 'user.profile_updated': {
            // The server records the rename as `{ name: { from, to } }`
            // (`audit-event-mapping.ts`). This used to render the constant
            // "Name changed" and ignore the payload, so the one kind whose
            // details could name what actually changed said nothing.
            const name = metaTransition(meta, 'name');
            return name
                ? intl.formatMessage(detailMessages.transition, name)
                : '';
        }
        case 'workspace.created':
        case 'workspace.deleted':
            return metaStr(meta, 'name');
        case 'workspace.updated': {
            const fields = meta?.['fields'];
            return Array.isArray(fields) && fields.length > 0
                ? intl.formatMessage(detailMessages.fields, {
                      fields: fields.map(String).join(', ')
                  })
                : '';
        }
        case 'workspace.content_granted': {
            const slug = metaStr(meta, 'slug');
            const kind = metaStr(meta, 'kind');
            if (!slug) return '';
            return kind
                ? intl.formatMessage(detailMessages.contentGranted, {
                      slug,
                      kind
                  })
                : slug;
        }
        case 'workspace.content_revoked':
            return metaStr(meta, 'slug');
        case 'workspace.member_added':
        case 'workspace.member_removed':
            return metaStr(meta, 'email') || metaStr(meta, 'userId');
        case 'entry.published':
        case 'entry.unpublished':
            // The entry's content type — what was published, without the log
            // having to join anything to say it.
            return metaStr(meta, 'contentType');
        case 'token.created':
        case 'token.revoked':
            // The token's label — the same string the API Tokens page shows,
            // so a reader can match a log line to a row there. Never the
            // secret, which the server does not put on the event.
            return metaStr(meta, 'name');
        case 'media.asset.uploaded':
        case 'media.folder.created':
        case 'media.folder.renamed':
            return metaStr(meta, 'name');
        case 'media.asset.deleted':
            return metaStr(meta, 'storageKey');
        default:
            return '';
    }
}
