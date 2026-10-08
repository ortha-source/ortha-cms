import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import type { GroupDoc } from '@orthacms/schema-builder-domain';
import type { FieldListEditing } from '../fieldListEditing';
import { FieldRows } from '../FieldRows';
import type { SortableList } from '../sortableList';

const messages = defineMessages({
    collapsed: {
        id: 'schemaBuilder.group.collapsed',
        defaultMessage: 'starts folded'
    },
    count: {
        id: 'schemaBuilder.group.count',
        defaultMessage: '{count, plural, one {# field} other {# fields}}'
    },
    empty: {
        id: 'schemaBuilder.group.empty',
        defaultMessage: 'No fields — the schema refuses an empty group.'
    },
    emptyDrop: {
        id: 'schemaBuilder.group.emptyDrop',
        defaultMessage:
            'No fields — the schema refuses an empty group. Drag a field here.'
    }
});

/**
 * A group as the entry editor draws it: an accordion block inside General.
 * Open here whatever `collapsed` says — this page is about what is inside —
 * with the flag shown as a badge instead. Its fields are one list of the
 * General tab's sortable scope, so a field can be dragged in — an empty group
 * included — or out.
 */
export function GroupAccordion({
    group,
    list,
    editing
}: {
    group: GroupDoc;
    list: SortableList;
    editing?: FieldListEditing;
}) {
    const intl = useIntl();
    return (
        <Collapsible defaultOpen className="mx-4 my-3 rounded-lg border">
            <CollapsibleTrigger className="group flex w-full items-start gap-2 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronRight
                    className="mt-0.5 size-4 shrink-0 transition-transform group-data-[state=open]:rotate-90"
                    aria-hidden
                />
                <span className="flex min-w-0 flex-col">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {group.label}
                        <span className="font-mono text-xs font-normal text-muted-foreground">
                            {group.key}
                        </span>
                        {group.collapsed && (
                            <Badge variant="outline" className="font-normal">
                                {intl.formatMessage(messages.collapsed)}
                            </Badge>
                        )}
                    </span>
                    {group.description && (
                        <span className="text-xs text-muted-foreground">
                            {group.description}
                        </span>
                    )}
                </span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {intl.formatMessage(messages.count, {
                        count: list.fields.length
                    })}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t">
                <FieldRows
                    list={list}
                    editing={editing}
                    empty={
                        <p className="px-4 py-3 text-xs text-destructive">
                            {intl.formatMessage(
                                editing ? messages.emptyDrop : messages.empty
                            )}
                        </p>
                    }
                />
            </CollapsibleContent>
        </Collapsible>
    );
}
