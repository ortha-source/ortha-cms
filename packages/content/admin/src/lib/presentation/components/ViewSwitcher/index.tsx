import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, ChevronDown, Star, Trash2 } from 'lucide-react';
import {
    Button,
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
    droppedColumns: {
        id: 'content.views.switcher.droppedColumns',
        defaultMessage:
            '{count, plural, one {# column in this view no longer exists and was skipped.} other {# columns in this view no longer exist and were skipped.}}'
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
    /** How many of the active view's columns this type no longer has. */
    droppedColumns: number;
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
 * The saved-view picker that sits under the collection's `<h1>`.
 *
 * Placed there, not in the toolbar beside Columns and Filters, because it
 * answers a different question: *which slice am I looking at*, rather than *how
 * do I narrow it*. Sitting it in the toolbar makes a view read as one more
 * filter control, which is exactly what it is not.
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
    droppedColumns,
    onSelect,
    onSaveAs,
    onSaveChanges,
    onReset,
    onSetDefault,
    onDelete
}: ViewSwitcherProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);

    const personal = views.filter(
        (view) => view.visibility === VIEW_VISIBILITY.Private
    );
    const shared = views.filter(
        (view) => view.visibility === VIEW_VISIBILITY.Workspace
    );

    // With nothing saved and nothing applied there is no state to switch
    // between — render only the affordance that creates the first view, so the
    // header isn't carrying an empty menu on every collection.
    if (views.length === 0 && !active) {
        return (
            <div
                role="group"
                aria-label={intl.formatMessage(messages.group)}
                className="flex items-center gap-2"
            >
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={onSaveAs}
                >
                    {intl.formatMessage(messages.saveAs)}
                </Button>
            </div>
        );
    }

    return (
        // A labelled group: the pill and the Save / Save as new / Reset buttons
        // beside it are one cluster, and the page has other buttons by those
        // names (the filter panel's own Reset). The name disambiguates them for
        // a screen reader the same way position does visually.
        <div
            role="group"
            aria-label={intl.formatMessage(messages.group)}
            className="flex flex-wrap items-center gap-2"
        >
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        aria-label={intl.formatMessage(messages.trigger)}
                        className={cn(
                            'h-7 rounded-full px-3 text-xs font-medium shadow-none',
                            isDirty &&
                                'border-amber-500/60 text-amber-700 dark:text-amber-400'
                        )}
                    >
                        <ChevronDown aria-hidden className="size-3" />
                        {active
                            ? active.name
                            : intl.formatMessage(messages.all)}
                        {isDirty ? (
                            <>
                                <span aria-hidden className="opacity-50">
                                    ·
                                </span>
                                {intl.formatMessage(messages.modified)}
                            </>
                        ) : null}
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="start" className="w-72">
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
                                <Star aria-hidden className="size-3.5" />
                                {intl.formatMessage(
                                    active.isDefault
                                        ? messages.clearDefault
                                        : messages.makeDefault
                                )}
                            </DropdownMenuItem>
                            {active.isOwn ? (
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => onDelete(active)}
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
                reader is already looking at the pill that says "Modified", and
                burying the fix one click deeper buys nothing. `Save` is absent
                on someone else's shared view — that one is theirs. */}
            {isDirty && active ? (
                <>
                    {active.isOwn ? (
                        <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={isSaving}
                            onClick={onSaveChanges}
                        >
                            {isSaving ? (
                                <Spinner aria-hidden className="size-3" />
                            ) : null}
                            {intl.formatMessage(messages.save)}
                        </Button>
                    ) : null}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs shadow-none"
                        onClick={onSaveAs}
                    >
                        {intl.formatMessage(messages.saveNew)}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={onReset}
                    >
                        {intl.formatMessage(messages.reset)}
                    </Button>
                </>
            ) : null}

            {/* A view outlives the field it was saved over, so applying one
                drops what no longer exists. Say so — a silently shorter table
                reads as a bug in the view, not as a changed content type. */}
            {droppedColumns > 0 ? (
                <p className="text-xs text-muted-foreground" role="status">
                    {intl.formatMessage(messages.droppedColumns, {
                        count: droppedColumns
                    })}
                </p>
            ) : null}
        </div>
    );
}
