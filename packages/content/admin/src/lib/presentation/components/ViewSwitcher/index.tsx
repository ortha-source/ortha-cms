import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import { Button, ConfirmDialog, Spinner } from '@orthacms/design-system';
import {
    VIEW_VISIBILITY,
    type SavedView
} from '../../../domain/types/savedView';
import { SavedViewTab, type SavedViewTabActions } from './SavedViewTab';
import { ViewOverflowMenu } from './ViewOverflowMenu';
import { ViewTab } from './ViewTab';

/** Intl descriptors for {@link ViewSwitcher}, co-located. */
const messages = defineMessages({
    group: {
        id: 'content.views.switcher.group',
        defaultMessage: 'View controls'
    },
    all: {
        id: 'content.views.switcher.all',
        defaultMessage: 'All records'
    },
    tabs: {
        id: 'content.views.switcher.tabs',
        defaultMessage: 'Views'
    },
    newView: {
        id: 'content.views.switcher.newView',
        defaultMessage: 'View'
    },
    newViewLabel: {
        id: 'content.views.switcher.newViewLabel',
        defaultMessage: 'New view from the current list'
    },
    save: { id: 'content.views.switcher.save', defaultMessage: 'Save' },
    saveNew: {
        id: 'content.views.switcher.saveNew',
        defaultMessage: 'Save as new'
    },
    reset: { id: 'content.views.switcher.reset', defaultMessage: 'Reset' },
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
export type ViewSwitcherProps = Omit<SavedViewTabActions, 'onDelete'> & {
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
    /** Deletes a view the caller owns (after the switcher's confirm). */
    onDelete: (view: SavedView) => void;
    /** Drawn at the far end of the tab row — the Trash tab. */
    trailing?: ReactNode;
};

/** Space kept for the "N more" button while it isn't drawn yet. */
const MORE_FALLBACK_WIDTH = 96;
/** The strip's `gap-0.5`. */
const TAB_GAP = 2;

/**
 * Which views fold into "N more": the row keeps as many tabs as fit, in
 * order, and always the selected one (in place of the last that would have
 * fit). Widths come from the last time each tab was drawn — a folded tab
 * can't be measured, and its name has not changed since.
 */
function overflowing(
    views: SavedView[],
    activeId: string | null,
    widths: Map<string, number>,
    available: number
): string[] {
    const width = (id: string) => (widths.get(id) ?? 120) + TAB_GAP;
    const fixed = width('__all') + width('__new');
    const all = views.reduce((sum, view) => sum + width(view.id), fixed);
    if (all <= available) return [];

    const budget =
        available - fixed - (widths.get('__more') ?? MORE_FALLBACK_WIDTH);
    const kept: string[] = [];
    let used = 0;
    for (const view of views) {
        if (used + width(view.id) > budget) break;
        kept.push(view.id);
        used += width(view.id);
    }
    if (activeId && !kept.includes(activeId)) {
        while (kept.length > 0 && used + width(activeId) > budget) {
            used -= width(kept.pop() as string);
        }
        kept.push(activeId);
    }
    return views.map((view) => view.id).filter((id) => !kept.includes(id));
}

/**
 * The saved views as **tabs over the records table** — All records, then each
 * view the reader may see, then **+ View** — the way Airtable and Notion make a
 * view navigation rather than a hidden menu. The Trash tab, when the type has
 * one, sits at the far end (`trailing`).
 *
 * **Each view's actions are on its own tab** (`SavedViewTab`): a ▾ on the
 * selected tab (or on hover), a second click on the selected tab, a
 * right-click, F2 to rename in place. There is no ⋯ at the end of the row any
 * more — finding Delete used to mean knowing to look there.
 *
 * **Tabs that don't fit fold into "N more"** (`ViewOverflowMenu`, searchable)
 * instead of scrolling out of sight; the selected view always keeps its tab.
 * The fit is measured from the strip's width (a `ResizeObserver`), so a
 * narrower window, or the Save / Reset buttons appearing, re-folds the row.
 *
 * When the live state drifts from the saved payload the active tab carries a
 * dot and the three resolutions appear inline after the row. Nothing
 * autosaves: silently rewriting a shared view would lose a colleague's work
 * with no trace, and the same rule for personal views keeps one mental model
 * instead of two.
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
    onDelete,
    trailing,
    ...actions
}: ViewSwitcherProps) {
    const intl = useIntl();
    // One menu and one rename at a time, across every tab.
    const [menuFor, setMenuFor] = useState<string | null>(null);
    const [renaming, setRenaming] = useState<string | null>(null);
    // The view the confirm dialog is asking about, held by value rather than by
    // a boolean: the menu that named it is gone by the time the dialog is up.
    const [pendingDelete, setPendingDelete] = useState<SavedView | null>(null);
    const [folded, setFolded] = useState<string[]>([]);
    const stripRef = useRef<HTMLDivElement>(null);
    // Whether the view being deleted is the one on screen: then the list
    // falls back to All records, whose tab is where focus should land.
    const deletingActive = useRef(false);
    const widths = useRef(new Map<string, number>());

    const activeId = active?.id ?? null;
    const viewKey = views.map((view) => `${view.id}:${view.name}`).join('|');

    useLayoutEffect(() => {
        const strip = stripRef.current;
        if (!strip) return;
        const measure = () => {
            strip
                .querySelectorAll<HTMLElement>('[data-view-slot]')
                .forEach((slot) => {
                    const key = slot.dataset.viewSlot;
                    if (key) widths.current.set(key, slot.offsetWidth);
                });
            const next = overflowing(
                views,
                activeId,
                widths.current,
                strip.clientWidth
            );
            setFolded((prev) =>
                prev.length === next.length &&
                prev.every((id, index) => id === next[index])
                    ? prev
                    : next
            );
        };
        measure();
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(measure);
        observer.observe(strip);
        return () => observer.disconnect();
        // `viewKey` stands for `views`: a new array with the same views and
        // names changes nothing a measurement depends on.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewKey, activeId, renaming, folded.length]);

    const shown = views.filter((view) => !folded.includes(view.id));
    const hidden = views.filter((view) => folded.includes(view.id));

    const tabActions: SavedViewTabActions = {
        ...actions,
        onDelete: (view) => setPendingDelete(view)
    };

    return (
        // A labelled group: the tabs and the Save / Save as new / Reset
        // buttons beside them are one cluster, and the page has other buttons
        // by those names (the filter panel's own Reset). The name
        // disambiguates them for a screen reader the same way position does
        // visually.
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex min-w-0 flex-1 items-center gap-1"
        >
            {/* Clips rather than scrolls: what doesn't fit folds into "N
                more". y is clipped too, and the strip reaches 1px down
                (`-mb-px pb-px`) so the selected tab's underline, which hangs
                1px below the tab, lands on the row's rule. */}
            <div
                ref={stripRef}
                role="group"
                aria-label={intl.formatMessage(messages.tabs)}
                className="-mb-px flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden pb-px"
            >
                <span data-view-slot="__all" className="shrink-0">
                    <ViewTab active={!active} onSelect={() => onSelect(null)}>
                        {intl.formatMessage(messages.all)}
                    </ViewTab>
                </span>
                {shown.map((view) => (
                    <span
                        key={view.id}
                        data-view-slot={view.id}
                        className="shrink-0"
                    >
                        <SavedViewTab
                            view={view}
                            active={activeId === view.id}
                            dirty={isDirty && activeId === view.id}
                            onSelect={() => onSelect(view)}
                            menuOpen={menuFor === view.id}
                            onMenuOpenChange={(open) =>
                                setMenuFor(open ? view.id : null)
                            }
                            renaming={renaming === view.id}
                            onRenamingChange={(next) =>
                                setRenaming(next ? view.id : null)
                            }
                            actions={tabActions}
                        />
                    </span>
                ))}
                {hidden.length > 0 ? (
                    <span data-view-slot="__more" className="shrink-0">
                        <ViewOverflowMenu
                            views={hidden}
                            onSelect={onSelect}
                            onSaveAs={onSaveAs}
                        />
                    </span>
                ) : null}
                <span data-view-slot="__new" className="shrink-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        aria-label={intl.formatMessage(messages.newViewLabel)}
                        onClick={onSaveAs}
                    >
                        <Plus aria-hidden />
                        {intl.formatMessage(messages.newView)}
                    </Button>
                </span>
            </div>

            {/* The three resolutions, inline: the reader is already looking at
                the tab that says "Modified", and burying the fix in a menu
                buys nothing. `Save` is absent on someone else's shared view —
                that one is theirs. None of them is `variant="default"`: the
                header's one primary button is "Add record", and a second
                would compete with it. */}
            {isDirty && active ? (
                <div className="ml-2 flex shrink-0 items-center gap-1.5">
                    {active.isOwn ? (
                        <Button
                            variant="secondary"
                            size="sm"
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
                        size="sm"
                        className="shadow-none"
                        onClick={onSaveAs}
                    >
                        {intl.formatMessage(messages.saveNew)}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onReset}>
                        {intl.formatMessage(messages.reset)}
                    </Button>
                </div>
            ) : null}

            {trailing ? (
                <div className="ml-2 flex shrink-0 items-center">
                    {trailing}
                </div>
            ) : null}

            {/* Outside the tab's `DropdownMenuContent`, which unmounts the
                instant the menu closes — precisely when this dialog is meant
                to appear.

                A view is a slice, not records, so deleting one destroys no
                content — but it is not undoable and a shared view is somebody
                else's tool too, which is what the confirm is for. The body says
                which of the two this is.

                `onCloseAutoFocus`: the control that opened this — a menu item —
                is long gone (and its tab may be too), so Radix's restore would
                drop focus on `<body>`. Put it on the selected tab, which
                always exists. */}
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
                        event.preventDefault();
                        const target = deletingActive.current
                            ? '[data-view-slot="__all"] button'
                            : 'button[aria-pressed="true"]';
                        deletingActive.current = false;
                        stripRef.current
                            ?.querySelector<HTMLElement>(target)
                            ?.focus();
                    }}
                    onConfirm={() => {
                        deletingActive.current = pendingDelete.id === activeId;
                        // Closed here rather than held open behind `busy`: the
                        // outcome lands as a toast either way, which is how the
                        // entry editor's delete behaves too.
                        onDelete(pendingDelete);
                        setPendingDelete(null);
                    }}
                />
            ) : null}
        </div>
    );
}
