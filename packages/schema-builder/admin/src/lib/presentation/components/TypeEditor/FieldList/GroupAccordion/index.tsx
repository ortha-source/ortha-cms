import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
    Badge,
    cn,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import type { GroupDoc } from '@orthacms/schema-builder-domain';
import type { FieldListEditing } from '../fieldListEditing';
import { FieldRows } from '../FieldRows';
import type { SortableList } from '../sortableList';
import { GroupMenu } from './GroupMenu';

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
 * included — or out. While editing, `handle` drags the block itself and its
 * menu edits or removes the group.
 */
export function GroupAccordion({
    group,
    list,
    editing,
    handle,
    className
}: {
    group: GroupDoc;
    list: SortableList;
    editing?: FieldListEditing;
    /** The drag handle, when the groups are sortable. */
    handle?: ReactNode;
    className?: string;
}) {
    const intl = useIntl();
    return (
        <Collapsible
            defaultOpen
            role="group"
            aria-label={group.label}
            className={cn('mx-4 my-3 rounded-lg border bg-card', className)}
        >
            <div className="flex items-start">
                {handle && <span className="flex pl-3 pt-3">{handle}</span>}
                <CollapsibleTrigger
                    className={cn(
                        'group flex min-w-0 flex-1 items-start gap-2 rounded-lg px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        handle && 'pl-2'
                    )}
                >
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
                                <Badge
                                    variant="outline"
                                    className="font-normal"
                                >
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
                {editing && (
                    <span className="flex pr-2 pt-2">
                        <GroupMenu
                            label={group.label}
                            onEdit={() => editing.onEditGroup(group.key)}
                            onRemove={() => editing.onRemoveGroup(group.key)}
                        />
                    </span>
                )}
            </div>
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
