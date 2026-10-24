import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import {
    Button,
    ConfirmDialog,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
    actions: {
        id: 'schemaBuilder.type.actions',
        defaultMessage: 'More actions for {label}'
    },
    remove: { id: 'schemaBuilder.type.remove', defaultMessage: 'Remove type' },
    title: {
        id: 'schemaBuilder.type.removeTitle',
        defaultMessage: 'Remove {label}?'
    },
    existing: {
        id: 'schemaBuilder.type.removeExisting',
        defaultMessage:
            'Applying this deletes its table and every entry in it. The review asks you to confirm it again.'
    },
    fresh: {
        id: 'schemaBuilder.type.removeNew',
        defaultMessage: 'It has not been created yet, so nothing else is lost.'
    },
    confirm: {
        id: 'schemaBuilder.type.removeConfirm',
        defaultMessage: 'Remove from the draft'
    }
});

/**
 * The type's ⋯ in its header: what is done to the type as a whole, today
 * only taking it out of the draft — after saying what applying that would
 * cost. The confirm is rendered outside the menu, which unmounts as it closes.
 */
export function TypeMenu({
    type,
    onRemove
}: {
    type: TypeDoc;
    onRemove: () => void;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const label = type.label || type.name;
    return (
        <>
            <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        aria-label={intl.formatMessage(messages.actions, {
                            label
                        })}
                    >
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => setOpen(true)}
                    >
                        <Trash2 />
                        {intl.formatMessage(messages.remove)}
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
            <ConfirmDialog
                open={open}
                onOpenChange={setOpen}
                title={intl.formatMessage(messages.title, { label })}
                description={intl.formatMessage(
                    type.origin === 'new' ? messages.fresh : messages.existing
                )}
                confirmLabel={intl.formatMessage(messages.confirm)}
                confirmVariant="destructive"
                onConfirm={() => {
                    setOpen(false);
                    onRemove();
                }}
            />
        </>
    );
}
