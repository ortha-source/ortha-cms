import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { FileText, Layers, Plus } from 'lucide-react';
import {
    Button,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@ortha-cms/design-system';
import type { ContentType } from '../../../types/wizard';

const messages = defineMessages({
    add: {
        id: 'workspaces.settings.content.add',
        defaultMessage: 'Add content type'
    },
    empty: {
        id: 'workspaces.settings.content.allGranted',
        defaultMessage: 'Every content type is already granted.'
    }
});

/** Props for {@link ContentTypePicker}. */
export type ContentTypePickerProps = {
    /** Content types not yet granted to the workspace. */
    available: ContentType[];
    /** Called with the chosen type's slug. */
    onAdd: (slug: string) => void;
    /** Disables the trigger while an add is in flight. */
    busy?: boolean;
};

/**
 * The "Add content type" control: a popover listing the content types the
 * workspace doesn't yet hold. Choosing one grants it and closes the popover.
 */
export function ContentTypePicker({
    available,
    onAdd,
    busy = false
}: ContentTypePickerProps) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);

    const choose = (slug: string) => {
        onAdd(slug);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button type="button" variant="outline" disabled={busy}>
                    <Plus className="size-4" />
                    {intl.formatMessage(messages.add)}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-1">
                {available.length === 0 ? (
                    <p className="px-2 py-2 text-sm text-muted-foreground">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <ul className="flex max-h-72 flex-col overflow-auto">
                        {available.map((type) => {
                            const isCollection = type.kind !== 'single';
                            return (
                                <li key={type.name}>
                                    <button
                                        type="button"
                                        onClick={() => choose(type.name)}
                                        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                                    >
                                        {isCollection ? (
                                            <Layers className="size-4 shrink-0 text-muted-foreground" />
                                        ) : (
                                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                                        )}
                                        <span className="truncate font-medium">
                                            {type.label ?? type.name}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </PopoverContent>
        </Popover>
    );
}
