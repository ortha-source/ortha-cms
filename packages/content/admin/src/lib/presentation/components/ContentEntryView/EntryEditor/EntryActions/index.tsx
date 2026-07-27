import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Save, Send, Trash2, Undo2 } from 'lucide-react';
import {
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Spinner
} from '@ortha-cms/design-system';
import { useHasPermission } from '@ortha-cms/identity-admin';
import type { EntryRecord } from '../../../../../domain/types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../../../domain/constants';

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
    deleteEntry: { id: 'content.editor.delete', defaultMessage: 'Delete' },
    deleteTitle: {
        id: 'content.sidebar.deleteTitle',
        defaultMessage: 'Delete this entry?'
    },
    deleteBody: {
        id: 'content.sidebar.deleteBody',
        defaultMessage:
            'It will be moved to the trash, where it can be restored.'
    },
    deleteBodyHard: {
        id: 'content.sidebar.deleteBodyHard',
        defaultMessage:
            'This permanently removes the entry and can’t be undone.'
    },
    deleteConfirm: {
        id: 'content.sidebar.deleteConfirm',
        defaultMessage: 'Delete'
    }
});

/** Icon + label per primary kind. */
const PRIMARY_META = {
    publish: { icon: Send, label: messages.publish },
    save: { icon: Save, label: messages.save },
    saveDraft: { icon: Save, label: messages.saveDraft }
} as const;

/**
 * The entry editor's **write actions**, rendered into the page top bar's actions
 * region (`PageActionsPortal`): a primary button — **Publish** for a publishable
 * type the user may publish, else **Save** / **Save draft** — beside a compact
 * **⋯ menu** holding the rest (Save draft, Save & publish, Unpublish, Delete).
 *
 * They live in the bar rather than in the Properties panel because the panel can
 * be collapsed away entirely, and a record you can't save is a trap. Rendered
 * through a portal from inside the editor, so the handlers, the busy state and
 * `useHasPermission` all resolve against the editor's own tree.
 *
 * Owns the permission gating, the primary/menu derivation, and the delete
 * confirmation; the caller supplies the handlers.
 */
export function EntryActions({
    entry,
    publishable,
    paranoid,
    isCreate,
    saving,
    mutating = false,
    onSaveDraft,
    onPublish,
    onUnpublish,
    onDelete
}: {
    entry?: EntryRecord;
    publishable: boolean;
    /** Whether delete is a soft delete (trash) vs a permanent removal. */
    paranoid: boolean;
    isCreate: boolean;
    saving: boolean;
    /** Whether an unpublish/delete action is in flight (disables the bar). */
    mutating?: boolean;
    /** Save without publishing (the default submit). */
    onSaveDraft: () => void;
    /** Save and mark published — only wired for publishable types. */
    onPublish: () => void;
    /** Revert a published entry to draft — only on a saved publishable entry. */
    onUnpublish?: () => void;
    /** Delete the entry — only on a saved entry. */
    onDelete?: () => void;
}) {
    const intl = useIntl();
    const [confirmDelete, setConfirmDelete] = useState(false);

    const canCreate = useHasPermission(CONTENT_CREATE);
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const canSave = isCreate ? canCreate : canUpdate;

    const busy = saving || mutating;
    const published = entry?.status === ENTRY_STATUS.Published;

    // The primary button: Publish for a publishable type the user may publish,
    // else a plain Save (draft / live). Null when the user can't write at all.
    const primary =
        publishable && canPublish && canSave
            ? { kind: 'publish' as const, onClick: onPublish }
            : canSave
              ? {
                    kind: (publishable ? 'saveDraft' : 'save') as
                        | 'saveDraft'
                        | 'save',
                    onClick: onSaveDraft
                }
              : null;

    const showSaveDraft = publishable && canSave;
    const showPublish = publishable && canPublish && canSave;
    const showUnpublish =
        !isCreate && publishable && published && canPublish && !!onUnpublish;
    const showDelete = !isCreate && canDelete && !!onDelete;
    const hasMenu = showSaveDraft || showPublish || showUnpublish || showDelete;

    if (!primary && !hasMenu) return null;

    const primaryMeta = primary ? PRIMARY_META[primary.kind] : null;
    const PrimaryIcon = primaryMeta?.icon;

    return (
        <>
            {primary && primaryMeta && PrimaryIcon && (
                <Button
                    type="button"
                    size="sm"
                    onClick={primary.onClick}
                    disabled={busy}
                >
                    {saving ? (
                        <Spinner aria-hidden />
                    ) : (
                        <PrimaryIcon aria-hidden />
                    )}
                    {intl.formatMessage(primaryMeta.label)}
                </Button>
            )}
            {hasMenu && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8 shrink-0 shadow-none"
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
                                    onSelect={() => setConfirmDelete(true)}
                                >
                                    <Trash2 aria-hidden />
                                    {intl.formatMessage(messages.deleteEntry)}
                                </DropdownMenuItem>
                            </>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            )}

            {showDelete && (
                <ConfirmDialog
                    open={confirmDelete}
                    onOpenChange={setConfirmDelete}
                    title={intl.formatMessage(messages.deleteTitle)}
                    description={intl.formatMessage(
                        paranoid ? messages.deleteBody : messages.deleteBodyHard
                    )}
                    confirmLabel={intl.formatMessage(messages.deleteConfirm)}
                    confirmVariant="destructive"
                    busy={busy}
                    onConfirm={() => {
                        onDelete?.();
                        setConfirmDelete(false);
                    }}
                />
            )}
        </>
    );
}
