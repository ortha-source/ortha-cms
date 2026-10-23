import { useEffect, useRef } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Check,
    ChevronDown,
    Copy,
    Link2,
    Pencil,
    Star,
    Trash2,
    Users
} from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
    cn
} from '@orthacms/design-system';
import {
    VIEW_VISIBILITY,
    type SavedView
} from '../../../../domain/types/savedView';
import { ViewTab } from '../ViewTab';
import { TabRenameField } from './TabRenameField';

/** Intl descriptors for {@link SavedViewTab}, co-located. */
const messages = defineMessages({
    options: {
        id: 'content.views.tab.options',
        defaultMessage: 'Options for {name}'
    },
    personal: {
        id: 'content.views.tab.personal',
        defaultMessage: 'Personal view'
    },
    sharedBy: {
        id: 'content.views.tab.sharedHeading',
        defaultMessage: 'Shared with the workspace'
    },
    rename: { id: 'content.views.tab.rename', defaultMessage: 'Rename' },
    duplicate: {
        id: 'content.views.tab.duplicate',
        defaultMessage: 'Duplicate'
    },
    copyLink: { id: 'content.views.tab.copyLink', defaultMessage: 'Copy link' },
    makeDefault: {
        id: 'content.views.switcher.makeDefault',
        defaultMessage: 'Set as my default'
    },
    clearDefault: {
        id: 'content.views.switcher.clearDefault',
        defaultMessage: 'Clear my default'
    },
    share: {
        id: 'content.views.tab.share',
        defaultMessage: 'Shared with workspace'
    },
    delete: {
        id: 'content.views.tab.delete',
        defaultMessage: 'Delete view…'
    }
});

/** What a view's menu can do; each is wired by the switcher. */
export type SavedViewTabActions = {
    onRename: (view: SavedView, name: string) => Promise<boolean>;
    onDuplicate: (view: SavedView) => void;
    onCopyLink: (view: SavedView) => void;
    onSetDefault: (view: SavedView, isDefault: boolean) => void;
    /** Shares or un-shares; absent when the reader may not share. */
    onShare?: (view: SavedView, shared: boolean) => void;
    /** Asks to delete — the switcher owns the confirmation. */
    onDelete: (view: SavedView) => void;
};

/** Props for {@link SavedViewTab}. */
export type SavedViewTabProps = {
    view: SavedView;
    active: boolean;
    dirty: boolean;
    onSelect: () => void;
    /** Whether this view's menu is the one open. */
    menuOpen: boolean;
    onMenuOpenChange: (open: boolean) => void;
    /** Whether the tab is showing its name as a field. */
    renaming: boolean;
    onRenamingChange: (renaming: boolean) => void;
    actions: SavedViewTabActions;
};

/**
 * One saved view's tab **with its own menu on it** — the way Notion, Linear
 * and GitHub Projects carry a view's actions, instead of a ⋯ at the end of the
 * row the reader had to know to look for.
 *
 * - The **selected** tab shows a ▾. Clicking the selected tab **again**
 *   opens the menu too, as Notion does — it is already applied, so there is
 *   nothing else for that click to mean.
 * - **Right-click** on any tab opens the same menu without switching to the
 *   view; so do the context-menu key and Shift+F10 from the keyboard.
 * - **F2** or a **double-click** renames a view you own in place
 *   (`TabRenameField`).
 *
 * The menu: Rename, Duplicate, Copy link · Set / Clear my default, Shared with
 * workspace (a checkbox item, for an owner holding `views:share`) · Delete
 * view…, which only asks. Rename, sharing and delete are the owner's; a
 * colleague's shared view still offers Duplicate, its link and your default.
 *
 * Only the selected tab draws the ▾ (and has it as a tab stop); on the others
 * it is an invisible anchor for the menu, which right-click and the keys
 * above open. A ▾ on every tab needed room on every tab, and the row spread
 * out with gaps.
 */
