import { useEffect, useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Check,
    ChevronDown,
    LayoutList,
    Pin,
    PinOff,
    Trash2
} from 'lucide-react';
import {
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Spinner,
    cn
} from '@orthacms/design-system';
import {
    VIEW_VISIBILITY,
    type SavedView
} from '../../../domain/types/savedView';
import { ViewRow } from './ViewRow';

/** Intl descriptors for {@link ViewSwitcher}, co-located. */
const messages = defineMessages({
    trigger: {
        id: 'content.views.switcher.trigger',
        defaultMessage: 'Saved views'
    },
    group: {
        id: 'content.views.switcher.group',
        defaultMessage: 'View controls'
    },
    personal: {
        id: 'content.views.switcher.personal',
        defaultMessage: 'Personal'
    },
    shared: {
        id: 'content.views.switcher.shared',
        defaultMessage: 'Shared'
    },
    all: {
        id: 'content.views.switcher.all',
        defaultMessage: 'All records'
    },
    allHint: {
        id: 'content.views.switcher.allHint',
        defaultMessage: 'No filters'
    },
    saveAs: {
        id: 'content.views.switcher.saveAs',
        defaultMessage: 'Save current as view…'
    },
    modified: {
        id: 'content.views.switcher.modified',
        defaultMessage: 'Modified'
    },
    save: { id: 'content.views.switcher.save', defaultMessage: 'Save' },
    saveNew: {
        id: 'content.views.switcher.saveNew',
        defaultMessage: 'Save as new'
    },
    reset: { id: 'content.views.switcher.reset', defaultMessage: 'Reset' },
    makeDefault: {
        id: 'content.views.switcher.makeDefault',
        defaultMessage: 'Set as my default'
    },
    clearDefault: {
        id: 'content.views.switcher.clearDefault',
        defaultMessage: 'Clear my default'
    },
    delete: {
        id: 'content.views.switcher.delete',
        defaultMessage: 'Delete view'
    },
    deleteTitle: {
        id: 'content.views.switcher.deleteTitle',
        defaultMessage: 'Delete this view?'
    },
    deleteBody: {
        id: 'content.views.switcher.deleteBody',
        defaultMessage:
            '“{name}” will be removed. The records it filtered are untouched, and the list falls back to All records.'
    },
    deleteBodyShared: {
        id: 'content.views.switcher.deleteBodyShared',
        defaultMessage:
            '“{name}” is shared with the workspace — deleting it removes it for everyone. The records it filtered are untouched.'
    },
    deleteConfirm: {
        id: 'content.views.switcher.deleteConfirm',
        defaultMessage: 'Delete view'
    },
    cancel: {
        id: 'content.views.switcher.cancel',
        defaultMessage: 'Cancel'
    }
});

/** Props for {@link ViewSwitcher}. */
export type ViewSwitcherProps = {
    /** Views the caller may see for this list. */
    views: SavedView[];
    /** The view currently applied, or null for the unfiltered list. */
    active: SavedView | null;
    /** Whether the live list state has drifted from the active view's payload. */
    isDirty: boolean;
    /** Whether a save/update is in flight. */
    isSaving: boolean;
    /** Applies a view, or clears back to the unfiltered list when null. */
    onSelect: (view: SavedView | null) => void;
    /** Opens the "Save current as view" dialog. */
    onSaveAs: () => void;
    /** Overwrites the active view with the live state. */
    onSaveChanges: () => void;
    /** Re-applies the active view, discarding the live changes. */
    onReset: () => void;
    /** Points the caller's default at a view, or clears it. */
    onSetDefault: (view: SavedView, isDefault: boolean) => void;
    /** Deletes a view the caller owns. */
    onDelete: (view: SavedView) => void;
};

/**
 * The saved-view picker, sitting in the collection header's action cluster
 * beside **View trash** and **Add record**.
 *
 * It is a button of the same weight as its neighbours rather than a pill under
 * the `<h1>`: which slice is on screen is something the reader *changes*, and
 * the header's trailing edge is where this page keeps the things you act on.
 * Under the title it read as a caption on the heading — decoration rather than
 * a control — and it pushed the subtitle down on every collection.
 *
 * When the live state drifts from the saved payload the trigger says so and the
 * three resolutions appear inline beside it. Nothing autosaves: silently
 * rewriting a shared view would lose a colleague's work with no trace, and the
 * same rule for personal views keeps one mental model instead of two.
 */
