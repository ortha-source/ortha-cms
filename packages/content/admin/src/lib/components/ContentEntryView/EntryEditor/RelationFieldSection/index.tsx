import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertCircle, ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@ortha-cms/design-system';
import type { ContentField } from '../../../../types/contentType';
import { fieldLabel } from '../../../../utils/entryColumns';
import { toRelationIds } from '../../../../utils/relationIds';
import { RelationField } from '../RelationField';

const messages = defineMessages({
    linked: {
        id: 'content.relations.section.linked',
        defaultMessage:
            '{count, plural, =0 {None} one {# linked} other {# linked}}'
    },
    invalid: {
        id: 'content.relations.section.invalid',
        defaultMessage: 'This relation has an error'
    }
});

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
    const count = toRelationIds(value, many).length;

    // Controlled so an error can force the section open: otherwise a save can
    // fail with the offending relation collapsed and its error hidden inside the
    // (unmounted) content. Expand whenever an error appears.
    const [open, setOpen] = useState(defaultOpen);
    useEffect(() => {
        if (error) setOpen(true);
    }, [error]);

    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className={`group/rel rounded-lg border bg-card ${
                error ? 'border-destructive/50' : ''
            }`}
        >
            <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/rel:rotate-90" />
                <span className="flex-1 text-sm font-medium">
                    {fieldLabel(field)}
                </span>
                {error ? (
                    <AlertCircle
                        className="size-4 shrink-0 text-destructive"
                        aria-label={intl.formatMessage(messages.invalid)}
                    />
                ) : null}
                <span className="tabular-nums text-xs text-muted-foreground">
                    {intl.formatMessage(messages.linked, { count })}
                </span>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="border-t px-3 pb-3 pt-3">
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