export function SavedViewTab({
    view,
    active,
    dirty,
    onSelect,
    menuOpen,
    onMenuOpenChange,
    renaming,
    onRenamingChange,
    actions
}: SavedViewTabProps) {
    const intl = useIntl();
    const tabRef = useRef<HTMLButtonElement>(null);
    // Set by the items that hand focus to something else on the way out (the
    // rename field, the delete dialog): Radix restores focus to the ▾ *after*
    // that something has taken it, which would blur the field it just opened.
    const yieldFocus = useRef(false);
    const shared = view.visibility === VIEW_VISIBILITY.Workspace;

    const startRename = () => {
        if (!view.isOwn) return;
        onMenuOpenChange(false);
        onRenamingChange(true);
    };

    // Back onto the tab once the field gives way — after the render that
    // brings the tab back, which a frame callback can beat.
    const wasRenaming = useRef(false);
    useEffect(() => {
        if (wasRenaming.current && !renaming) tabRef.current?.focus();
        wasRenaming.current = renaming;
    }, [renaming]);

    if (renaming) {
        return (
            <TabRenameField
                initial={view.name}
                onCommit={async (name) => {
                    const ok = await actions.onRename(view, name);
                    if (ok) onRenamingChange(false);
                    return ok;
                }}
                onCancel={() => onRenamingChange(false)}
            />
        );
    }

    return (
        <span className="group/tab relative inline-flex shrink-0 items-center">
            <ViewTab
                buttonRef={tabRef}
                active={active}
                dirty={dirty}
                shared={shared}
                isDefault={view.isDefault}
                withCaret={active}
                onSelect={() => (active ? onMenuOpenChange(true) : onSelect())}
                onDoubleClick={startRename}
                onContextMenu={(event) => {
                    event.preventDefault();
                    onMenuOpenChange(true);
                }}
                onKeyDown={(event) => {
                    if (event.key === 'F2') {
                        event.preventDefault();
                        startRename();
                    } else if (
                        event.key === 'ContextMenu' ||
                        (event.key === 'F10' && event.shiftKey)
                    ) {
                        event.preventDefault();
                        onMenuOpenChange(true);
                    }
                }}
            >
                {view.name}
            </ViewTab>

            {/* `modal={false}`, like every other menu in the admin: a modal
                Radix menu `aria-hidden`s the page root. */}
            <DropdownMenu
                modal={false}
                open={menuOpen}
                onOpenChange={onMenuOpenChange}
            >
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        tabIndex={active ? 0 : -1}
                        aria-label={intl.formatMessage(messages.options, {
                            name: view.name
                        })}
                        className={cn(
                            'absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-[opacity,background-color] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground',
                            // Off the selected tab the ▾ is only the menu's
                            // anchor: reserving room for it on every tab spread
                            // the row out with gaps.
                            active
                                ? 'opacity-100'
                                : 'pointer-events-none opacity-0'
                        )}
                    >
                        <ChevronDown aria-hidden className="size-3.5" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="start"
                    className="w-64"
                    onCloseAutoFocus={(event) => {
                        if (!yieldFocus.current) return;
                        yieldFocus.current = false;
                        event.preventDefault();
                    }}
                >
                    <DropdownMenuLabel className="flex flex-col gap-0.5">
                        <span className="truncate text-[13px] font-semibold">
                            {view.name}
                        </span>
                        <span className="text-xs font-normal text-muted-foreground">
                            {intl.formatMessage(
                                shared ? messages.sharedBy : messages.personal
                            )}
                        </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {view.isOwn ? (
                        <DropdownMenuItem
                            onSelect={() => {
                                yieldFocus.current = true;
                                startRename();
                            }}
                        >
                            <Pencil aria-hidden />
                            {intl.formatMessage(messages.rename)}
                            <DropdownMenuShortcut>F2</DropdownMenuShortcut>
                        </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem
                        onSelect={() => actions.onDuplicate(view)}
                    >
                        <Copy aria-hidden />
                        {intl.formatMessage(messages.duplicate)}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => actions.onCopyLink(view)}>
                        <Link2 aria-hidden />
                        {intl.formatMessage(messages.copyLink)}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() =>
                            actions.onSetDefault(view, !view.isDefault)
                        }
                    >
                        <Star aria-hidden />
                        {intl.formatMessage(
                            view.isDefault
                                ? messages.clearDefault
                                : messages.makeDefault
                        )}
                    </DropdownMenuItem>
                    {view.isOwn && actions.onShare ? (
                        <DropdownMenuItem
                            role="menuitemcheckbox"
                            aria-checked={shared}
                            onSelect={() => actions.onShare?.(view, !shared)}
                        >
                            <Users aria-hidden />
                            {intl.formatMessage(messages.share)}
                            {shared ? (
                                <Check aria-hidden className="ml-auto" />
                            ) : null}
                        </DropdownMenuItem>
                    ) : null}
                    {view.isOwn ? (
                        <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onSelect={() => {
                                    yieldFocus.current = true;
                                    actions.onDelete(view);
                                }}
                            >
                                <Trash2 aria-hidden />
                                {intl.formatMessage(messages.delete)}
                            </DropdownMenuItem>
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>
        </span>
    );
}
