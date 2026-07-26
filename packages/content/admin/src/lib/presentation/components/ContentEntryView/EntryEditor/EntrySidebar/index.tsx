import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import { Button, ConfirmDialog, cn } from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../../domain/types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../../../domain/constants';
import { useEntrySidebarCollapsed } from '../../../../hooks/useEntrySidebarCollapsed';
import { useEntrySlotContext } from '../../../../hooks/useEntrySlotContext';
import { ENTRY_SIDEBAR_WIDGET_SLOT } from '../../../../slots/contentSlots';
import { EntrySidebarSection } from '../../../EntrySidebarSection';
import { SidebarActionBar, type PrimaryAction } from './SidebarActionBar';
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
    panelTitle: {
        id: 'content.sidebar.panelTitle',
        defaultMessage: 'Properties'
    },
    collapse: {
        id: 'content.sidebar.collapse',
        defaultMessage: 'Hide properties'
    },
    expand: {
        id: 'content.sidebar.expand',
        defaultMessage: 'Show properties'
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
        defaultMessage:
            'This permanently removes the entry and can’t be undone.'
    },
    deleteConfirm: {
        id: 'content.sidebar.deleteConfirm',
        defaultMessage: 'Delete'
    }
});

/**
 * The entry editor's **Properties** panel — one flat, collapsible rail, not a
 * column of floating cards. It is a run of {@link EntrySidebarSection}s told
 * apart by dividers: the {@link SidebarActionBar} (primary button + ⋯ menu), a
 * live {@link PublishGate} (publishable types only), the static
 * {@link DetailsBlock}, the {@link RevisionWidget}, and any slot-contributed
 * widget — each of which uses the same section chrome, so a contribution can't
 * drift into its own look.
 *
 * A titled header carries the collapse toggle above those sections.
 *
 * **Collapsed** it becomes a narrow strip holding the expand toggle and the same
 * primary action + ⋯ menu (`compact`) — a collapse that hid Save would be a
 * trap. The rail **slides** between the two widths rather than snapping, on the
 * app sidebar's timing. The state is persisted
 * ({@link useEntrySidebarCollapsed}) because the editor is remounted by
 * navigations it doesn't own.
 *
 * This component owns the permission gating + primary/menu derivation and the
 * delete confirmation; the blocks themselves are presentational.
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
    const { collapsed, toggle } = useEntrySidebarCollapsed();
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

    const actionBar = (
        <SidebarActionBar
            primary={primary}
            busy={busy}
            saving={saving}
            compact={collapsed}
            showSaveDraft={showSaveDraft}
            showPublish={showPublish}
            showUnpublish={showUnpublish}
            showDelete={showDelete}
            onSaveDraft={onSaveDraft}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onRequestDelete={() => setConfirmDelete(true)}
        />
    );

    const toggleButton = (
        <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground"
            aria-expanded={!collapsed}
            aria-label={intl.formatMessage(
                collapsed ? messages.expand : messages.collapse
            )}
            onClick={toggle}
        >
            {collapsed ? (
                <PanelRightOpen aria-hidden />
            ) : (
                <PanelRightClose aria-hidden />
            )}
        </Button>
    );

    // Rendered outside the collapsed/expanded body, so an open confirmation
    // survives collapsing the rail underneath it (the ⋯ menu is in the strip
    // too, so Delete is reachable from either state).
    const deleteConfirm = showDelete && (
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
    );

    return (
        <aside
            // The rail slides between its two widths (matching the app
            // sidebar's `duration-200 ease-linear`) — the main column is
            // `flex-1`, so it takes up the space continuously as this animates.
            // `overflow-hidden` + the fixed-width inner box are what make it a
            // *slide* rather than a reflow: the contents keep their own width
            // and are clipped, instead of re-wrapping on every frame. The inner
            // box is pinned right (`ml-auto`) because the rail narrows from the
            // left, so what's on screen stays put while the panel closes.
            className={cn(
                'flex w-full shrink-0 flex-col overflow-hidden border-t border-border/60 transition-[width] duration-200 ease-linear motion-reduce:transition-none lg:border-l lg:border-t-0',
                collapsed ? 'lg:w-14' : 'lg:w-[23rem]'
            )}
            aria-label={intl.formatMessage(messages.aside)}
        >
            {collapsed ? (
                // Collapsed: a strip carrying the toggle and the same write
                // actions — a horizontal bar under the form on narrow screens,
                // a narrow column beside it from `lg` up.
                <div className="ml-auto flex w-full items-center gap-2 p-3 lg:w-14 lg:flex-col lg:py-4">
                    {toggleButton}
                    {actionBar}
                </div>
            ) : (
                <div className="ml-auto flex w-full flex-col lg:w-[23rem]">
                    <div className="flex items-center justify-between gap-2 border-b border-border/60 px-5 py-3">
                        <h2 className="text-sm font-semibold tracking-[-0.01em]">
                            {intl.formatMessage(messages.panelTitle)}
                        </h2>
                        {toggleButton}
                    </div>

                    {/* One surface, sections told apart by dividers — the
                        divider is the wrapper's, so every block (including a
                        contributed widget) is separated the same way without
                        drawing its own border. */}
                    <div className="flex flex-col divide-y divide-border/60">
                        <EntrySidebarSection>{actionBar}</EntrySidebarSection>

                        <PublishGate items={gate} publishable={publishable} />

                        <DetailsBlock entry={entry} isCreate={isCreate} />

                        {slotContext && entry?.id ? (
                            <RevisionWidget
                                typeName={slotContext.schema.name}
                                entryId={entry.id}
                                schema={slotContext.schema}
                            />
                        ) : null}

                        {slotContext
                            ? widgets.map((item) => (
                                  <item.Component
                                      key={item.id}
                                      {...slotContext}
                                  />
                              ))
                            : null}
                    </div>
                </div>
            )}

            {deleteConfirm}
        </aside>
    );
}
