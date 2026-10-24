import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Globe, RotateCcw } from 'lucide-react';
import { initialsOf } from '@orthacms/utils-admin';
import { Badge, Button, cn } from '@orthacms/design-system';
import { WorkspaceAvatar } from '../../WorkspaceAvatar';
import { MemberFaces } from '../../MemberFaces';
import { useSinceLabel } from '../../../hooks/useSinceLabel';
import { isActiveWorkspace } from '../../../../domain/isActiveWorkspace';
import { contentTypeCount } from '../../../../domain/workspaceSummary';
import type { Workspace } from '../../../../domain/types/workspace';
import { WorkspaceCardMenu } from '../WorkspaceCardMenu';

const messages = defineMessages({
    records: {
        id: 'workspaces.card.records',
        defaultMessage:
            '{count, plural, one {<b>#</b> record} other {<b>#</b> records}}'
    },
    typeCount: {
        id: 'workspaces.card.contentTypes',
        defaultMessage:
            '{count, plural, one {<b>#</b> content type} other {<b>#</b> content types}}'
    },
    shared: { id: 'workspaces.card.shared', defaultMessage: 'Shared' },
    archived: { id: 'workspaces.card.archived', defaultMessage: 'Archived' },
    edited: {
        id: 'workspaces.card.edited',
        defaultMessage: 'Edited {when}'
    },
    archivedOn: {
        id: 'workspaces.card.archivedOn',
        defaultMessage: 'Archived {when}'
    },
    open: { id: 'workspaces.card.open', defaultMessage: 'Open' },
    settings: { id: 'workspaces.card.settings', defaultMessage: 'Settings' },
    restore: { id: 'workspaces.card.restore', defaultMessage: 'Restore' },
    openLabel: {
        id: 'workspaces.card.openLabel',
        defaultMessage: 'Open {name}'
    },
    settingsLabel: {
        id: 'workspaces.card.settingsLabel',
        defaultMessage: 'Settings for {name}'
    },
    restoreLabel: {
        id: 'workspaces.card.restoreLabel',
        defaultMessage: 'Restore {name}'
    }
});

/** Props for {@link WorkspaceCard}. */
export type WorkspaceCardProps = {
    workspace: Workspace;
    /** Just created — the card flashes once. */
    justCreated: boolean;
    /** Whether the user may archive/restore (`workspaces:update`). */
    canUpdate: boolean;
    /** Asks to archive this workspace (the list confirms). */
    onArchive: () => void;
    /** Restores this archived workspace. */
    onRestore: () => void;
    /** Whether a status change for this workspace is in flight. */
    statusPending: boolean;
};

/**
 * One workspace in the grid, saying what is inside: its tile and name (the
 * card's link, with a Shared or Archived badge), when it last moved, its
 * description, how many records and content types it holds, who is in it as
 * faces, and the ways in — Open and Settings, or Restore once archived. The ⋯
 * menu carries the same plus Archive. A click anywhere else on the card opens
 * it too, for the mouse, without adding a tab stop.
 */
export function WorkspaceCard({
    workspace,
    justCreated,
    canUpdate,
    onArchive,
    onRestore,
    statusPending
}: WorkspaceCardProps) {
    const intl = useIntl();
    const navigate = useNavigate();
    const since = useSinceLabel();
    const archived = !isActiveWorkspace(workspace);
    const to = `/workspaces/${workspace.id}`;
    const bold = (chunks: ReactNode[]) => (
        <b key="b" className="font-semibold text-foreground">{chunks}</b>
    );

    const when = archived ? workspace.archivedAt : workspace.lastEditedAt;
    const whenLabel = when
        ? intl.formatMessage(archived ? messages.archivedOn : messages.edited, {
              when: since(when)
          })
        : null;

    return (
        <li
            onClick={() => navigate(to)}
            className={cn(
                'flex cursor-pointer flex-col rounded-xl border bg-card transition-colors hover:border-foreground/20',
                archived && 'bg-muted/40',
                justCreated && 'ds-flash'
            )}
        >
            <div className="flex flex-1 flex-col gap-3 p-3.5">
                <div className="flex items-start gap-2.5">
                    <WorkspaceAvatar
                        initials={initialsOf(workspace.name)}
                        color={archived ? 'slate' : workspace.color}
                        className="size-9 shrink-0 rounded-[9px] text-[15px]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <Link
                                to={to}
                                className="truncate text-sm font-semibold hover:underline focus-visible:underline"
                                onClick={(event) => event.stopPropagation()}
                            >
                                {workspace.name}
                            </Link>
                            {workspace.isShared && !archived ? (
                                <Badge variant="info" size="xs">
                                    <Globe aria-hidden />
                                    {intl.formatMessage(messages.shared)}
                                </Badge>
                            ) : null}
                            {archived ? (
                                <Badge variant="secondary" size="xs">
                                    {intl.formatMessage(messages.archived)}
                                </Badge>
                            ) : null}
                        </div>
                        {whenLabel ? (
                            <span className="text-xs text-muted-foreground">
                                {whenLabel}
                            </span>
                        ) : null}
                    </div>
                    <span onClick={(event) => event.stopPropagation()}>
                        <WorkspaceCardMenu
                            name={workspace.name}
                            to={to}
                            archived={archived}
                            canUpdate={canUpdate}
                            onArchive={onArchive}
                            onRestore={onRestore}
                        />
                    </span>
                </div>

                {workspace.description ? (
                    <p className="line-clamp-2 text-[13px] break-words text-muted-foreground">
                        {workspace.description}
                    </p>
                ) : null}

                <div className="mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
                    <span>
                        {intl.formatMessage(messages.records, {
                            count: workspace.recordCount,
                            b: bold
                        })}
                    </span>
                    <span>
                        {intl.formatMessage(messages.typeCount, {
                            count: contentTypeCount(workspace),
                            b: bold
                        })}
                    </span>
                    <MemberFaces
                        members={workspace.members}
                        className="ml-auto"
                    />
                </div>
            </div>

            <div
                className="flex gap-1.5 border-t px-3.5 py-2.5"
                onClick={(event) => event.stopPropagation()}
            >
                {archived ? (
                    canUpdate ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={statusPending}
                            onClick={onRestore}
                            aria-label={intl.formatMessage(
                                messages.restoreLabel,
                                { name: workspace.name }
                            )}
                        >
                            <RotateCcw aria-hidden />
                            {intl.formatMessage(messages.restore)}
                        </Button>
                    ) : (
                        <Button asChild variant="outline" size="sm">
                            <Link
                                to={to}
                                aria-label={intl.formatMessage(
                                    messages.openLabel,
                                    { name: workspace.name }
                                )}
                            >
                                {intl.formatMessage(messages.open)}
                            </Link>
                        </Button>
                    )
                ) : (
                    <>
                        <Button asChild variant="outline" size="sm">
                            <Link
                                to={to}
                                aria-label={intl.formatMessage(
                                    messages.openLabel,
                                    { name: workspace.name }
                                )}
                            >
                                {intl.formatMessage(messages.open)}
                            </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                            <Link
                                to={`${to}/settings`}
                                aria-label={intl.formatMessage(
                                    messages.settingsLabel,
                                    { name: workspace.name }
                                )}
                            >
                                {intl.formatMessage(messages.settings)}
                            </Link>
                        </Button>
                    </>
                )}
            </div>
        </li>
    );
}
