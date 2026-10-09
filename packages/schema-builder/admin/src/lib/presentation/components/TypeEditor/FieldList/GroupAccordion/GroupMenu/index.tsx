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
        id: 'schemaBuilder.group.actions',
        defaultMessage: 'Actions for the group {label}'
    },
    edit: { id: 'schemaBuilder.group.edit', defaultMessage: 'Edit group' },
    remove: {
        id: 'schemaBuilder.group.remove',
        defaultMessage: 'Remove group'
    }
});

type Props = { label: string; onEdit: () => void; onRemove: () => void };

/** A group's actions, on its own block. Removing keeps its fields, loose. */
export function GroupMenu({ label, onEdit, onRemove }: Props) {
    const intl = useIntl();
    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    aria-label={intl.formatMessage(messages.actions, { label })}
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
