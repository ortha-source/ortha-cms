import { useId } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Spinner } from '@orthacms/design-system';
import type {
    ContentField,
    RelationRef,
    StagedRelation
} from '../../../../../domain/types/contentType';
import { useContentSchema } from '../../../../../application/useContentSchema';
import { RelationSyncMark } from './RelationSyncMark';
import { fieldLabel } from '../../../../../domain/entryColumns';
import { adminProps } from '../../../../../domain/adminProps';
import { ChangedBadge } from '../../../ChangedBadge';
import { RequiredMark } from '../../../EntryFieldInput/RequiredMark';
import { SharedFieldMark } from '../../../EntryFieldInput/SharedFieldMark';
import { RelationField } from '../RelationField';
import { RelationFieldLive } from '../RelationFieldLive';

const messages = defineMessages({
    linked: {
        id: 'content.relations.section.linked',
        defaultMessage:
            '{count, plural, =0 {None} one {# linked} other {# linked}}'
    },
    loadingCount: {
        id: 'content.relations.section.loadingCount',
        defaultMessage: 'Loading linked count…'
    },
    descSingle: {
        id: 'content.relations.section.descSingle',
        defaultMessage: 'Single relation — one record from {target}.'
    },
    descMany: {
        id: 'content.relations.section.descMany',
        defaultMessage:
            'Ordered relation — drag to reorder, or use the arrows. Order is delivered as-is.'
    },
    descInverse: {
        id: 'content.relations.section.descInverse',
        defaultMessage: 'Linked from {target}.'
    }
});

/**
 * One relation field **in the entry form**, drawn with the same anatomy as
 * every other field: a label row (label, required mark, how the link carries
 * across locales, "Changed", and — for a many relation — "{n} linked"), the
 * editor, then a short description. It used to be a titled card on a
 * Relations tab of its own; a relation is just a field with its own control,
 * so it sits in the schema's order beside the rest.
 *
 * A **many/inverse** relation is edited by the staged {@link RelationFieldLive}
 * (its links are sent as a delta on Save); a **single** relation uses the
 * form-backed {@link RelationField}. `count` and `changed` are supplied by the
 * parent so the label row reflects staged edits without this component owning
 * the data.
 *
 * The control is a **composite** (pick, reorder, remove), so the field is a
 * `group` named by its label rather than a `<label for>` pointing at one
 * button — a label would replace that button's own name.
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
    initialRefs,
    staged,
    onStagedChange,
    shared = false
}: {
    field: ContentField;
    /**
     * Linked count shown in the header of a many/inverse relation (server total ±
     * staged), or `null` while the count is still loading — rendered as a neutral
     * affordance so a populated relation never flashes 0. Ignored for single
     * relations (whose assigned/empty state is self-evident on the row).
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
    /** Server-resolved links for titling — the single-relation path only. */
    initialRefs?: readonly RelationRef[];
    /** Staged link/unlink/reorder — the many/inverse path only. */
    staged?: StagedRelation;
    onStagedChange?: (next: StagedRelation) => void;
    /**
     * On a localized type, a relation whose links the server carries across the
     * record's locales — so the field says "All locales" like a shared value.
     */
    shared?: boolean;
}) {
    const intl = useIntl();
    const labelId = useId();

    const many = !!field.relation?.many;
    const inverse = !!field.relation?.inverse;
    const live = many || inverse;

    // The target type's label titles the description ("one record from Authors").
    const targetName = field.relation?.to ?? '';
    const { data: targetSchema } = useContentSchema(targetName, !!targetName);
    const targetLabel = targetSchema?.label ?? targetName;

    const description = inverse
        ? intl.formatMessage(messages.descInverse, { target: targetLabel })
        : many
          ? intl.formatMessage(messages.descMany)
          : intl.formatMessage(messages.descSingle, { target: targetLabel });

    // The schema's own description wins; the derived one says what kind of
    // relation this is when the author wrote none.
    const authored = adminProps(field).description;

    return (
        <div
            role="group"
            aria-labelledby={labelId}
            data-invalid={!!error || undefined}
            data-testid={`relation-field-${field.name}`}
            className="flex flex-col gap-2"
        >
            <div className="flex min-h-5 items-center gap-2">
                <span id={labelId} className="text-sm font-medium">
                    {fieldLabel(field)}
                    {field.required ? <RequiredMark /> : null}
                </span>
                {live ? (
                    count === null ? (
                        <Spinner
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-label={intl.formatMessage(
                                messages.loadingCount
                            )}
                        />
                    ) : (
                        <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                            {intl.formatMessage(messages.linked, { count })}
                        </span>
                    )
                ) : null}
                <span className="ml-auto flex shrink-0 items-center gap-1.5">
                    {changed ? <ChangedBadge /> : null}
                    {/* Read off THIS field's own schema, not the target's i18n
                        flag: what matters is whether a save here reaches the
                        other locales, and only the server's derived mode
                        answers that. */}
                    <RelationSyncMark mode={field.relation?.localeSync} />
                    {shared ? <SharedFieldMark /> : null}
                </span>
            </div>
            <div>
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
                        onStagedChange={onStagedChange ?? (() => undefined)}
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
            {error ? null : (
                <p className="text-xs text-muted-foreground">
                    {typeof authored === 'string' && authored
                        ? authored
                        : description}
                </p>
            )}
        </div>
    );
}
