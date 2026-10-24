import { useRef, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, X } from 'lucide-react';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    Popover,
    PopoverAnchor,
    PopoverContent,
    PopoverTrigger,
    cn
} from '@orthacms/design-system';
import type { WorkspaceOption } from '../../../domain/types/workspaceOption';
import { WorkspaceMonogram } from '../WorkspaceMonogram';

const messages = defineMessages({
    add: {
        id: 'apiTokens.picker.add',
        defaultMessage: 'Add a workspace…'
    },
    search: {
        id: 'apiTokens.picker.search',
        defaultMessage: 'Search workspaces…'
    },
    empty: {
        id: 'apiTokens.picker.empty',
        defaultMessage: 'No workspaces found.'
    },
    remove: {
        id: 'apiTokens.picker.remove',
        defaultMessage: 'Remove {name}'
    }
});

/**
 * The token's workspace bucket as removable chips — each with the workspace's
 * initials tile — followed by an "Add a workspace…" combobox that opens a
 * searchable list. The list stays open while picking, so a multi-workspace
 * bucket is a few clicks rather than a round trip per workspace; a ticked row
 * carries `aria-checked`, and a chip's own ✕ takes it back out.
 *
 * The trigger is the field's labelled control (`id` + the label's
 * `aria-labelledby`), so "Workspaces" is what a screen reader hears on it.
 * The list anchors to the whole field, not the trigger — the trigger shifts
 * as chips wrap — and matches its width. Each row names the workspace and,
 * when set, its description on one truncated line, read as the option's
 * description so its accessible name stays the workspace name.
 */
export function WorkspacePicker({
    id,
    labelId,
    describedBy,
    options,
    value,
    onChange,
    container,
    invalid
}: {
    /** The trigger's id. */
    id: string;
    /** The visible label's id — the trigger is named by it. */
    labelId: string;
    /** Ids of the hint/error text describing the field. */
    describedBy?: string;
    options: WorkspaceOption[];
    value: string[];
    onChange: (next: string[]) => void;
    /** Where the popover portals — inside a dialog, its content element. */
    container?: HTMLElement | null;
    invalid?: boolean;
}) {
    const intl = useIntl();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [search, setSearch] = useState('');
    const selected = new Set(value);
    const byId = new Map(options.map((option) => [option.id, option]));

    const toggle = (workspaceId: string) =>
        onChange(
            selected.has(workspaceId)
                ? value.filter((item) => item !== workspaceId)
                : [...value, workspaceId]
        );

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) setSearch('');
            }}
        >
            <PopoverAnchor asChild>
                <div
                    className={cn(
                        'flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-background px-1.5 py-1 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15',
                        invalid && 'border-destructive'
                    )}
                >
                    {value.map((workspaceId) => {
                        const workspace = byId.get(workspaceId);
                        const name = workspace?.name ?? workspaceId;
                        return (
                            <span
                                key={workspaceId}
                                className="inline-flex h-6 items-center gap-1.5 rounded-md border bg-muted/50 pl-1 pr-0.5 text-xs font-medium"
                            >
                                {workspace ? (
                                    <WorkspaceMonogram
                                        workspace={workspace}
                                        className="size-4 rounded-[4px] text-[8px]"
                                    />
                                ) : null}
                                {name}
                                <button
                                    type="button"
                                    onClick={() => {
                                        toggle(workspaceId);
                                        // The chip — and this button — is gone on the
                                        // next render; hand focus to the add control
                                        // rather than let it fall out of the dialog.
                                        triggerRef.current?.focus();
                                    }}
                                    aria-label={intl.formatMessage(
                                        messages.remove,
                                        {
                                            name
                                        }
                                    )}
                                    className="inline-flex size-5 items-center justify-center rounded-sm text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <X className="size-3" aria-hidden />
                                </button>
                            </span>
                        );
                    })}
                    <PopoverTrigger asChild>
                        <button
                            ref={triggerRef}
                            id={id}
                            type="button"
                            role="combobox"
                            aria-expanded={open}
                            // Radix's Popover trigger declares `dialog`; what
                            // actually opens is a listbox.
                            aria-haspopup="listbox"
                            aria-labelledby={`${labelId} ${id}`}
                            aria-describedby={describedBy}
                            aria-invalid={invalid}
                            aria-required
                            className="h-6 min-w-32 flex-1 rounded-sm px-1.5 text-left text-sm text-muted-foreground outline-none"
                        >
                            {intl.formatMessage(messages.add)}
                        </button>
                    </PopoverTrigger>
                </div>
            </PopoverAnchor>
            <PopoverContent
                aria-labelledby={labelId}
                className="w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
                align="start"
                container={container}
                // Stay inside the dialog: the list shrinks to the room left
                // below the field instead of running under its bottom edge.
                collisionBoundary={container}
                collisionPadding={8}
            >
                <Command className="rounded-none">
                    <CommandInput
                        placeholder={intl.formatMessage(messages.search)}
                        value={search}
                        onValueChange={setSearch}
                    />
                    <CommandList
                        aria-multiselectable="true"
                        className="max-h-[min(300px,calc(var(--radix-popover-content-available-height)-2.75rem))]"
                    >
                        <CommandEmpty>
                            {intl.formatMessage(messages.empty)}
                        </CommandEmpty>
                        <CommandGroup>
                            {options.map((option) => (
                                <CommandItem
                                    key={option.id}
                                    // cmdk filters and highlights by
                                    // `value`; the name rides in
                                    // `keywords` so it is searchable too.
                                    value={option.id}
                                    keywords={[option.name]}
                                    // cmdk owns `aria-selected` (the
                                    // highlight), so chosen-ness rides on
                                    // `aria-checked`.
                                    aria-checked={selected.has(option.id)}
                                    onSelect={() => toggle(option.id)}
                                    aria-label={option.name}
                                    aria-describedby={
                                        option.description
                                            ? `${id}-${option.id}-description`
                                            : undefined
                                    }
                                >
                                    <Check
                                        className={cn(
                                            'size-4',
                                            selected.has(option.id)
                                                ? 'opacity-100'
                                                : 'opacity-0'
                                        )}
                                        aria-hidden
                                    />
                                    <WorkspaceMonogram workspace={option} />
                                    <span className="flex min-w-0 flex-col">
                                        <span className="truncate">
                                            {option.name}
                                        </span>
                                        {option.description ? (
                                            <span
                                                id={`${id}-${option.id}-description`}
                                                className="truncate text-xs text-muted-foreground"
                                            >
                                                {option.description}
                                            </span>
                                        ) : null}
                                    </span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
