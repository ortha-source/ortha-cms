import { useState, type UIEvent } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import {
    Badge,
    Button,
    Input,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Spinner,
    cn
} from '@ortha-cms/design-system';
import {
    usePortalContainer,
    type RelationValueEditorProps
} from '@ortha-cms/query-builder-admin';
import { useContentSchema } from '../../../application/useContentSchema';
import { useRelationCandidates } from '../../../application/useRelationCandidates';

const messages = defineMessages({
    trigger: {
        id: 'content.filter.relation.trigger',
        defaultMessage:
            '{count, plural, =0 {Select records} one {# record} other {# records}}'
    },
    search: {
        id: 'content.filter.relation.search',
        defaultMessage: 'Search records'
    },
    empty: {
        id: 'content.filter.relation.empty',
        defaultMessage: 'No matching records'
    },
    list: {
        id: 'content.filter.relation.list',
        defaultMessage: 'Records'
    },
    remove: {
        id: 'content.filter.relation.remove',
        defaultMessage: 'Remove {title}'
    }
});

/** Threshold (px) from the list bottom that triggers the next candidate page. */
const SCROLL_THRESHOLD = 120;

/**
 * Value editor for a relation-id filter rule: a searchable, lazily-paginated
 * multi-select of the target type's records.
 *
 * Injected into the query builder via `renderRelationValue` (that package holds
 * no data layer). Reuses `useRelationCandidates` — the same `GET /content/:target`
 * the entry editor's relation picker uses — so search, pagination and title
 * derivation behave identically in both places, and the target type's own
 * filters stay available. A selected id that is not in the loaded window (a
 * filter restored from the URL before its page loads) shows as a short id, never
 * a blank chip.
 *
 * Rendered by the consumer as `<RelationValuePicker {...props} />` so its hooks
 * live in their own component scope, not inside the query builder's cell.
 */
export function RelationValuePicker({
    target,
    value,
    onChange,
    disabled,
    invalid,
    describedById
}: RelationValueEditorProps) {
    const intl = useIntl();
    const container = usePortalContainer();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');

    // The target schema drives candidate titles (same as the relation picker);
    // gated on the popover being open so a closed rule registers no queries.
    const { data: schema } = useContentSchema(target, open);
    const { items, hasMore, isPending, isFetchingNextPage, fetchNextPage } =
        useRelationCandidates(
            target,
            schema?.fields ?? [],
            { search },
            open
        );

    const selected = new Set(value);
    const titleById = new Map(items.map((c) => [c.id, c.title]));
    const titleFor = (id: string) => titleById.get(id) ?? id.slice(0, 8);

    const toggle = (id: string) => {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        onChange([...next]);
    };

    const handleScroll = (event: UIEvent<HTMLDivElement>) => {
        const el = event.currentTarget;
        if (
            el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD &&
            hasMore &&
            !isFetchingNextPage
        ) {
            fetchNextPage();
        }
    };

    return (
        <div className="flex w-full flex-col gap-1.5">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        aria-invalid={invalid || undefined}
                        aria-describedby={describedById}
                        disabled={disabled}
                        className="w-full justify-between font-normal"
                    >
                        <span className="truncate">
                            {intl.formatMessage(messages.trigger, {
                                count: value.length
                            })}
                        </span>
                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-[300px] p-2"
                    align="start"
                    container={container}
                >
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={intl.formatMessage(messages.search)}
                        aria-label={intl.formatMessage(messages.search)}
                        className="mb-1 h-8 rounded-lg shadow-none"
                    />
                    {/* Plain scroll container → the mouse wheel drives the list
                        (cmdk's own list does not), and infinite-scroll pages in
                        as it nears the bottom. */}
                    <div
                        role="listbox"
                        aria-label={intl.formatMessage(messages.list)}
                        onScroll={handleScroll}
                        className="max-h-72 overflow-y-auto"
                    >
                        {items.length === 0 && !isPending ? (
                            <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                                {intl.formatMessage(messages.empty)}
                            </p>
                        ) : (
                            items.map((candidate) => {
                                const isSelected = selected.has(candidate.id);
                                return (
                                    <button
                                        key={candidate.id}
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        onClick={() => toggle(candidate.id)}
                                        className={cn(
                                            'flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm',
                                            'hover:bg-accent hover:text-accent-foreground',
                                            'focus-visible:bg-accent focus-visible:outline-none',
                                            isSelected && 'bg-accent/50'
                                        )}
                                    >
                                        <Check
                                            aria-hidden
                                            className={cn(
                                                'mr-2 size-4 shrink-0',
                                                isSelected
                                                    ? 'opacity-100'
                                                    : 'opacity-0'
                                            )}
                                        />
                                        <span className="truncate">
                                            {candidate.title}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                        {isFetchingNextPage && (
                            <div className="flex justify-center py-2">
                                <Spinner className="size-4" />
                            </div>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
            {value.length > 0 && (
                <div className="flex flex-wrap gap-1">
                    {value.map((id) => (
                        <Badge
                            key={id}
                            variant="secondary"
                            className="max-w-full gap-1"
                        >
                            <span className="truncate">{titleFor(id)}</span>
                            <button
                                type="button"
                                aria-label={intl.formatMessage(
                                    messages.remove,
                                    { title: titleFor(id) }
                                )}
                                onClick={() => toggle(id)}
                                className="shrink-0 opacity-60 hover:opacity-100"
                            >
                                <X className="size-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    );
}
