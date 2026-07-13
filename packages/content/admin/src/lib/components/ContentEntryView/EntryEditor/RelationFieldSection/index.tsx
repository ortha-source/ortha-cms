import { useEffect, useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { AlertCircle, ChevronRight } from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
    Spinner
} from '@ortha-cms/design-system';
import type {
    ContentField,
    RelationRef,
    StagedRelation
} from '../../../../types/contentType';
import { fieldLabel } from '../../../../utils/entryColumns';
import { ChangedBadge } from '../../../ChangedBadge';
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
    },
    loadingCount: {
        id: 'content.relations.section.loadingCount',
        defaultMessage: 'Loading linked count…'
    }
});

/**
 * One relation field as a **collapsible** section in the editor's Relations tab:
 * a trigger row (chevron + label + a "Changed" badge when edited + linked-count)
 * over the field editor. A **many/inverse** relation is edited by the staged
 * {@link RelationFieldLive} (create and edit alike — its links are sent as a
 * delta on Save); a **single** relation uses the form-backed {@link
 * RelationField}. `count` and `changed` are supplied by the parent so the header
 * reflects staged edits without this component owning the data.
 */
export function RelationFieldSection({
    field,
    count,
    changed,
    error,
    typeName,
    entryId,
    value,
    onChange,
    onBlur,
    defaultOpen,
    initialRefs,
    staged,
    onStagedChange
}: {
    field: ContentField;
    /**
     * Linked count shown in the header (server total ± staged, or value length),
     * or `null` while a managed relation's count is still loading — rendered as a
     * neutral affordance so a populated relation never flashes 0.
     */
    count: number | null;
    /** Whether the field has unsaved changes (drives the "Changed" badge). */
    changed: boolean;
    error?: string;
    /** The content type name — for the live relation's paginated read. */
    typeName: string;
    /** The existing entry's id; absent while creating. */
    entryId?: string;
    /** Form value — the single-relation path only. */
    value?: unknown;
    onChange?: (value: unknown) => void;
    onBlur?: () => void;
    /** Whether the section starts expanded. */
    defaultOpen: boolean;
    /** Server-resolved links for titling — the single-relation path only. */
    initialRefs?: readonly RelationRef[];
    /** Staged link/unlink/reorder — the many/inverse path only. */
    staged?: StagedRelation;
    onStagedChange?: (next: StagedRelation) => void;
}) {
    const intl = useIntl();

    // Controlled so an error can force the section open: otherwise a save can
    // fail with the offending relation collapsed and its error hidden inside the
    // (unmounted) content. Expand whenever an error appears.
    const [open, setOpen] = useState(defaultOpen);
    useEffect(() => {
        if (error) setOpen(true);
    }, [error]);

    const live = !!field.relation?.many || !!field.relation?.inverse;

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
                {changed ? <ChangedBadge /> : null}
                {error ? (
                    <AlertCircle
                        className="size-4 shrink-0 text-destructive"
                        aria-label={intl.formatMessage(messages.invalid)}
                    />
                ) : null}
                {count === null ? (
                    <Spinner
                        className="size-3.5 text-muted-foreground"
                        aria-label={intl.formatMessage(messages.loadingCount)}
                    />
                ) : (
                    <span className="tabular-nums text-xs text-muted-foreground">
                        {intl.formatMessage(messages.linked, { count })}
                    </span>
                )}
            </CollapsibleTrigger>
            <CollapsibleContent>
                <div className="border-t px-3 pb-3 pt-3">
                    {live ? (
                        <RelationFieldLive
                            field={field}
                            typeName={typeName}
                            entryId={entryId}
                            error={error}
                            staged={
                                staged ?? {
                                    added: [],
                                    removed: [],
                                    order: null
                                }
                            }
                            onStagedChange={
                                onStagedChange ?? (() => undefined)
                            }
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
