import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
    Badge,
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@orthacms/design-system';
import type { GeneralTabGroup } from '../../../../../domain/generalTabLayout';
import type { FieldListEditing } from '../fieldListEditing';
import { FieldRows } from '../FieldRows';

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
    }
});

/**
 * A group as the entry editor draws it: an accordion block inside General.
 * Open here whatever `collapsed` says — this page is about what is inside —
 * with the flag shown as a badge instead.
 */
export function GroupAccordion({
    group,
    fields,
    editing
}: GeneralTabGroup & { editing?: FieldListEditing }) {
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
                        count: fields.length
                    })}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                {fields.length === 0 ? (
                    <p className="border-t px-4 py-3 text-xs text-destructive">
                        {intl.formatMessage(messages.empty)}
                    </p>
                ) : (
                    <div className="border-t">
                        <FieldRows fields={fields} editing={editing} />
                    </div>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
