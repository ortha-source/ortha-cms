import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Spinner
} from '@orthacms/design-system';
import { canBeDeleted, type Segment } from '../../../../domain/types/segment';

const messages = defineMessages({
    open: {
        id: 'segments.segmentRow.menu',
        defaultMessage: 'Actions for {name}'
    },
    edit: { id: 'segments.segmentRow.edit', defaultMessage: 'Edit…' },
    remove: { id: 'segments.segmentRow.remove', defaultMessage: 'Delete' },
    inUse: {
        id: 'segments.segmentRow.inUse',
        defaultMessage:
            'Used by {count, plural, one {# entry} other {# entries}} — remove it from the rules that name it first'
    },
    maskReason: {
        id: 'segments.segmentRow.maskReason',
        defaultMessage: 'The “Any” segment is removed with its type'
    },
    confirmTitle: {
        id: 'segments.segmentRow.confirmTitle',
        defaultMessage: 'Delete “{name}”?'
    },
    confirmBody: {
        id: 'segments.segmentRow.confirmBody',
        defaultMessage:
            'Nothing references it, so nothing changes for any reader. Readers carrying its tags simply stop resolving to a segment.'
    },
    confirm: { id: 'segments.segmentRow.confirmCta', defaultMessage: 'Delete' },
    cancel: { id: 'segments.segmentRow.cancel', defaultMessage: 'Cancel' }
});

/** Props for {@link SegmentRowActions}. */
type SegmentRowActionsProps = {
    /** The row's segment. */
    segment: Segment;
    /** Whether the caller holds `access:manage`. */
    canManage: boolean;
    /** Opens the edit dialog. */
    onEdit: (segment: Segment) => void;
    /** Deletes the segment. */
    onDelete: (segment: Segment) => void;
    /** Whether this row's delete is in flight. */
    deleting: boolean;
};

/**
 * The kebab on a segment row.
 *
 * Delete is disabled with the reason spelled out rather than offered and then
 * refused: the server answers 409 while projected entries name the segment, and
 * "409" is not a sentence an editor can act on. `canBeDeleted` is the UX mirror
 * of that refusal — the server still enforces it; this only saves the round trip
 * and turns the outcome into an explanation.
 */
export function SegmentRowActions({
    segment,
    canManage,
    onEdit,
    onDelete,
    deleting
}: SegmentRowActionsProps) {
    const intl = useIntl();
    const [confirmOpen, setConfirmOpen] = useState(false);

    if (!canManage) {
        return null;
    }

    const deletable = canBeDeleted(segment);
    const isMask = segment.kind === 'mask';
    const deleteReason = deletable.ok
        ? undefined
        : deletable.reason === 'mask'
          ? intl.formatMessage(messages.maskReason)
          : intl.formatMessage(messages.inUse, { count: segment.usageCount });

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        disabled={deleting}
                        aria-label={intl.formatMessage(messages.open, {
                            name: segment.label
                        })}
                    >
                        {deleting ? (
                            <Spinner />
                        ) : (
                            <MoreHorizontal aria-hidden />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {/* A mask carries no tags and its label comes from the
                        type's, so there is nothing on it to edit. */}
                    <DropdownMenuItem
                        disabled={isMask}
                        onSelect={() => onEdit(segment)}
                    >
                        <Pencil aria-hidden />
                        {intl.formatMessage(messages.edit)}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={!deletable.ok}
                        title={deleteReason}
                        onSelect={() => setConfirmOpen(true)}
                    >
                        <Trash2 aria-hidden />
                        {intl.formatMessage(messages.remove)}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                busy={deleting}
                title={intl.formatMessage(messages.confirmTitle, {
                    name: segment.label
                })}
                description={intl.formatMessage(messages.confirmBody)}
                confirmLabel={intl.formatMessage(messages.confirm)}
                cancelLabel={intl.formatMessage(messages.cancel)}
                confirmVariant="destructive"
                onConfirm={() => {
                    setConfirmOpen(false);
                    onDelete(segment);
                }}
            />
        </>
    );
}
