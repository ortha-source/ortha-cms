import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { ConfirmDialog } from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../../domain/types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../../../domain/constants';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import { ENTRY_SIDEBAR_WIDGET_SLOT } from '../../../../slots/contentSlots';
import {
    SidebarActionBar,
    type PrimaryAction
} from './SidebarActionBar';
import { PublishGate, type PublishGateItem } from './PublishGate';
import { DetailsBlock } from './DetailsBlock';
import { RevisionWidget } from '../RevisionWidget';

/** Re-exported for the editor, which computes the gate items. */
export type { PublishGateItem };

const messages = defineMessages({
    aside: {
        id: 'content.sidebar.aside',
        defaultMessage: 'Record actions and details'
    },
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
        defaultMessage: 'This permanently removes the entry and can’t be undone.'
    },
    deleteConfirm: {
        id: 'content.sidebar.deleteConfirm',
        defaultMessage: 'Delete'
    }
});

/**
 * The entry editor's right rail, composed of three nested blocks: a top
 * {@link SidebarActionBar} (primary button + ⋯ menu), a live {@link PublishGate}
 * (publishable types only), and a static {@link DetailsBlock}. This component
 * owns the permission gating + primary/menu derivation and the delete
 * confirmation; the blocks themselves are presentational.
 */
export function EntrySidebar({
    entry,
    publishable,
    paranoid,
    isCreate,
    saving,
    mutating = false,
    gate = [],
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
    /** The publish-gate checks (publishable types only). */
    gate?: PublishGateItem[];
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
    // Slot-contributed rail widgets (e.g. the i18n plugin's locale panel),
    // rendered below the Details block with the surrounding editor's context.
    const slotContext = useEntrySlotContext();
    const widgets = ENTRY_SIDEBAR_WIDGET_SLOT.getItems();

    const canCreate = useHasPermission(CONTENT_CREATE);
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const canSave = isCreate ? canCreate : canUpdate;

    const busy = saving || mutating;
    const published = entry?.status === ENTRY_STATUS.Published;

    // The primary button: Publish for a publishable type the user may publish,
    // else a plain Save (draft / live). Null when the user can't write at all.
    const primary: PrimaryAction | null =
        publishable && canPublish && canSave
            ? { kind: 'publish', onClick: onPublish }
            : canSave
              ? {
                    kind: publishable ? 'saveDraft' : 'save',
                    onClick: onSaveDraft
                }
              : null;

    const showSaveDraft = publishable && canSave;
    const showPublish = publishable && canPublish && canSave;
    const showUnpublish =
        !isCreate && publishable && published && canPublish && !!onUnpublish;
    const showDelete = !isCreate && canDelete && !!onDelete;

    return (
        <aside
            className="flex w-full shrink-0 flex-col gap-4 p-6 lg:w-[23rem]"
            aria-label={intl.formatMessage(messages.aside)}
        >
            <SidebarActionBar
                primary={primary}
                busy={busy}
                saving={saving}
                showSaveDraft={showSaveDraft}
                showPublish={showPublish}
                showUnpublish={showUnpublish}
                showDelete={showDelete}
                onSaveDraft={onSaveDraft}
                onPublish={onPublish}
                onUnpublish={onUnpublish}
                onRequestDelete={() => setConfirmDelete(true)}
            />

            {publishable && <PublishGate items={gate} />}

            <DetailsBlock entry={entry} isCreate={isCreate} />

            {slotContext && entry?.id ? (
                <RevisionWidget
                    typeName={slotContext.schema.name}
                    entryId={entry.id}
                />
            ) : null}

            {slotContext
                ? widgets.map((item) => (
                      <item.Component key={item.id} {...slotContext} />
                  ))
                : null}

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
        </aside>
    );
}
