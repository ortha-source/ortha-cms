import { defineMessages, useIntl } from 'react-intl';
import { Button, Spinner } from '@orthacms/design-system';
import { MemberAvatar } from '../MemberAvatar';
import type { MemberWorkspace } from '../../../domain/types/member';

/** Intl descriptors for {@link WorkspaceMembershipRow}. */
const messages = defineMessages({
    remove: {
        id: 'users.workspaces.remove',
        defaultMessage: 'Remove'
    },
    removeLabel: {
        id: 'users.workspaces.removeLabel',
        defaultMessage: 'Remove from {name}'
    }
});

/**
 * One workspace the member belongs to, as a compact ~44px list row: its
 * monogram, its name (the description, when there is one, one line beside it
 * with the full text as `title`), and — when the viewer can manage members — a
 * ghost **Remove** on the right. Removal is confirmed by the parent page, so
 * the row only signals intent. Rows sit in one bordered `divide-y` list, so a
 * member in thirty workspaces reads as a list, not a wall of cards.
 */
export function WorkspaceMembershipRow({
    workspace,
    onRemove,
    removing = false
}: {
    /** The workspace membership to render. */
    workspace: MemberWorkspace;
    /** Remove handler; omit to hide the action (read-only). */
    onRemove?: (workspace: MemberWorkspace) => void;
    /** Whether a removal for this workspace is in flight. */
    removing?: boolean;
}) {
    const intl = useIntl();

    return (
        <li className="flex min-h-11 items-center gap-3 px-4 py-1.5">
            <MemberAvatar
                initials={workspace.initials}
                color={workspace.color}
                className="size-6 shrink-0 rounded-md text-[10px]"
            />
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="shrink-0 truncate text-sm font-medium">
                    {workspace.name}
                </span>
                {workspace.description ? (
                    <span
                        className="min-w-0 truncate text-xs text-muted-foreground"
                        title={workspace.description}
                    >
                        {workspace.description}
                    </span>
                ) : null}
            </div>
            {onRemove ? (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-muted-foreground"
                    disabled={removing}
                    aria-label={intl.formatMessage(messages.removeLabel, {
                        name: workspace.name
                    })}
                    onClick={() => onRemove(workspace)}
                >
                    {removing ? <Spinner aria-hidden /> : null}
                    {intl.formatMessage(messages.remove)}
                </Button>
            ) : null}
        </li>
    );
}
