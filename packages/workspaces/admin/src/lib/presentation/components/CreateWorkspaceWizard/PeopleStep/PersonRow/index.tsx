import { defineMessages, useIntl } from 'react-intl';
import { Mail, X } from 'lucide-react';
import { Badge, Button, type AvatarColor } from '@orthacms/design-system';
import { initialsOf } from '@orthacms/utils-admin';
import { WorkspaceAvatar } from '../../../WorkspaceAvatar';

const messages = defineMessages({
    invite: {
        id: 'workspaces.create.people.inviteBadge',
        defaultMessage: 'Invite'
    },
    inviteHint: {
        id: 'workspaces.create.people.inviteHint',
        defaultMessage: 'Gets an invite when the workspace is created'
    },
    inviteHintWaits: {
        id: 'workspaces.create.people.inviteHintWaits',
        defaultMessage:
            'Added as a pending account; someone who can invite sends it from Members'
    },
    remove: {
        id: 'workspaces.create.people.remove',
        defaultMessage: 'Remove {name}'
    }
});

/** Props for {@link PersonRow}. */
export type PersonRowProps = {
    /** Display name (the address, for an invite). */
    name: string;
    /** Email address. */
    email: string;
    /** Avatar tint. */
    color: AvatarColor;
    /** An invite by email rather than an existing account. */
    invited?: boolean;
    /** Whether the creator may issue invitations (`users:create`). */
    canInvite?: boolean;
    /** The badge on the right — the person's role, or "You". */
    badge?: string;
    /** Removes the person; omitted for the creator, who is always in. */
    onRemove?: () => void;
};

/**
 * One person in the "who works here" list, saying what will happen to them:
 * an existing account with its global role, or an address that gets an
 * invitation when the workspace is created.
 */
export function PersonRow({
    name,
    email,
    color,
    invited = false,
    canInvite = true,
    badge,
    onRemove
}: PersonRowProps) {
    const intl = useIntl();

    return (
        <li className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0">
            {invited ? (
                <Mail
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                />
            ) : (
                <span aria-hidden>
                    <WorkspaceAvatar
                        initials={initialsOf(name)}
                        color={color}
                        className="size-7 rounded-full text-[10px]"
                    />
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                    {invited ? email : name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {invited
                        ? intl.formatMessage(
                              canInvite
                                  ? messages.inviteHint
                                  : messages.inviteHintWaits
                          )
                        : email}
                </span>
            </span>
            {invited ? (
                <Badge variant="warning" size="xs">
                    {intl.formatMessage(messages.invite)}
                </Badge>
            ) : badge ? (
                <Badge variant="outline" size="xs">
                    {badge}
                </Badge>
            ) : null}
            {onRemove ? (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-7 shadow-none"
                    onClick={onRemove}
                    aria-label={intl.formatMessage(messages.remove, {
                        name: invited ? email : name
                    })}
                >
                    <X />
                </Button>
            ) : null}
        </li>
    );
}
