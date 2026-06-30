import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import {
    Check,
    MoreHorizontal,
    Save,
    Send,
    Trash2,
    Undo2,
    X
} from 'lucide-react';
import { useHasPermission } from '@ortha-cms/identity-admin';
import {
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    Spinner,
    cn
} from '@ortha-cms/design-system';
import type { EntryRecord } from '../../../../types/contentType';
import {
    CONTENT_CREATE,
    CONTENT_DELETE,
    CONTENT_PUBLISH,
    CONTENT_UPDATE,
    ENTRY_STATUS
} from '../../../../constants';
import { ConfirmDialog } from '../../../ConfirmDialog';

/** One row of the publish gate: a field check with its live pass/fail. */
export type PublishGateItem = {
    /** The field's display label. */
    label: string;
    /** Whether the field currently passes publish validation. */
    ok: boolean;
    /** The failure message when `ok` is false. */
    message?: string;
};

const messages = defineMessages({
    aside: {
        id: 'content.sidebar.aside',
        defaultMessage: 'Record actions and details'
    },
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
    gateTitle: {
        id: 'content.sidebar.gateTitle',
        defaultMessage: 'Publish gate'
    },
    gateBlocking: {
        id: 'content.sidebar.gateBlocking',
        defaultMessage: 'blocking'
    },
    gateReady: { id: 'content.sidebar.gateReady', defaultMessage: 'ready' },
    gateFailing: {
        id: 'content.sidebar.gateFailing',
        defaultMessage: 'failing'
    },
    gateAllClear: {
        id: 'content.sidebar.gateAllClear',
        defaultMessage: 'Every check passes — ready to publish.'
    },
    gateCaption: {
        id: 'content.sidebar.gateCaption',
        defaultMessage: 'Checks re-run on every change — fix a field and watch it flip.'
    },
    detailsTitle: {
        id: 'content.sidebar.detailsTitle',
        defaultMessage: 'Details'
    },
    status: { id: 'content.sidebar.status', defaultMessage: 'Status' },
    statusDraft: { id: 'content.sidebar.statusDraft', defaultMessage: 'Draft' },
    statusPublished: {
        id: 'content.sidebar.statusPublished',
        defaultMessage: 'Published'
    },
    statusNew: {
        id: 'content.sidebar.statusNew',
        defaultMessage: 'Not saved yet'
    },
    created: { id: 'content.sidebar.created', defaultMessage: 'Created' },
    updated: { id: 'content.sidebar.updated', defaultMessage: 'Last updated' },
    entryId: { id: 'content.sidebar.entryId', defaultMessage: 'Entry ID' },
    empty: { id: 'content.sidebar.empty', defaultMessage: '—' },
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
 * One label/value row in the details list. Defaults to a side-by-side row (label
 * left, value right); pass `stacked` for a long value (e.g. a UUID) that should
 * sit full-width on its own line beneath the label instead of wrapping awkwardly.
 */
function MetaRow({
    label,
    stacked = false,
    children
}: {
    label: string;
    stacked?: boolean;
    children: React.ReactNode;
}) {
    if (stacked) {
        return (
            <div className="flex flex-col gap-1">
                <dt className="text-xs font-medium text-muted-foreground">
                    {label}
                </dt>
                <dd className="text-sm">{children}</dd>
            </div>
        );
    }
    return (
        <div className="flex items-baseline justify-between gap-3">
            <dt className="text-xs font-medium text-muted-foreground">
                {label}
            </dt>
            <dd className="text-sm">{children}</dd>
        </div>
    );
}

/**
 * The entry editor's right rail. A top **action bar** — a primary button
 * (Publish for a publishable type, else Save) beside a compact **⋯ menu**
 * holding the rest (Save draft, Save & publish, Unpublish, Delete; each
 * permission-gated) — followed by stacked **card blocks**: a live **Publish
 * Gate** (the publish validation, field by field; publishable types only) and a
 * static **Details** block (status, timestamps, id). Replaces the old
 * collapsible-details disclosure.
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
    const dash = intl.formatMessage(messages.empty);

    const canCreate = useHasPermission(CONTENT_CREATE);
    const canUpdate = useHasPermission(CONTENT_UPDATE);
    const canPublish = useHasPermission(CONTENT_PUBLISH);
    const canDelete = useHasPermission(CONTENT_DELETE);
    const canSave = isCreate ? canCreate : canUpdate;

    const busy = saving || mutating;
    const published = entry?.status === ENTRY_STATUS.Published;

    const fmt = (iso?: string) =>
        iso
            ? intl.formatDate(iso, { dateStyle: 'medium', timeStyle: 'short' })
            : dash;

    const statusLabel = isCreate
        ? messages.statusNew
        : published
          ? messages.statusPublished
          : messages.statusDraft;
    const statusVariant = isCreate
        ? 'outline'
        : published
          ? 'default'
          : 'secondary';

    // The primary button: Publish for a publishable type the user may publish,
    // else a plain Save (draft / live). Null when the user can't write at all.
    const primary =
        publishable && canPublish && canSave
            ? { label: messages.publish, icon: Send, onClick: onPublish }
            : canSave
              ? {
                    label: publishable ? messages.saveDraft : messages.save,
                    icon: Save,
                    onClick: onSaveDraft
                }
              : null;

    const showSaveDraftItem = publishable && canSave;
    const showPublishItem = publishable && canPublish && canSave;
    const showUnpublishItem =
        !isCreate && publishable && published && canPublish && !!onUnpublish;
    const showDeleteItem = !isCreate && canDelete && !!onDelete;
    const hasMenu =
        showSaveDraftItem ||
        showPublishItem ||
        showUnpublishItem ||
        showDeleteItem;

    return (
        <aside
            className="flex w-full shrink-0 flex-col gap-4 p-6 lg:w-[22rem]"
            aria-label={intl.formatMessage(messages.aside)}
        >
            {/* Action bar */}
            {(primary || hasMenu) && (
                <div className="flex items-center gap-2">
                    {primary && (
                        <Button
                            type="button"
                            className="flex-1"
                            onClick={primary.onClick}
                            disabled={busy}
                        >
                            {saving ? (
                                <Spinner aria-hidden />
                            ) : (
                                <primary.icon aria-hidden />
                            )}
                            {intl.formatMessage(primary.label)}
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
                                    aria-label={intl.formatMessage(
                                        messages.actions
                                    )}
                                >
                                    <MoreHorizontal aria-hidden />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                {showSaveDraftItem && (
                                    <DropdownMenuItem onSelect={onSaveDraft}>
                                        <Save aria-hidden />
                                        {intl.formatMessage(messages.saveDraft)}
                                    </DropdownMenuItem>
                                )}
                                {showPublishItem && (
                                    <DropdownMenuItem onSelect={onPublish}>
                                        <Send aria-hidden />
                                        {intl.formatMessage(
                                            messages.publishAndSave
                                        )}
                                    </DropdownMenuItem>
                                )}
                                {showUnpublishItem && (
                                    <DropdownMenuItem onSelect={onUnpublish}>
                                        <Undo2 aria-hidden />
                                        {intl.formatMessage(messages.unpublish)}
                                    </DropdownMenuItem>
                                )}
                                {showDeleteItem && (
                                    <>
                                        {(showSaveDraftItem ||
                                            showPublishItem ||
                                            showUnpublishItem) && (
                                            <DropdownMenuSeparator />
                                        )}
                                        <DropdownMenuItem
                                            className="text-destructive focus:text-destructive"
                                            onSelect={() =>
                                                setConfirmDelete(true)
                                            }
                                        >
                                            <Trash2 aria-hidden />
                                            {intl.formatMessage(
                                                messages.deleteEntry
                                            )}
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}

            {/* Publish gate — publishable types only */}
            {publishable && (
                <Card className="border-border/60 bg-muted/20 shadow-none">
                    <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                            {intl.formatMessage(messages.gateTitle)}
                        </CardTitle>
                        <span
                            className={cn(
                                'text-xs font-medium',
                                gate.some((item) => !item.ok)
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                            )}
                        >
                            {intl.formatMessage(
                                gate.some((item) => !item.ok)
                                    ? messages.gateBlocking
                                    : messages.gateReady
                            )}
                        </span>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-2">
                        {gate.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                {intl.formatMessage(messages.gateAllClear)}
                            </p>
                        ) : (
                            <ul className="flex flex-col gap-2">
                                {gate.map((item) => (
                                    <li
                                        key={item.label}
                                        className="flex items-start gap-2 text-sm"
                                    >
                                        {item.ok ? (
                                            <Check
                                                className="mt-0.5 size-4 shrink-0 text-primary"
                                                aria-hidden
                                            />
                                        ) : (
                                            <X
                                                className="mt-0.5 size-4 shrink-0 text-destructive"
                                                aria-hidden
                                            />
                                        )}
                                        <span className="min-w-0 flex-1">
                                            {item.label}
                                        </span>
                                        {!item.ok && (
                                            <span className="shrink-0 text-xs text-destructive">
                                                {item.message ??
                                                    intl.formatMessage(
                                                        messages.gateFailing
                                                    )}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-1 text-xs text-muted-foreground">
                            {intl.formatMessage(messages.gateCaption)}
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Details */}
            <Card className="border-border/60 bg-muted/20 shadow-none">
                <CardHeader>
                    <CardTitle className="text-xs font-medium text-muted-foreground">
                        {intl.formatMessage(messages.detailsTitle)}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <dl className="flex flex-col gap-3">
                        <MetaRow
                            label={intl.formatMessage(messages.entryId)}
                            stacked
                        >
                            <span className="break-all font-mono text-xs text-muted-foreground">
                                {entry?.id ?? dash}
                            </span>
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.status)}>
                            <Badge variant={statusVariant}>
                                {intl.formatMessage(statusLabel)}
                            </Badge>
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.created)}>
                            {fmt(entry?.createdAt)}
                        </MetaRow>
                        <MetaRow label={intl.formatMessage(messages.updated)}>
                            {fmt(entry?.updatedAt)}
                        </MetaRow>
                    </dl>
                </CardContent>
            </Card>

            {showDeleteItem && (
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
