import { defineMessages, useIntl } from 'react-intl';
import {
    Button,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle
} from '@orthacms/design-system';
import type { TypeDoc } from '@orthacms/schema-builder-domain';
import type { TypePatch } from '../../../../domain/schemaDraftAction';
import { TypeSettings } from '../TypeSettings';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.settings.title',
        defaultMessage: '{label} settings'
    },
    description: {
        id: 'schemaBuilder.settings.description',
        defaultMessage:
            'What the type is called, what it is for, and how its entries are stored. Every change lands in the draft at once.'
    },
    done: { id: 'schemaBuilder.settings.done', defaultMessage: 'Done' },
    close: { id: 'schemaBuilder.settings.close', defaultMessage: 'Close' }
});

type Props = {
    type: TypeDoc;
    served: TypeDoc | undefined;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onChange: (patch: TypePatch) => void;
};

/** The type's label, machine name, description and flags, in a sheet off its header. */
export function TypeSettingsSheet({
    type,
    served,
    open,
    onOpenChange,
    onChange
}: Props) {
    const intl = useIntl();
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                className="flex w-full flex-col overflow-y-auto sm:max-w-md"
                closeLabel={intl.formatMessage(messages.close)}
            >
                <SheetHeader>
                    <SheetTitle>
                        {intl.formatMessage(messages.title, {
                            label: type.label || type.name
                        })}
                    </SheetTitle>
                    <SheetDescription>
                        {intl.formatMessage(messages.description)}
                    </SheetDescription>
                </SheetHeader>
                <div className="px-4">
                    <TypeSettings
                        type={type}
                        served={served}
                        onChange={onChange}
                    />
                </div>
                <SheetFooter>
                    <Button onClick={() => onOpenChange(false)}>
                        {intl.formatMessage(messages.done)}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
