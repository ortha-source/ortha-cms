import { defineMessages, useIntl } from 'react-intl';
import { Button, Checkbox, Skeleton, cn } from '@orthacms/design-system';
import type { WorkspaceOption } from '../../../../domain/types/workspaceOption';
import { MemberAvatar } from '../../MemberAvatar';

/** Intl descriptors for {@link WorkspaceTiles}, co-located. */
const messages = defineMessages({
    allHint: {
        id: 'users.inviteSheet.allWorkspacesHint',
        defaultMessage: 'Or <all>all workspaces</all> — new ones not included.'
    },
    none: {
        id: 'users.inviteSheet.noWorkspaces',
        defaultMessage:
            'There are no workspaces yet. Invite now and add them to one later.'
    },
    failed: {
        id: 'users.inviteSheet.workspacesFailed',
        defaultMessage: 'Couldn’t load workspaces.'
    },
    retry: {
        id: 'users.inviteSheet.workspacesRetry',
        defaultMessage: 'Try again'
    },
    loading: {
        id: 'users.inviteSheet.workspacesLoading',
        defaultMessage: 'Loading workspaces…'
    }
});

/**
 * The invite sheet's workspaces: a two-column grid of checkbox tiles (the
 * workspace's colour tile and name), and a shortcut that ticks every
 * workspace that exists today. It says plainly that a workspace created later
 * is not included — access is by membership, so "all" is a snapshot.
 */
export function WorkspaceTiles({
    options,
    loading,
    failed,
    selected,
    disabled = false,
    onToggle,
    onSelectAll,
    onRetry
}: {
    /** Every workspace, once loaded. */
    options: WorkspaceOption[];
    /** Whether the list is still loading. */
    loading: boolean;
    /** Whether loading failed. */
    failed: boolean;
    /** The ticked workspace ids. */
    selected: ReadonlySet<string>;
    /** Locks the tiles (while sending). */
    disabled?: boolean;
    /** Ticks or unticks one workspace. */
    onToggle: (id: string) => void;
    /** Ticks every workspace. */
    onSelectAll: () => void;
    /** Retries a failed load. */
    onRetry: () => void;
}) {
    const intl = useIntl();

    if (loading) {
        return (
            <div
                role="status"
                aria-label={intl.formatMessage(messages.loading)}
                className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            >
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
            </div>
        );
    }

    if (failed) {
        return (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{intl.formatMessage(messages.failed)}</span>
                <Button variant="outline" size="sm" onClick={onRetry}>
                    {intl.formatMessage(messages.retry)}
                </Button>
            </div>
        );
    }

    if (options.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.none)}
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {options.map((option) => {
                    const id = `invite-workspace-${option.id}`;
                    const on = selected.has(option.id);
                    return (
                        <label
                            key={option.id}
                            htmlFor={id}
                            className={cn(
                                'flex h-10 cursor-pointer items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors',
                                on
                                    ? 'border-foreground ring-1 ring-foreground'
                                    : 'hover:bg-muted/50',
                                disabled && 'cursor-not-allowed opacity-60'
                            )}
                        >
                            <Checkbox
                                id={id}
                                checked={on}
                                disabled={disabled}
                                onCheckedChange={() => onToggle(option.id)}
                            />
                            <MemberAvatar
                                initials={option.initials}
                                color={option.color}
                                className="size-5 shrink-0 rounded-[5px] text-[9px]"
                            />
                            <span className="truncate">{option.name}</span>
                        </label>
                    );
                })}
            </div>
            <p className="text-[13px] text-muted-foreground">
                {intl.formatMessage(messages.allHint, {
                    all: (chunks) => (
                        <button
                            key="all"
                            type="button"
                            disabled={disabled}
                            onClick={onSelectAll}
                            className="rounded-sm text-foreground underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            {chunks}
                        </button>
                    )
                })}
            </p>
        </div>
    );
}
