import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { initialsOf } from '@orthacms/utils-admin';
import { Badge, Button, cn } from '@orthacms/design-system';
import { WorkspaceAvatar } from '../../WorkspaceAvatar';
import { StatusChip } from '../../StatusChip';
import { isActiveWorkspace } from '../../../../domain/isActiveWorkspace';
import type { Workspace } from '../../../../domain/types/workspace';

const messages = defineMessages({
    memberCount: {
        id: 'workspaces.table.memberCount',
        defaultMessage: '{count, plural, one {# member} other {# members}}'
    },
    typeCount: {
        id: 'workspaces.card.typeCount',
        defaultMessage:
            '{count, plural, one {# content type} other {# content types}}'
    },
    shared: { id: 'workspaces.card.shared', defaultMessage: 'Shared' },
    open: { id: 'workspaces.card.open', defaultMessage: 'Open' },
    settings: { id: 'workspaces.card.settings', defaultMessage: 'Settings' },
    openLabel: {
        id: 'workspaces.card.openLabel',
        defaultMessage: 'Open {name}'
    },
    settingsLabel: {
        id: 'workspaces.card.settingsLabel',
        defaultMessage: 'Settings for {name}'
    }
});

/** How many member avatars a card stacks before the count says the rest. */
const AVATARS = 4;

type WorkspaceCardProps = {
    workspace: Workspace;
    /** Just created — the card flashes once. */
    justCreated: boolean;
};

/**
 * One workspace in the grid: its tile, name and description, who is in it and
 * how many content types it was granted, and the two ways in — Open and
 * Settings. The name is the card's link; a click anywhere else on the card
 * opens it too, for the mouse, without adding a tab stop.
 */
export function WorkspaceCard({ workspace, justCreated }: WorkspaceCardProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const archived = !isActiveWorkspace(workspace);
    const to = `/workspaces/${workspace.id}`;

    return (
        <li
            onClick={() => navigate(to)}
            className={cn(
                'flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20',
                archived && 'bg-muted/30',
                justCreated && 'ds-flash'
            )}
        >
            <div className="flex items-start gap-3">
                <WorkspaceAvatar
                    initials={initialsOf(workspace.name)}
                    color={workspace.color}
                    className="size-9 shrink-0 rounded-[9px] text-xs"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <Link
                            to={to}
                            className="truncate text-sm font-semibold hover:underline focus-visible:underline"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {workspace.name}
                        </Link>
                        {workspace.isShared ? (
                            <Badge variant="info" size="xs">
                                {intl.formatMessage(messages.shared)}
                            </Badge>
                        ) : null}
                        {archived ? (
                            <StatusChip status={workspace.status} />
                        ) : null}
                    </div>
                    {workspace.description ? (
                        <p className="line-clamp-2 text-xs break-words text-muted-foreground">
                            {workspace.description}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                {workspace.members.length > 0 ? (
                    <span aria-hidden className="flex">
                        {workspace.members.slice(0, AVATARS).map((member) => (
                            <WorkspaceAvatar
                                key={member.id}
                                initials={member.initials}
                                color={member.color}
                                className="-ml-1.5 size-[22px] rounded-full border-2 border-card text-[9px] first:ml-0"
                            />
                        ))}
                    </span>
                ) : null}
                <span>
                    {intl.formatMessage(messages.memberCount, {
                        count: workspace.members.length
                    })}
                </span>
                <span aria-hidden>·</span>
                <span>
                    {intl.formatMessage(messages.typeCount, {
                        count: workspace.content.length
                    })}
                </span>
            </div>

            <div
                className="-mx-4 -mb-4 flex gap-1.5 border-t px-4 py-2.5"
                onClick={(event) => event.stopPropagation()}
            >
                <Button asChild variant="outline" size="sm">
                    <Link
                        to={to}
                        aria-label={intl.formatMessage(messages.openLabel, {
                            name: workspace.name
                        })}
                    >
                        {intl.formatMessage(messages.open)}
                    </Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                    <Link
                        to={`${to}/settings`}
                        aria-label={intl.formatMessage(messages.settingsLabel, {
                            name: workspace.name
                        })}
                    >
                        {intl.formatMessage(messages.settings)}
                    </Link>
                </Button>
            </div>
        </li>
    );
}
