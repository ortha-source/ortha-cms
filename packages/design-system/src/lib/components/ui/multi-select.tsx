'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '../../utils';
import { Badge } from './badge';
import { Button } from './button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from './command';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

/** One selectable option. */
type MultiSelectOption = {
    value: string;
    label: string;
};

type MultiSelectProps = {
    /** The available options. */
    options: MultiSelectOption[];
    /** Currently-selected values. */
    value: string[];
    /** Called with the next selection when an option is toggled. */
    onChange: (value: string[]) => void;
    /** Trigger placeholder when nothing is selected. */
    placeholder?: string;
    /** Placeholder for the in-popover search box. */
    searchPlaceholder?: string;
    /** Shown when the search matches no option. */
    emptyText?: string;
    /** Trigger id (wires an external `<label htmlFor>`). */
    id?: string;
    /** Marks the trigger invalid (`aria-invalid`). */
    invalid?: boolean;
    /** Disables the control. */
    disabled?: boolean;
    className?: string;
};

/**
 * A searchable multi-select built from `Popover` + `Command` + `Badge` (shadcn
 * has no core multi-select). The trigger shows the selected options as removable
 * badges; the popover lists options with a check on the selected ones. Fully
 * controlled via `value`/`onChange`.
 */
function MultiSelect({
    options,
    value,
    onChange,
    placeholder = 'Select…',
    searchPlaceholder = 'Search…',
    emptyText = 'No results.',
    id,
    invalid,
    disabled,
    className
}: MultiSelectProps) {
    const [open, setOpen] = React.useState(false);
    const selected = new Set(value);

    const toggle = (option: string) =>
        onChange(
            selected.has(option)
                ? value.filter((item) => item !== option)
                : [...value, option]
        );

    const labelOf = (val: string) =>
        options.find((option) => option.value === val)?.label ?? val;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid}
                    disabled={disabled}
                    className={cn(
                        'h-auto min-h-9 w-full justify-between px-3 py-1.5 font-normal shadow-none hover:bg-background',
                        className
                    )}
                >
                    <span className="flex flex-1 flex-wrap items-center gap-1">
                        {value.length === 0 ? (
                            <span className="text-muted-foreground">
                                {placeholder}
                            </span>
                        ) : (
                            value.map((val) => (
                                <Badge key={val} variant="secondary">
                                    {labelOf(val)}
                                </Badge>
                            ))
                        )}
                    </span>
                    <ChevronsUpDown
                        className="size-4 shrink-0 opacity-50"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
            >
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.value}
                                    value={option.label}
                                    onSelect={() => toggle(option.value)}
                                >
                                    <Check
                                        className={cn(
                                            'size-4',
                                            selected.has(option.value)
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        )}
                                        aria-hidden
                                    />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export { MultiSelect };
export type { MultiSelectOption, MultiSelectProps };
