import { defineMessages, useIntl } from 'react-intl';
import { ListPlus, Plus } from 'lucide-react';
import {
    Button,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle
} from '@orthacms/design-system';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.fields.emptyTitle',
        defaultMessage: 'No fields yet'
    },
    description: {
        id: 'schemaBuilder.fields.emptyDescription',
        defaultMessage:
            'Fields are what an entry holds — a title, a body, a price, a link to another type. A type needs at least one before it can be applied.'
    },
    readOnly: {
        id: 'schemaBuilder.fields.emptyReadOnly',
        defaultMessage: 'This type declares no fields.'
    },
    add: {
        id: 'schemaBuilder.fields.addFirst',
        defaultMessage: 'Add the first field'
    }
});

/** A type with no fields — a new one, most of the time: what fields are, and the way in. */
export function NoFields({ onAdd }: { onAdd?: () => void }) {
    const intl = useIntl();
    return (
        <Empty className="border-t py-10">
            <EmptyHeader>
                <EmptyMedia variant="icon">
                    <ListPlus />
                </EmptyMedia>
                <EmptyTitle>{intl.formatMessage(messages.title)}</EmptyTitle>
                <EmptyDescription>
                    {intl.formatMessage(
                        onAdd ? messages.description : messages.readOnly
                    )}
                </EmptyDescription>
            </EmptyHeader>
            {onAdd && (
                <EmptyContent>
                    <Button onClick={onAdd}>
                        <Plus />
                        {intl.formatMessage(messages.add)}
                    </Button>
                </EmptyContent>
            )}
        </Empty>
    );
}
