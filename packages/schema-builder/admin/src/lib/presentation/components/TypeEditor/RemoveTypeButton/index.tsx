import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Trash2 } from 'lucide-react';
import { Button, ConfirmDialog } from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';

const messages = defineMessages({
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

/** Takes a builder-owned or new type out of the draft, after saying what applying that would cost. */
export function RemoveTypeButton({
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
            <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => setOpen(true)}
            >
                <Trash2 />
                {intl.formatMessage(messages.remove)}
            </Button>
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
