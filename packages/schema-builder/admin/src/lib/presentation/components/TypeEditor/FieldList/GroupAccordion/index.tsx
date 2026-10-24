import type { ReactNode } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
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
    emptyFlag: {
        id: 'schemaBuilder.group.emptyFlag',
        defaultMessage: 'Empty group'
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
 * A group as a section header inside the field list, its fields under it,
 * indented. Open here whatever `collapsed` says — this page is about what is
 * inside — with the flag said in words instead. Its fields are one list of
 * the General tab's sortable scope, so a field can be dragged in — an empty
 * group included — or out. An empty group is tinted and says why it blocks
 * the review. While editing, `handle` drags the whole section and its menu
 * edits or removes the group.
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
    const empty = list.fields.length === 0;
    return (
        <Collapsible
            defaultOpen
            role="group"
            aria-label={group.label}
            className={cn('border-t bg-card', className)}
        >
            <div
                className={cn(
                    'flex items-center gap-1 pr-2',
                    empty ? 'bg-destructive-soft/40' : 'bg-muted/40'
                )}
            >
                {handle && <span className="flex pl-4">{handle}</span>}
                <CollapsibleTrigger
                    className={cn(
                        'group flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                        handle ? 'pl-2' : 'pl-4'
                    )}
                >
                    <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-90"
                        aria-hidden
                    />
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-semibold">
                            {group.label}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                            {group.key}
                        </span>
                        {empty ? (
                            <span className="text-xs font-medium text-destructive">
                                {intl.formatMessage(messages.emptyFlag)}
                            </span>
                        ) : (
                            <span className="text-xs text-muted-foreground">
                                {[
                                    group.description,
                                    group.collapsed &&
                                        intl.formatMessage(messages.collapsed)
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                        )}
                    </span>
                    {!empty && (
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                            {intl.formatMessage(messages.count, {
                                count: list.fields.length
                            })}
                        </span>
                    )}
                </CollapsibleTrigger>
                {editing && (
                    <GroupMenu
                        label={group.label}
                        onEdit={() => editing.onEditGroup(group.key)}
                        onRemove={() => editing.onRemoveGroup(group.key)}
                    />
                )}
            </div>
            <CollapsibleContent className="border-t pl-6">
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
