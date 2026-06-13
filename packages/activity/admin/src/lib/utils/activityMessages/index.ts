import {
    defineMessages,
    type IntlShape,
    type MessageDescriptor
} from 'react-intl';
import {
    ACTIVITY_KINDS,
    type ActivityKind,
    type ActivityMetaMap
} from '@ortha-cms/activity-contract';
import type { ActivityEvent } from '../../types/activityEvent';

/**
 * Human-readable "Action" labels, one per {@link ActivityKind}. Co-located
 * `defineMessages` keyed by the kind so the table never hardcodes a label —
 * the contract's catalogue is the single source of truth, and a new kind
 * surfaces here as a type error until it has a label.
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
    }
});

/** The "Action" label descriptor for every kind. */
export const ACTION_MESSAGES: Record<ActivityKind, MessageDescriptor> = {
    [ACTIVITY_KINDS.USER_INVITED]: actionMessages.invited,
    [ACTIVITY_KINDS.USER_INVITE_RESENT]: actionMessages.inviteResent,
    [ACTIVITY_KINDS.USER_INVITE_REVOKED]: actionMessages.inviteRevoked,
    [ACTIVITY_KINDS.USER_PROFILE_UPDATED]: actionMessages.profileUpdated,
    [ACTIVITY_KINDS.USER_ROLE_CHANGED]: actionMessages.roleChanged,
    [ACTIVITY_KINDS.USER_SUSPENDED]: actionMessages.suspended,
    [ACTIVITY_KINDS.USER_REACTIVATED]: actionMessages.reactivated,
    [ACTIVITY_KINDS.USER_SIGNED_IN]: actionMessages.signedIn,
    [ACTIVITY_KINDS.USER_SIGNED_OUT]: actionMessages.signedOut,
    [ACTIVITY_KINDS.WORKSPACE_CREATED]: actionMessages.workspaceCreated,
    [ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED]: actionMessages.workspaceMemberAdded,
    [ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED]:
        actionMessages.workspaceMemberRemoved
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

/** The "Action" label for an event. */
export function formatActivityAction(
    intl: IntlShape,
    kind: ActivityKind
): string {
    return intl.formatMessage(ACTION_MESSAGES[kind]);
}

/**
 * The "Details" string for an event, derived from its typed `meta`. Returns an
 * empty string for kinds that carry no extra payload (sign-in/out, suspend,
 * reactivate), which the cell renders as a muted dash.
 */
export function formatActivityDetails(
    intl: IntlShape,
    event: ActivityEvent
): string {
    const meta = event.meta;
    switch (event.kind) {
        case ACTIVITY_KINDS.USER_INVITED:
        case ACTIVITY_KINDS.USER_INVITE_RESENT:
        case ACTIVITY_KINDS.USER_INVITE_REVOKED:
            return (meta as ActivityMetaMap['user.invited'] | null)?.email ?? '';
        case ACTIVITY_KINDS.USER_ROLE_CHANGED: {
            const role = meta as ActivityMetaMap['user.role_changed'] | null;
            return role
                ? intl.formatMessage(detailMessages.roleChanged, {
                      from: role.from,
                      to: role.to
                  })
                : '';
        }
        case ACTIVITY_KINDS.USER_PROFILE_UPDATED:
            return intl.formatMessage(detailMessages.nameUpdated);
        case ACTIVITY_KINDS.WORKSPACE_CREATED:
            return (meta as ActivityMetaMap['workspace.created'] | null)?.name ?? '';
        case ACTIVITY_KINDS.WORKSPACE_MEMBER_ADDED:
        case ACTIVITY_KINDS.WORKSPACE_MEMBER_REMOVED:
            return (
                (meta as ActivityMetaMap['workspace.member_added'] | null)
                    ?.email ?? ''
            );
        default:
            return '';
    }
}
