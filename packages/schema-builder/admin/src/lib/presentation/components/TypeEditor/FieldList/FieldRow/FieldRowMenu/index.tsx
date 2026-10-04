import { defineMessages, useIntl } from 'react-intl';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
    Button,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@orthacms/design-system';

const messages = defineMessages({
    actions: {
        id: 'schemaBuilder.field.actions',
        defaultMessage: 'Actions for {name}'
    },
    edit: { id: 'schemaBuilder.field.edit', defaultMessage: 'Edit' },
    remove: { id: 'schemaBuilder.field.remove', defaultMessage: 'Remove' }
});

type Props = { name: string; onEdit: () => void; onRemove: () => void };

/** A field's actions. Removing only changes the draft; the review confirms what it deletes. */
export function FieldRowMenu({ name, onEdit, onRemove }: Props) {
    const intl = useIntl();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={intl.formatMessage(messages.actions, { name })}
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>
                    <Pencil />
                    {intl.formatMessage(messages.edit)}
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="text-destructive"
                    onSelect={onRemove}
                >
                    <Trash2 />
                    {intl.formatMessage(messages.remove)}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
