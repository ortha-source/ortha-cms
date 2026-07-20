import { defineMessages, useIntl } from 'react-intl';
import { Filter, Search } from 'lucide-react';
import {
    Button,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Input
} from '@ortha-cms/design-system';
import {
    QueryBuilder,
    countRules,
    type FilterField,
    type FilterGroup,
    type RelationValueEditor
} from '@ortha-cms/query-builder-admin';

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
    }
});

/**
 * The relation picker's search box plus an **inline, collapsible** query-builder
 * filter over the target type's schema — a disclosure *inside* the picker
 * dialog, deliberately not a nested modal/drawer (which would stack focus traps).
 * Controlled: the parent owns `search`/`filter`/`open` and re-runs the candidate
 * query on change.
 */
export function RelationPickerFilters({
    targetLabel,
    search,
    onSearchChange,
    filterFields,
    filter,
    onFilterChange,
    open,
    onOpenChange,
    portalContainer,
    renderRelationValue
}: {
    targetLabel: string;
    search: string;
    onSearchChange: (next: string) => void;
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
}) {
    const intl = useIntl();
    const ruleCount = countRules(filter);
    const searchLabel = intl.formatMessage(messages.search, {
        label: targetLabel
    });

    return (
        <Collapsible open={open} onOpenChange={onOpenChange}>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="pl-8 shadow-none"
                        aria-label={searchLabel}
                        placeholder={searchLabel}
                    />
                </div>
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
