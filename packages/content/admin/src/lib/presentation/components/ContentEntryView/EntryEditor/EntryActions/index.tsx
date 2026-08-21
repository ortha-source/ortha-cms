import { defineMessages, useIntl } from 'react-intl';
import { Save, Send } from 'lucide-react';
import { Button, Spinner } from '@orthacms/design-system';
import { useHasPermission } from '@orthacms/identity-admin';
import type { EntryRecord } from '../../../../../domain/types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../../../domain/constants';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import { EntryMenu } from './EntryMenu';

const messages = defineMessages({
    save: { id: 'content.editor.save', defaultMessage: 'Save' },
    saveDraft: { id: 'content.editor.saveDraft', defaultMessage: 'Save draft' },
    publish: { id: 'content.editor.publish', defaultMessage: 'Publish' }
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
 * type the user may publish, else **Save** / **Save draft** — beside the
 * {@link EntryMenu} holding the rest.
 *
 * They live in the bar rather than in the Properties panel because the panel can
 * be collapsed away entirely, and a record you can't save is a trap. Rendered
 * through a portal from inside the editor, so the handlers, the busy state and
 * `useHasPermission` all resolve against the editor's own tree.
 *
 * Owns the permission gating and the primary/menu derivation; the menu owns its
 * own contents (including the delete confirmation and any contributed overlay).
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
    // Always present in practice — `ContentEntryView` wraps the editor in the
    // provider. The menu needs it (contributed items are resolved against it),
    // so it renders only alongside a context rather than with a stand-in.
    const slotContext = useEntrySlotContext();

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
            {slotContext && (
                <EntryMenu
                    context={slotContext}
                    paranoid={paranoid}
                    busy={busy}
                    showSaveDraft={showSaveDraft}
                    showPublish={showPublish}
                    showUnpublish={showUnpublish}
                    showDelete={showDelete}
                    onSaveDraft={onSaveDraft}
                    onPublish={onPublish}
                    onUnpublish={onUnpublish}
                    onDelete={onDelete}
                />
            )}
        </>
    );
}
