import { defineMessages, useIntl } from 'react-intl';
import { Trash2 } from 'lucide-react';
import {
    Button,
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle
} from '@orthacms/design-system';
import type { GroupDoc } from '@orthacms/schema-builder-domain';
import { GroupFields } from '../GroupFields';

const messages = defineMessages({
    title: {
        id: 'schemaBuilder.groupSheet.title',
        defaultMessage: 'Group {label}'
    },
    description: {
        id: 'schemaBuilder.groupSheet.description',
        defaultMessage:
            'An accordion block on the General tab. Changes go into the draft as you make them.'
    },
    remove: {
        id: 'schemaBuilder.groupSheet.remove',
        defaultMessage: 'Remove group'
    },
    removeHint: {
        id: 'schemaBuilder.groupSheet.removeHint',
        defaultMessage:
            'Its fields stay, above the groups. Nothing is deleted from the database.'
    },
    done: { id: 'schemaBuilder.groupSheet.done', defaultMessage: 'Done' },
    close: { id: 'schemaBuilder.groupSheet.close', defaultMessage: 'Close' }
});

type Props = {
    /** The group being edited; `null` keeps the sheet closed. */
    group: GroupDoc | null;
    onChange: (group: GroupDoc) => void;
    onRemove: () => void;
    onClose: () => void;
};

/**
 * One group, edited from its own block on General: title, description,
 * whether it starts folded — and removing it, which sends its fields back
 * to the loose fields (`groups.set`).
 */
export function GroupSheet({ group, onChange, onRemove, onClose }: Props) {
    const intl = useIntl();
    return (
        <Sheet
            open={Boolean(group)}
            onOpenChange={(open) => !open && onClose()}
        >
            <SheetContent
                className="flex w-full flex-col overflow-y-auto sm:max-w-lg"
                closeLabel={intl.formatMessage(messages.close)}
            >
                {group && (
                    <>
                        <SheetHeader>
                            <SheetTitle>
                                {intl.formatMessage(messages.title, {
                                    label: group.label || group.key
                                })}
                            </SheetTitle>
                            <SheetDescription>
                                {intl.formatMessage(messages.description)}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="flex flex-col gap-4 px-4">
                            <GroupFields group={group} onChange={onChange} />
                            <div className="flex flex-col items-start gap-1.5 border-t pt-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="text-destructive"
                                    aria-describedby="group-sheet-remove-hint"
                                    onClick={onRemove}
                                >
                                    <Trash2 />
                                    {intl.formatMessage(messages.remove)}
                                </Button>
                                <p
                                    id="group-sheet-remove-hint"
                                    className="text-xs text-muted-foreground"
                                >
                                    {intl.formatMessage(messages.removeHint)}
                                </p>
                            </div>
                        </div>
                        <SheetFooter>
                            <Button onClick={onClose}>
                                {intl.formatMessage(messages.done)}
                            </Button>
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