export function ViewSwitcher({
    views,
    active,
    isDirty,
    isSaving,
    onSelect,
    onSaveAs,
    onSaveChanges,
    onReset,
    onSetDefault,
    onDelete
}: ViewSwitcherProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    // The view the confirm dialog is asking about, held by value rather than by
    // a boolean: the menu that named it is gone by the time the dialog is up.
    const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);
    // Where focus goes when the dialog closes — see the dialog's own comment.
    // The same ref serves both branches below; only one is ever mounted.
    const triggerRef = useRef<HTMLButtonElement>(null);

    // With nothing saved and nothing applied there is no state to switch
    // between — the cluster collapses to the affordance that creates the first
    // view, so the header isn't carrying an empty menu on every collection.
    const collapsed = views.length === 0 && !active;

    // Deleting the **last** view is what reaches that state, and the swap
    // arrives with the refetched list — i.e. *after* the dialog has handed
    // focus to the very button being replaced, which would leave focus on
    // `<body>`. Put it on the button that took over. Armed only by a confirmed
    // delete and disarmed whenever the dialog opens, so a list that changed for
    // some other reason (a colleague's shared view arriving) never steals it.
    const justDeleted = useRef(false);
    useEffect(() => {
        if (!justDeleted.current) return;
        justDeleted.current = false;
        triggerRef.current?.focus();
    }, [collapsed]);

    const personal = views.filter(
        (view) => view.visibility === VIEW_VISIBILITY.Private
    );
    const shared = views.filter(
        (view) => view.visibility === VIEW_VISIBILITY.Workspace
    );

    if (collapsed) {
        return (
            <div
                role="group"
                aria-label={intl.formatMessage(messages.group)}
                className="flex items-center gap-2"
            >
                <Button
                    ref={triggerRef}
                    variant="outline"
                    className="shadow-none"
                    onClick={onSaveAs}
                >
                    <LayoutList />
                    {intl.formatMessage(messages.saveAs)}
                </Button>
            </div>
        );
    }

    return (
        // A labelled group: the trigger and the Save / Save as new / Reset
        // buttons beside it are one cluster, and the page has other buttons by
        // those names (the filter panel's own Reset). The name disambiguates
        // them for a screen reader the same way position does visually.
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex flex-wrap items-center gap-2"
        >
            {/* `modal={false}`, like every other menu in the admin: a modal
                Radix menu `aria-hidden`s the page root, which holds focusable
                content, and axe's `aria-hidden-focus` fires on it (the whole
                page — the `<h1>` included — also drops out of the a11y tree). */}
            <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        ref={triggerRef}
                        variant="outline"
                        aria-label={intl.formatMessage(messages.trigger)}
                        className={cn(
                            'shadow-none',
                            isDirty &&
                                'border-amber-500/60 text-amber-700 dark:text-amber-400'
                        )}
                    >
                        <LayoutList aria-hidden />
                        <span className="max-w-[14rem] truncate">
                            {active
                                ? active.name
                                : intl.formatMessage(messages.all)}
                        </span>
                        {isDirty ? (
                            <>
                                <span aria-hidden className="opacity-50">
                                    ·
                                </span>
                                {intl.formatMessage(messages.modified)}
                            </>
                        ) : null}
                        <ChevronDown aria-hidden className="opacity-60" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-72">
                    {personal.length > 0 ? (
                        <>
                            <DropdownMenuLabel>
                                {intl.formatMessage(messages.personal)}
                            </DropdownMenuLabel>
                            {personal.map((view) => (
                                <ViewRow
                                    key={view.id}
                                    view={view}
                                    active={active?.id === view.id}
                                    onSelect={onSelect}
                                />
                            ))}
                        </>
                    ) : null}

                    {shared.length > 0 ? (
                        <>
                            <DropdownMenuLabel>
                                {intl.formatMessage(messages.shared)}
                            </DropdownMenuLabel>
                            {shared.map((view) => (
                                <ViewRow
                                    key={view.id}
                                    view={view}
                                    active={active?.id === view.id}
                                    onSelect={onSelect}
                                />
                            ))}
                        </>
                    ) : null}

                    {views.length > 0 ? <DropdownMenuSeparator /> : null}

                    {/* Not a view — the way back out of one. Kept as its own
                        row at the bottom because "clear everything" is the most
                        common move after "switch". */}
                    <DropdownMenuItem onSelect={() => onSelect(null)}>
                        <Check
                            aria-hidden
                            className={cn(
                                'size-3.5',
                                active ? 'invisible' : 'text-primary'
                            )}
                        />
                        <span className="flex-1">
                            {intl.formatMessage(messages.all)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.allHint)}
                        </span>
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onSaveAs}>
                        {intl.formatMessage(messages.saveAs)}
                    </DropdownMenuItem>

                    {active ? (
                        <>
                            <DropdownMenuItem
                                onSelect={() =>
                                    onSetDefault(active, !active.isDefault)
                                }
                            >
                                {active.isDefault ? (
                                    <PinOff aria-hidden className="size-3.5" />
                                ) : (
                                    <Pin aria-hidden className="size-3.5" />
                                )}
                                {intl.formatMessage(
                                    active.isDefault
                                        ? messages.clearDefault
                                        : messages.makeDefault
                                )}
                            </DropdownMenuItem>
                            {active.isOwn ? (
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => {
                                        justDeleted.current = false;
                                        setPendingDelete(active);
                                    }}
                                >
                                    <Trash2 aria-hidden className="size-3.5" />
                                    {intl.formatMessage(messages.delete)}
                                </DropdownMenuItem>
                            ) : null}
                        </>
                    ) : null}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* The three resolutions, inline rather than inside the menu: the
                reader is already looking at the trigger that says "Modified",
                and burying the fix one click deeper buys nothing. `Save` is
                absent on someone else's shared view — that one is theirs.
                None of them is `variant="default"`: the header's one primary
                button is "Add record", and a second would compete with it. */}
            {isDirty && active ? (
                <>
                    {active.isOwn ? (
                        <Button
                            variant="secondary"
                            className="shadow-none"
                            disabled={isSaving}
                            onClick={onSaveChanges}
                        >
                            {isSaving ? <Spinner aria-hidden /> : null}
                            {intl.formatMessage(messages.save)}
                        </Button>
                    ) : null}
                    <Button
                        variant="outline"
                        className="shadow-none"
                        onClick={onSaveAs}
                    >
                        {intl.formatMessage(messages.saveNew)}
                    </Button>
                    <Button variant="ghost" onClick={onReset}>
                        {intl.formatMessage(messages.reset)}
                    </Button>
                </>
            ) : null}

            {/* Outside `DropdownMenuContent`, which unmounts the instant the
                menu closes — precisely when this dialog is meant to appear.
                Same rule the entry editor's ⋯ menu follows.

                A view is a slice, not records, so deleting one destroys no
                content — but it is not undoable and a shared view is somebody
                else's tool too, which is what the confirm is for. The body says
                which of the two this is.

                `onCloseAutoFocus`: the control that opened this — a menu item —
                is long gone, so Radix's restore would target a detached node
                and drop focus on `<body>`. Put it back on the switcher. */}
            {pendingDelete ? (
                <ConfirmDialog
                    open
                    onOpenChange={(next) => {
                        if (!next) setPendingDelete(null);
                    }}
                    title={intl.formatMessage(messages.deleteTitle)}
                    description={intl.formatMessage(
                        pendingDelete.visibility === VIEW_VISIBILITY.Workspace
                            ? messages.deleteBodyShared
                            : messages.deleteBody,
                        { name: pendingDelete.name }
                    )}
                    confirmLabel={intl.formatMessage(messages.deleteConfirm)}
                    cancelLabel={intl.formatMessage(messages.cancel)}
                    confirmVariant="destructive"
                    onCloseAutoFocus={(event) => {
                        if (!triggerRef.current) return;
                        event.preventDefault();
                        triggerRef.current.focus();
                    }}
                    onConfirm={() => {
                        // Closed here rather than held open behind `busy`: the
                        // outcome lands as a toast either way, which is how the
                        // entry editor's delete behaves too.
                        justDeleted.current = true;
                        onDelete(pendingDelete);
                        setPendingDelete(null);
                    }}
                />
            ) : null}
        </div>
    );
}
