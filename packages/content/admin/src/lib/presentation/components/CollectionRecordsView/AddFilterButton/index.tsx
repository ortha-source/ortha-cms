import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    Button,
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverContent,
    PopoverTrigger
} from '@orthacms/design-system';
import type { FilterField } from '@orthacms/query-builder-admin';

/** Intl descriptors for {@link AddFilterButton}, co-located. */
const messages = defineMessages({
    trigger: {
        id: 'content.records.addFilter.trigger',
        defaultMessage: 'Filter'
    },
    triggerLabel: {
        id: 'content.records.addFilter.triggerLabel',
        defaultMessage: 'Add a filter'
    },
    search: {
        id: 'content.records.addFilter.search',
        defaultMessage: 'Filter by…'
    },
    fields: {
        id: 'content.records.addFilter.fields',
        defaultMessage: 'Fields'
    },
    empty: {
        id: 'content.records.addFilter.empty',
        defaultMessage: 'No field matches.'
    }
});

/**
 * **+ Filter** — the short way to a condition: pick the field first, from one
 * searchable list (the type's own fields, then each relation's), and the
 * filter builder opens with a new condition on it, the operator and value
 * left to fill in. AND / OR groups stay in the builder itself, behind the
 * toolbar's Filters button.
 */
export function AddFilterButton({
    fields,
    disabled = false,
    onPick
}: {
    /** The filterable surface — the same list the builder offers. */
    fields: readonly FilterField[];
    /** The definitions are still loading, or failed. */
    disabled?: boolean;
    /** Called with the picked field. */
    onPick: (field: FilterField) => void;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    // Set on a pick: the builder is about to open, and handing focus back to
    // this trigger on the way out would read as a focus *outside* the builder
    // and dismiss it again.
    const picked = useRef<FilterField | null>(null);

    // Grouped by the relation breadcrumb, own fields first — the order the
    // builder's own picker uses.
    const groups = new Map<string, FilterField[]>();
    for (const field of fields) {
        const key = (field.group ?? [])
            .map((crumb) => intl.formatMessage(crumb))
            .join(' › ');
        groups.set(key, [...(groups.get(key) ?? []), field]);
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    aria-label={intl.formatMessage(messages.triggerLabel)}
                    className="text-muted-foreground"
                >
                    <Plus aria-hidden />
                    {intl.formatMessage(messages.trigger)}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-72 p-0"
                onCloseAutoFocus={(event) => {
                    const field = picked.current;
                    if (!field) return;
                    picked.current = null;
                    event.preventDefault();
                    // After this layer has gone, so the click that picked the
                    // field is not an outside click on the builder.
                    requestAnimationFrame(() => onPick(field));
                }}
            >
                <Command>
                    <CommandInput
                        placeholder={intl.formatMessage(messages.search)}
                        aria-label={intl.formatMessage(messages.search)}
                    />
                    <CommandList className="max-h-80">
                        <CommandEmpty>
                            {intl.formatMessage(messages.empty)}
                        </CommandEmpty>
                        {[...groups].map(([group, items]) => (
                            <CommandGroup
                                key={group || 'own'}
                                heading={
                                    group || intl.formatMessage(messages.fields)
                                }
                            >
                                {items.map((field) => {
                                    const label = intl.formatMessage(
                                        field.label
                                    );
                                    return (
                                        <CommandItem
                                            key={field.id}
                                            value={`${group} ${label} ${field.id}`}
                                            onSelect={() => {
                                                picked.current = field;
                                                setOpen(false);
                                            }}
                                        >
                                            <span className="flex-1 truncate">
                                                {label}
                                            </span>
                                            <span
                                                aria-hidden
                                                className="text-xs text-muted-foreground"
                                            >
                                                {field.type}
                                            </span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
