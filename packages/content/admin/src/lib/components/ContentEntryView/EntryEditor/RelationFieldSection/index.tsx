import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertCircle, ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@ortha-cms/design-system';
import type { ContentField, RelationRef } from '../../../../types/contentType';
import { fieldLabel } from '../../../../utils/entryColumns';
import { RelationField } from '../RelationField';
import { RelationFieldLive } from '../RelationFieldLive';

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
 * a trigger row (chevron + field label + linked-count) over the field editor.
 * Branches on `entryId`: an existing entry's many/inverse relation is edited
 * **live** ({@link RelationFieldLive} — paginated infinite scroll + immediate
 * link/unlink/reorder deltas); a single relation, or any relation while creating
 * a not-yet-saved entry, uses the form-backed {@link RelationField}. The `count`
 * is supplied by the parent (the live total, else the staged value length) so
 * the header stays right without this component owning the data.
 */
export function RelationFieldSection({
    field,
    count,
    error,
    typeName,
    entryId,
    value,
    onChange,
    onBlur,
    defaultOpen,
    initialRefs
}: {
    field: ContentField;
    /** Linked count shown in the header (live total, or staged value length). */
    count: number;
    error?: string;
    /** The content type name — for the live (delta) endpoints. */
    typeName: string;
    /** The existing entry's id; absent while creating (→ staged editor). */
    entryId?: string;
    /** Form value — the staged/single path only. */
    value?: unknown;
    onChange?: (value: unknown) => void;
    onBlur?: () => void;
    /** Whether the section starts expanded. */
    defaultOpen: boolean;
    /** Server-resolved links for titling — the staged/single path only. */
    initialRefs?: readonly RelationRef[];
}) {
    const intl = useIntl();

    // Controlled so an error can force the section open: otherwise a save can
    // fail with the offending relation collapsed and its error hidden inside the
    // (unmounted) content. Expand whenever an error appears.
    const [open, setOpen] = useState(defaultOpen);
    useEffect(() => {
        if (error) setOpen(true);
    }, [error]);

    // A many/inverse relation on an existing entry is edited live; everything
    // else (single relations, or any relation on a new/unsaved entry) is
    // form-backed.
    const live =
        !!entryId &&
        (!!field.relation?.many || !!field.relation?.inverse);

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
                    {live ? (
                        <RelationFieldLive
                            field={field}
                            typeName={typeName}
                            entryId={entryId}
                        />
                    ) : (
                        <RelationField
                            field={field}
                            value={value}
                            error={error}
                            onChange={onChange ?? (() => undefined)}
                            onBlur={onBlur}
                            hideLabel
                            initialRefs={initialRefs}
                        />
                    )}
                </div>
            </CollapsibleContent>
        </Collapsible>
    );
}
