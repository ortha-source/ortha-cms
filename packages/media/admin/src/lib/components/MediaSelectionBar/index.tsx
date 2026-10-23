import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    SelectionBar,
    SelectionBarDivider
} from '@orthacms/design-system';
import { Copy, Download, FolderInput, Trash2 } from 'lucide-react';

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

/**
 * The bulk-action bar shown once one or more assets are selected — the
 * design-system `SelectionBar` the records table uses too, floating at the
 * bottom centre of the work area: "{n} selected of {total}", then
 * (permission-gated) Move to… / Download / Duplicate, Delete after a divider,
 * and a ✕ that clears the selection. The count is visual only (the bar
 * mounts/unmounts with the selection); the page owns any spoken announcement.
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
        <SelectionBar
            label={intl.formatMessage(messages.label)}
            clearLabel={intl.formatMessage(messages.clear)}
            onClear={onClear}
            count={
                <>
                    <span className="font-medium">
                        {intl.formatMessage(messages.count, { count })}
                    </span>
                    {total !== undefined ? (
                        <span className="text-xs text-muted-foreground">
                            {intl.formatMessage(messages.of, {
                                total: intl.formatNumber(total)
                            })}
                        </span>
                    ) : null}
                </>
            }
        >
            {canUpdate ? (
                <Button variant="ghost" size="sm" onClick={onMove}>
                    <FolderInput aria-hidden />
                    {intl.formatMessage(messages.move)}
                </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={onDownload}>
                <Download aria-hidden />
                {intl.formatMessage(messages.download)}
            </Button>
            {canCreate ? (
                <Button variant="ghost" size="sm" onClick={onDuplicate}>
                    <Copy aria-hidden />
                    {intl.formatMessage(messages.duplicate)}
                </Button>
            ) : null}
            {canDelete ? (
                <>
                    <SelectionBarDivider />
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 aria-hidden />
                        {intl.formatMessage(messages.delete)}
                    </Button>
                </>
            ) : null}
        </SelectionBar>
    );
}
