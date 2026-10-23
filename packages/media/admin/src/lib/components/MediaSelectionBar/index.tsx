import { defineMessages, useIntl } from 'react-intl';
import { Button, cn } from '@orthacms/design-system';
import { Copy, Download, FolderInput, Trash2, X } from 'lucide-react';

/** Intl descriptors for {@link MediaSelectionBar}, co-located. */
const messages = defineMessages({
    label: { id: 'media.selection.label', defaultMessage: 'Selection' },
    count: {
        id: 'media.selection.count',
        defaultMessage: '{count, plural, one {# selected} other {# selected}}'
    },
    of: { id: 'media.selection.of', defaultMessage: 'of {total}' },
    download: { id: 'media.selection.download', defaultMessage: 'Download' },
    duplicate: { id: 'media.selection.duplicate', defaultMessage: 'Duplicate' },
    move: { id: 'media.selection.move', defaultMessage: 'Move to…' },
    delete: { id: 'media.selection.delete', defaultMessage: 'Delete' },
    clear: { id: 'media.selection.clear', defaultMessage: 'Clear selection' }
});

/** A ghost button drawn for the dark bar. */
const barButton =
    'shrink-0 text-background hover:bg-background/10 hover:text-background';

/**
 * The bulk-action bar shown once one or more assets are selected — the same
 * dark bar the records table raises for its selection: "{n} selected of
 * {total}", then (permission-gated) Move to… / Download / Duplicate, Delete
 * pushed to the far end away from them, and a ✕ that clears the selection.
 * The count is visual only (the bar mounts/unmounts with the selection); the
 * page owns any spoken announcement.
 */
export function MediaSelectionBar({
    count,
    total,
    onDownload,
    onDuplicate,
    onMove,
    onDelete,
    onClear,
    canCreate,
    canUpdate,
    canDelete
}: {
    count: number;
    /** Every file matching the controls, across pages. */
    total?: number;
    onDownload: () => void;
    onDuplicate: () => void;
    onMove: () => void;
    onDelete: () => void;
    onClear: () => void;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
}) {
    const intl = useIntl();

    return (
        <div
            role="group"
            aria-label={intl.formatMessage(messages.label)}
            className="mb-4 flex min-h-10 flex-wrap items-center gap-1 rounded-xl bg-foreground py-1 pl-4 pr-1.5 text-background"
        >
            <span className="mr-2 flex items-baseline gap-1.5 text-sm">
                <span className="font-medium">
                    {intl.formatMessage(messages.count, { count })}
                </span>
                {total !== undefined ? (
                    <span className="text-xs text-background/65">
                        {intl.formatMessage(messages.of, {
                            total: intl.formatNumber(total)
                        })}
                    </span>
                ) : null}
            </span>
            <span
                aria-hidden
                className="mx-1 h-4 w-px shrink-0 bg-background/25"
            />
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-0.5">
                {canUpdate ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={barButton}
                        onClick={onMove}
                    >
                        <FolderInput aria-hidden />
                        {intl.formatMessage(messages.move)}
                    </Button>
                ) : null}
                <Button
                    variant="ghost"
                    size="sm"
                    className={barButton}
                    onClick={onDownload}
                >
                    <Download aria-hidden />
                    {intl.formatMessage(messages.download)}
                </Button>
                {canCreate ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        className={barButton}
                        onClick={onDuplicate}
                    >
                        <Copy aria-hidden />
                        {intl.formatMessage(messages.duplicate)}
                    </Button>
                ) : null}
                {canDelete ? (
                    <>
                        <span aria-hidden className="ml-auto" />
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                barButton,
                                'text-red-300 hover:text-red-200 dark:text-red-600 dark:hover:text-red-700'
                            )}
                            onClick={onDelete}
                        >
                            <Trash2 aria-hidden />
                            {intl.formatMessage(messages.delete)}
                        </Button>
                    </>
                ) : null}
            </div>
            <span
                aria-hidden
                className="mx-1 h-4 w-px shrink-0 bg-background/25"
            />
            <Button
                variant="ghost"
                size="icon-sm"
                className={barButton}
                onClick={onClear}
                aria-label={intl.formatMessage(messages.clear)}
            >
                <X aria-hidden />
            </Button>
        </div>
    );
}
