import { defineMessages, useIntl } from 'react-intl';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    cn
} from '@ortha-cms/design-system';
import type { FieldState } from '../../../hooks/useRecordEditor';

const messages = defineMessages({
    title: {
        id: 'content.record.jump.title',
        defaultMessage: 'Jump to field'
    },
    placeholder: {
        id: 'content.record.jump.placeholder',
        defaultMessage: 'Search fields…'
    },
    empty: {
        id: 'content.record.jump.empty',
        defaultMessage: 'No matching fields.'
    }
});

/**
 * The ⌘/Ctrl-J field-jump palette: a command dialog listing every field with its
 * live status dot. Selecting one jumps to and focuses it. Keyed searches match
 * the field label (cmdk's built-in filter).
 */
export function FieldJumpPalette({
    open,
    onOpenChange,
    fieldStates,
    onJump
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    fieldStates: FieldState[];
    onJump: (key: string) => void;
}) {
    const intl = useIntl();
    return (
        <CommandDialog
            open={open}
            onOpenChange={onOpenChange}
            title={intl.formatMessage(messages.title)}
            description={intl.formatMessage(messages.placeholder)}
        >
            <CommandInput
                placeholder={intl.formatMessage(messages.placeholder)}
            />
            <CommandList>
                <CommandEmpty>
                    {intl.formatMessage(messages.empty)}
                </CommandEmpty>
                <CommandGroup>
                    {fieldStates.map((state) => (
                        <CommandItem
                            key={state.field.key}
                            value={`${state.field.label} ${state.field.key}`}
                            onSelect={() => {
                                onOpenChange(false);
                                onJump(state.field.key);
                            }}
                            className="gap-2"
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    state.blocking
                                        ? 'bg-destructive'
                                        : state.filled
                                          ? 'bg-foreground'
                                          : 'border border-muted-foreground'
                                )}
                            />
                            <span className="flex-1 truncate">
                                {state.field.label}
                            </span>
                        </CommandItem>
                    ))}
                </CommandGroup>
            </CommandList>
        </CommandDialog>
    );
}
