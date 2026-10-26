import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Archive, Ellipsis, RotateCcw } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@orthacms/design-system';

const messages = defineMessages({
    trigger: {
        id: 'workspaces.card.menu.trigger',
        defaultMessage: 'More for {name}'
    },
    open: { id: 'workspaces.card.menu.open', defaultMessage: 'Open' },
    settings: {
        id: 'workspaces.card.menu.settings',
        defaultMessage: 'Settings'
    },
    archive: {
        id: 'workspaces.card.menu.archive',
        defaultMessage: 'Archive…'
    },
    restore: { id: 'workspaces.card.menu.restore', defaultMessage: 'Restore' }
});

/** Props for {@link WorkspaceCardMenu}. */
export type WorkspaceCardMenuProps = {
    /** The workspace's name, for the trigger's accessible name. */
    name: string;
    /** Where the workspace opens. */
    to: string;
    /** Whether the workspace is archived (offers Restore, not Archive). */
    archived: boolean;
    /** Whether the user may archive/restore (`workspaces:update`). */
    canUpdate: boolean;
    /**
     * Asks to archive — the caller opens the confirmation, and is handed the
     * trigger so focus can come back to it when the confirmation closes (the
     * menu item that opened it no longer exists by then).
     */
    onArchive: (trigger: HTMLButtonElement | null) => void;
    /** Restores an archived workspace. */
    onRestore: () => void;
};

/**
 * The card's ⋯ menu: Open and Settings, then — for whoever may change its
 * status — Archive… (which confirms, with what it touches) or Restore.
 */
export function WorkspaceCardMenu({
    name,
    to,
    archived,
    canUpdate,
    onArchive,
    onRestore
}: WorkspaceCardMenuProps) {
    const intl = useIntl();
    const trigger = useRef<HTMLButtonElement>(null);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    ref={trigger}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    aria-label={intl.formatMessage(messages.trigger, { name })}
                >
                    <Ellipsis />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link to={to}>{intl.formatMessage(messages.open)}</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link to={`${to}/settings`}>
                        {intl.formatMessage(messages.settings)}
                    </Link>
                </DropdownMenuItem>
                {canUpdate ? (
                    <>
                        <DropdownMenuSeparator />
                        {archived ? (
                            <DropdownMenuItem onSelect={onRestore}>
                                <RotateCcw aria-hidden />
                                {intl.formatMessage(messages.restore)}
                            </DropdownMenuItem>
                        ) : (
                            <DropdownMenuItem
                                onSelect={() => onArchive(trigger.current)}
                            >
                                <Archive aria-hidden />
                                {intl.formatMessage(messages.archive)}
                            </DropdownMenuItem>
                        )}
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
