import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import { Badge, Button } from '@ortha-cms/design-system';
import type { WorkspaceMember } from '../../../types/workspace';
import { WorkspaceAvatar } from '../../WorkspaceAvatar';

const messages = defineMessages({
    owner: {
        id: 'workspaces.settings.members.ownerBadge',
        defaultMessage: 'Owner'
    },
    remove: {
        id: 'workspaces.settings.members.remove',
        defaultMessage: 'Remove {name}'
    }
});

/** Props for {@link MemberListRow}. */
export type MemberListRowProps = {
    /** The member to render. */
    member: WorkspaceMember;
    /** Whether this member is the workspace owner (first member). */
    isOwner: boolean;
    /** Whether a remove control should be offered. */
    canRemove: boolean;
    /** Called when the remove control is pressed. */
    onRemove: () => void;
};

/**
 * One row in the members roster: avatar, name, email, and either an Owner badge
 * (the owner can't be removed) or a remove button when the current user may
 * manage members.
 */
export function MemberListRow({
    member,
    isOwner,
    canRemove,
    onRemove
}: MemberListRowProps) {
    const intl = useIntl();

    return (
        <div className="flex items-center gap-3 px-3 py-2">
            <WorkspaceAvatar
                className="size-9 text-xs"
                initials={member.initials || '—'}
                color={member.color}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">
                    {member.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {member.email}
                </span>
            </div>
            {isOwner ? (
                <Badge>{intl.formatMessage(messages.owner)}</Badge>
            ) : canRemove ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onRemove}
                    aria-label={intl.formatMessage(messages.remove, {
                        name: member.name
                    })}
                >
                    <X className="size-4" />
                </Button>
            ) : null}
        </div>
    );
}
