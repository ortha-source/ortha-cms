import { defineMessages, useIntl } from 'react-intl';
import { ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@ortha-cms/design-system';
import type { ContentField } from '../../../../types/contentType';
import { fieldLabel } from '../../../../utils/entryColumns';
import { RelationField } from '../RelationField';

const messages = defineMessages({
    linked: {
        id: 'content.relations.section.linked',
        defaultMessage:
            '{count, plural, =0 {None} one {# linked} other {# linked}}'
    }
});

/** How many records this relation field currently links. */
function linkedCount(value: unknown, many: boolean): number {
    if (many) return Array.isArray(value) ? value.length : 0;
    return typeof value === 'string' && value ? 1 : 0;
}

/**
 * One relation field as a **collapsible** section in the editor's Relations tab:
 * a trigger row (chevron + field label + linked-count) over the
 * {@link RelationField} editor. Collapsing keeps the tab tidy when a type has
 * many relation fields; the count stays visible while collapsed. Controlled —
 * the form owns the value; this only forwards it.
 */
export function RelationFieldSection({
    field,
    value,
    error,
    onChange,
    onBlur,
    defaultOpen
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
    /** Whether the section starts expanded. */
    defaultOpen: boolean;
}) {
    const intl = useIntl();
    const many = field.relation?.many ?? false;
    const count = linkedCount(value, many);

    return (
        <Collapsible
            defaultOpen={defaultOpen}
            className="group/rel py-4 first:pt-0 last:pb-0"
        >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/rel:rotate-90" />
                <span className="flex-1 text-sm font-medium">
                    {fieldLabel(field)}
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                    {intl.formatMessage(messages.linked, { count })}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="pl-6 pt-3">
                    <RelationField
                        field={field}
                        value={value}
                        error={error}
                        onChange={onChange}
                        onBlur={onBlur}
                        hideLabel
                    />
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
