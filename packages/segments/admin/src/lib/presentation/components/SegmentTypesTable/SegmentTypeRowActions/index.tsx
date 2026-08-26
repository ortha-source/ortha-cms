import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Pencil, PowerOff } from 'lucide-react';
import {
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    Spinner
} from '@orthacms/design-system';
import {
    isEditable,
    type SegmentType
} from '../../../../domain/types/segmentType';

const messages = defineMessages({
    open: {
        id: 'segments.types.rowMenu',
        defaultMessage: 'Actions for {name}'
    },
    rename: { id: 'segments.types.rename', defaultMessage: 'Rename…' },
    retire: { id: 'segments.types.retire', defaultMessage: 'Retire type' },
    configOnly: {
        id: 'segments.types.configOnly',
        defaultMessage: 'Declared in ortha.config.ts'
    },
    confirmTitle: {
        id: 'segments.types.confirmTitle',
        defaultMessage: 'Retire “{name}”?'
    },
    confirmBody: {
        id: 'segments.types.confirmBody',
        defaultMessage:
            'Every entry this axis was hiding becomes readable, and the {count, plural, one {# segment} other {# segments}} it holds stop applying. The projection slot is cleared and handed back, so this cannot be undone by re-creating the type.'
    },
    confirm: { id: 'segments.types.confirmCta', defaultMessage: 'Retire' },
    cancel: { id: 'segments.types.cancel', defaultMessage: 'Cancel' }
});

/** Props for {@link SegmentTypeRowActions}. */
type SegmentTypeRowActionsProps = {
    /** The row's type. */
    type: SegmentType;
    /** Whether the caller holds `access:manage`. */
    canManage: boolean;
    /** Opens the rename dialog on this type. */
    onRename: (type: SegmentType) => void;
    /** Retires the type. */
    onRetire: (type: SegmentType) => void;
    /** Whether this row's retirement is in flight. */
    retiring: boolean;
};

/**
 * The kebab on a segment-type row: rename, and retire behind a confirm.
 *
 * Retirement gets the full confirm treatment because it is the one action here
 * that changes what readers see *immediately* and cannot be walked back — the
 * slot's columns are zeroed on the way out, so a type re-created under the same
 * key comes back empty rather than restored. The dialog says so in those terms
 * rather than as "are you sure".
 *
 * A type declared in `ortha.config.ts` renders the menu disabled: the server
 * refuses both writes on it, and offering controls that 400 teaches an
 * administrator to distrust the ones that work.
 */
export function SegmentTypeRowActions({
    type,
    canManage,
    onRename,
    onRetire,
    retiring
}: SegmentTypeRowActionsProps) {
    const intl = useIntl();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const editable = isEditable(type);

    if (!canManage) {
        return null;
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="ml-auto"
                        disabled={!editable || retiring}
                        aria-label={intl.formatMessage(messages.open, {
                            name: type.label
                        })}
                        title={
                            editable
                                ? undefined
                                : intl.formatMessage(messages.configOnly)
                        }
                    >
                        {retiring ? (
                            <Spinner />
                        ) : (
                            <MoreHorizontal aria-hidden />
                        )}
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => onRename(type)}>
                        <Pencil aria-hidden />
                        {intl.formatMessage(messages.rename)}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setConfirmOpen(true)}
                    >
                        <PowerOff aria-hidden />
                        {intl.formatMessage(messages.retire)}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                busy={retiring}
                title={intl.formatMessage(messages.confirmTitle, {
                    name: type.label
                })}
                description={intl.formatMessage(messages.confirmBody, {
                    count: type.segmentCount
                })}
                confirmLabel={intl.formatMessage(messages.confirm)}
                cancelLabel={intl.formatMessage(messages.cancel)}
                confirmVariant="destructive"
                onConfirm={() => {
                    setConfirmOpen(false);
                    onRetire(type);
                }}
            />
        </>
    );
}
