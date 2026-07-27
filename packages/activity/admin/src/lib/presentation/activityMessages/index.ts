import {
    defineMessages,
    type IntlShape,
    type MessageDescriptor
} from 'react-intl';
import type { ActivityEvent } from '../../types/activityEvent';
import type { ActivityKind } from '../../types/activityKinds';

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
    workspaceMemberAdded: {
        id: 'activity.action.workspace.member_added',
        defaultMessage: 'Added workspace member'
    },
    workspaceMemberRemoved: {
        id: 'activity.action.workspace.member_removed',
        defaultMessage: 'Removed workspace member'
    },
    entryPublished: {
        id: 'activity.action.entry.published',
        defaultMessage: 'Published content'
    },
    entryUnpublished: {
        id: 'activity.action.entry.unpublished',
        defaultMessage: 'Unpublished content'
    }
});

/** The "Action" label descriptor for every known kind. */
export const ACTION_MESSAGES: Record<ActivityKind, MessageDescriptor> = {
    'user.invited': actionMessages.invited,
    'user.invite_resent': actionMessages.inviteResent,
    'user.invite_revoked': actionMessages.inviteRevoked,
    'user.profile_updated': actionMessages.profileUpdated,
    'user.role_changed': actionMessages.roleChanged,
    'user.suspended': actionMessages.suspended,
    'user.reactivated': actionMessages.reactivated,
    'user.signed_in': actionMessages.signedIn,
    'user.signed_out': actionMessages.signedOut,
    'workspace.created': actionMessages.workspaceCreated,
    'workspace.member_added': actionMessages.workspaceMemberAdded,
    'workspace.member_removed': actionMessages.workspaceMemberRemoved,
    'entry.published': actionMessages.entryPublished,
    'entry.unpublished': actionMessages.entryUnpublished
};

/** Detail-template descriptors for the kinds that render a "Details" string. */
const detailMessages = defineMessages({
    roleChanged: {
        id: 'activity.details.user.role_changed',
        defaultMessage: '{from} → {to}'
    },
    nameUpdated: {
        id: 'activity.details.user.profile_updated',
        defaultMessage: 'Name changed'
    }
});

/** Reads a string field off the open `meta` record, or `''` when absent. */
function metaStr(meta: Record<string, unknown> | null, key: string): string {
    const value = meta?.[key];
    return typeof value === 'string' ? value : '';
}

/** The "Action" label for an event; unknown kinds fall back to the raw kind. */
export function formatActivityAction(intl: IntlShape, kind: string): string {
    const descriptor = ACTION_MESSAGES[kind as ActivityKind];
    return descriptor ? intl.formatMessage(descriptor) : kind;
}

/**
 * A short "Details" summary for an event, derived from its open `meta`. Returns
 * an empty string for kinds that carry no extra payload (sign-in/out, suspend,
 * reactivate), which the row renders as a muted dash.
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
                ? intl.formatMessage(detailMessages.roleChanged, { from, to })
                : '';
        }
        case 'user.profile_updated':
            return intl.formatMessage(detailMessages.nameUpdated);
        case 'workspace.created':
            return metaStr(meta, 'name');
        case 'workspace.member_added':
        case 'workspace.member_removed':
            return metaStr(meta, 'email') || metaStr(meta, 'userId');
        case 'entry.published':
        case 'entry.unpublished':
            // The entry's content type — what was published, without the log
            // having to join anything to say it.
            return metaStr(meta, 'contentType');
        default:
            return '';
    }
}
