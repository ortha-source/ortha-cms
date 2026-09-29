import { defineMessages, useIntl } from 'react-intl';
import { Filter, Search } from 'lucide-react';
import {
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Input,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Spinner
} from '@orthacms/design-system';
import {
    QueryBuilder,
    countRules,
    type FilterField,
    type FilterGroup,
    type RelationValueEditor
} from '@orthacms/query-builder-admin';
import type { EntrySource } from '../../../../../../../domain/types/contentType';
import {
    sharedChoice,
    type SourceChoice
} from '../../../../../../../domain/contentTypeAccess';

const messages = defineMessages({
    search: {
        id: 'content.relations.picker.search',
        defaultMessage: 'Search {label}…'
    },
    filters: {
        id: 'content.relations.picker.filters',
        defaultMessage: 'Filters'
    },
    filtersCount: {
        id: 'content.relations.picker.filtersCount',
        defaultMessage: 'Filters ({count})'
    },
    clearFilters: {
        id: 'content.relations.picker.clearFilters',
        defaultMessage: 'Clear filters'
    },
    fieldsError: {
        id: 'content.relations.picker.fieldsError',
        defaultMessage: "Couldn't load filters."
    },
    retry: {
        id: 'content.relations.picker.retry',
        defaultMessage: 'Try again'
    },
    source: {
        id: 'content.relations.picker.source',
        defaultMessage: 'Source'
    },
    sourceAll: {
        id: 'content.relations.picker.sourceAll',
        defaultMessage: 'All'
    },
    sourceOwn: {
        id: 'content.relations.picker.sourceOwn',
        defaultMessage: 'This workspace'
    }
});

/**
 * The relation picker's search box, its **Source** select (all / this
 * workspace / each shared workspace by name — only the sources that exist for
 * the target), plus an **inline, collapsible** query-builder
 * filter over the target type's schema — a disclosure *inside* the picker
 * dialog, deliberately not a nested modal/drawer (which would stack focus traps).
 * Controlled: the parent owns `search`/`filter`/`open` and re-runs the candidate
 * query on change.
 */
export function RelationPickerFilters({
    targetLabel,
    search,
    onSearchChange,
    busy = false,
    filterFields,
    filter,
    onFilterChange,
    open,
    onOpenChange,
    portalContainer,
    renderRelationValue,
    fieldsError = false,
    onRetryFields,
    source,
    onSourceChange,
    ownAvailable,
    sharedSources
}: {
    targetLabel: string;
    search: string;
    onSearchChange: (next: string) => void;
    /**
     * Whether a candidate request driven from this box is still settling. The
     * picker searches **server-side**, so without a cue the box looks inert
     * while it waits.
     */
    busy?: boolean;
    filterFields: readonly FilterField[];
    filter: FilterGroup | null;
    /** Apply a new tree, or `null` to clear all rules. */
    onFilterChange: (next: FilterGroup | null) => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Dialog element the query builder's popovers portal into (mouse-wheel fix). */
    portalContainer?: HTMLElement | null;
    /** Record picker for a relation-id rule, forwarded to the query builder. */
    renderRelationValue?: RelationValueEditor;
    /**
     * The filterable surface failed to load. The trigger is disabled either
     * way (an empty `filterFields` can't build a rule), but a failure has to
     * say so — otherwise a disabled Filters button is indistinguishable from
     * a target type that simply has nothing to filter on.
     */
    fieldsError?: boolean;
    /** Retry the surface request; renders a Try again action when set. */
    onRetryFields?: () => void;
    /**
     * Which records are offered: every reachable source, this workspace's
     * own, or one shared workspace's published ones.
     */
    source: SourceChoice;
    /** Change the source (the parent re-runs the candidate query). */
    onSourceChange: (next: SourceChoice) => void;
    /** Whether the workspace holds its own records of the target. */
    ownAvailable: boolean;
    /** The shared workspaces the target is read from, each an option. */
    sharedSources: readonly EntrySource[];
}) {
    const intl = useIntl();
    const ruleCount = countRules(filter);
    const searchLabel = intl.formatMessage(messages.search, {
        label: targetLabel
    });
    const sourceLabel = intl.formatMessage(messages.source);
    // Only the sources that exist for this target: "This workspace" when it
    // holds its own records, then each shared workspace by name.
    const options: { value: SourceChoice; label: string }[] = [
        { value: 'all', label: intl.formatMessage(messages.sourceAll) },
        ...(ownAvailable
            ? [
                  {
                      value: 'own' as const,
                      label: intl.formatMessage(messages.sourceOwn)
                  }
              ]
            : []),
        ...sharedSources.map((shared) => ({
            value: sharedChoice(shared.workspaceId),
            label: shared.workspaceName
        }))
    ];

    return (
        <Collapsible open={open} onOpenChange={onOpenChange}>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    {busy ? (
                        <Spinner
                            aria-hidden
                            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        />
                    ) : (
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    )}
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="pl-8 shadow-none"
                        aria-label={searchLabel}
                        placeholder={searchLabel}
                    />
                </div>
                {/* Beside Filters because it narrows the same list — but a
                    control of its own, not a query-builder rule: where a
                    record lives isn't a field of the record. Labelled by
                    `aria-label`, like the records table's rows-per-page
                    select; the trigger shows the chosen option's name. */}
                <Select
                    value={source}
                    onValueChange={(next) => {
                        // Radix hands back a plain string; accept only one of
                        // the offered choices.
                        const option = options.find((o) => o.value === next);
                        if (option) onSourceChange(option.value);
                    }}
                >
                    <SelectTrigger
                        className="w-40 shrink-0 shadow-none"
                        aria-label={sourceLabel}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <CollapsibleTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        className="shrink-0 shadow-none"
                        disabled={filterFields.length === 0}
                    >
                        <Filter className="size-4" />
                        {ruleCount > 0
                            ? intl.formatMessage(messages.filtersCount, {
                                  count: ruleCount
                              })
                            : intl.formatMessage(messages.filters)}
                    </Button>
                </CollapsibleTrigger>
            </div>
            {fieldsError ? (
                <p
                    role="alert"
                    className="mt-2 flex items-center gap-2 text-xs text-destructive"
                >
                    {intl.formatMessage(messages.fieldsError)}
                    {onRetryFields ? (
                        <button
                            type="button"
                            onClick={onRetryFields}
                            className="underline underline-offset-2"
                        >
                            {intl.formatMessage(messages.retry)}
                        </button>
                    ) : null}
                </p>
            ) : null}
            <CollapsibleContent>
                <div className="mt-3 flex max-h-56 flex-col gap-2 overflow-y-auto rounded-lg border p-3">
                    <QueryBuilder
                        fields={filterFields}
                        value={filter}
                        onChange={onFilterChange}
                        portalContainer={portalContainer}
                        renderRelationValue={renderRelationValue}
                    />
                    {ruleCount > 0 ? (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="self-start"
                            onClick={() => onFilterChange(null)}
                        >
                            {intl.formatMessage(messages.clearFilters)}
                        </Button>
                    ) : null}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
