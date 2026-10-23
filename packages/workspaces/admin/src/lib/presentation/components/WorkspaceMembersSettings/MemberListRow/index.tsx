import { defineMessages, useIntl } from 'react-intl';
import { X } from 'lucide-react';
import { Badge, Button, cn } from '@orthacms/design-system';
import type { WorkspaceMember } from '../../../../domain/types/workspace';
import { WorkspaceAvatar } from '../../WorkspaceAvatar';

const messages = defineMessages({
    remove: {
        id: 'workspaces.settings.members.remove',
        defaultMessage: 'Remove {name}'
    },
    you: {
        id: 'workspaces.settings.members.you',
        defaultMessage: 'You'
    }
});

/** Props for {@link MemberListRow}. */
export type MemberListRowProps = {
    /** The member to render. */
    member: WorkspaceMember;
    /** The signed-in person's own row. */
    isYou?: boolean;
    /** Whether a remove control should be offered. */
    canRemove: boolean;
    /** Called when the remove control is pressed. */
    onRemove: () => void;
    /** Extra classes for the row (the roster's just-added highlight). */
    className?: string;
};

/**
 * One row in the members roster: avatar, name, email, and — when the current
 * user may manage members — a remove button. Access is permission-based, so no
 * member is special.
 */
export function MemberListRow({
    member,
    isYou = false,
    canRemove,
    onRemove,
    className
}: MemberListRowProps) {
    const intl = useIntl();

    return (
        <div
            className={cn(
                'flex min-h-[52px] items-center gap-3 px-4 py-2',
                className
            )}
        >
            <WorkspaceAvatar
                className="size-7 rounded-full text-[11px]"
                initials={member.initials || '—'}
                color={member.color}
            />
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-medium">
                        {member.name}
                    </span>
                    {isYou ? (
                        <Badge variant="muted" size="xs">
                            {intl.formatMessage(messages.you)}
                        </Badge>
                    ) : null}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                    {member.email}
                </span>
            </div>
            {canRemove ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    // Marks this as the roster's focus target: removing a member
                    // destroys the button focus would otherwise return to, so
                    // the list finds the next one by this attribute.
                    data-remove-member=""
                    // …and identifies *which* row, so a dismissed dialog can
                    // hand focus back to the one that opened it.
                    data-member-id={member.id}
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
