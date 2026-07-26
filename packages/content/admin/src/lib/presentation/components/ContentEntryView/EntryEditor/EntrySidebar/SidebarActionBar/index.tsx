import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Save, Send, Trash2, Undo2 } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Spinner
} from '@ortha-cms/design-system';

const messages = defineMessages({
    actions: {
        id: 'content.sidebar.actions',
        defaultMessage: 'More actions'
    },
    save: { id: 'content.editor.save', defaultMessage: 'Save' },
    saveDraft: { id: 'content.editor.saveDraft', defaultMessage: 'Save draft' },
    publish: { id: 'content.editor.publish', defaultMessage: 'Publish' },
    publishAndSave: {
        id: 'content.editor.publishAndSave',
        defaultMessage: 'Save & publish'
    },
    unpublish: { id: 'content.editor.unpublish', defaultMessage: 'Unpublish' },
    deleteEntry: { id: 'content.editor.delete', defaultMessage: 'Delete' }
});

/** Which primary action the rail's main button performs. */
export type PrimaryKind = 'publish' | 'save' | 'saveDraft';

/** The rail's primary button: which action it runs and its handler. */
export type PrimaryAction = { kind: PrimaryKind; onClick: () => void };

/** Icon + label per primary kind. */
const PRIMARY_META = {
    publish: { icon: Send, label: messages.publish },
    save: { icon: Save, label: messages.save },
    saveDraft: { icon: Save, label: messages.saveDraft }
} as const;

/**
 * The entry editor rail's top **action bar**: a primary button (Publish / Save /
 * Save draft) beside a compact **⋯ menu** holding the remaining permitted actions
 * (Save draft, Save & publish, Unpublish, Delete). Purely presentational — the
 * parent decides which `primary` and which menu items to show, and owns the
 * handlers (Delete routes through `onRequestDelete`, which opens the confirm).
 */
export function SidebarActionBar({
    primary,
    busy,
    saving,
    compact = false,
    showSaveDraft,
    showPublish,
    showUnpublish,
    showDelete,
    onSaveDraft,
    onPublish,
    onUnpublish,
    onRequestDelete
}: {
    /** The primary action, or null when the user can't write at all. */
    primary: PrimaryAction | null;
    /** Any action in flight — disables the bar. */
    busy: boolean;
    /** A save/publish specifically is in flight — shows the primary spinner. */
    saving: boolean;
    /**
     * Render for the **collapsed** rail: an icon-only primary (its label becomes
     * the accessible name) beside the ⋯ menu, laid out by the strip rather than
     * by a wrapper of its own. Saving must stay reachable with the rail shut —
     * a collapse that hides the Save button would be a trap.
     */
    compact?: boolean;
    showSaveDraft: boolean;
    showPublish: boolean;
    showUnpublish: boolean;
    showDelete: boolean;
    onSaveDraft: () => void;
    onPublish: () => void;
    onUnpublish?: () => void;
    /** Opens the delete confirmation. */
    onRequestDelete: () => void;
}) {
    const intl = useIntl();
    const hasMenu = showSaveDraft || showPublish || showUnpublish || showDelete;

    if (!primary && !hasMenu) return null;

    const primaryMeta = primary ? PRIMARY_META[primary.kind] : null;
    const PrimaryIcon = primaryMeta?.icon;

    const actions = (
        <>
            {primary && primaryMeta && PrimaryIcon && (
                <Button
                    type="button"
                    className={compact ? 'shrink-0' : 'flex-1'}
                    size={compact ? 'icon' : undefined}
                    aria-label={
                        compact
                            ? intl.formatMessage(primaryMeta.label)
                            : undefined
                    }
                    onClick={primary.onClick}
                    disabled={busy}
                >
                    {saving ? (
                        <Spinner aria-hidden />
                    ) : (
                        <PrimaryIcon aria-hidden />
                    )}
                    {compact ? null : intl.formatMessage(primaryMeta.label)}
                </Button>
            )}
            {hasMenu && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="shrink-0 shadow-none"
                            disabled={busy}
                            aria-label={intl.formatMessage(messages.actions)}
                        >
                            <MoreHorizontal aria-hidden />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        {showSaveDraft && (
                            <DropdownMenuItem onSelect={onSaveDraft}>
                                <Save aria-hidden />
                                {intl.formatMessage(messages.saveDraft)}
                            </DropdownMenuItem>
                        )}
                        {showPublish && (
                            <DropdownMenuItem onSelect={onPublish}>
                                <Send aria-hidden />
                                {intl.formatMessage(messages.publishAndSave)}
                            </DropdownMenuItem>
                        )}
                        {showUnpublish && onUnpublish && (
                            <DropdownMenuItem onSelect={onUnpublish}>
                                <Undo2 aria-hidden />
                                {intl.formatMessage(messages.unpublish)}
                            </DropdownMenuItem>
                        )}
                        {showDelete && (
                            <>
                                {(showSaveDraft ||
                                    showPublish ||
                                    showUnpublish) && <DropdownMenuSeparator />}
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onSelect={onRequestDelete}
                                >
                                    <Trash2 aria-hidden />
                                    {intl.formatMessage(messages.deleteEntry)}
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </>
    );

    // Compact renders straight into the collapsed strip's own flex row/column,
    // so it contributes no wrapper — the strip decides the direction.
    return compact ? (
        actions
    ) : (
        <div className="flex items-center gap-2">{actions}</div>
    );
}
