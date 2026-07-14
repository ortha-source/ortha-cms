import { useState } from 'react';
import { defineMessages, useIntl } from 'react-intl';
import { Plus } from 'lucide-react';
import {
    Avatar,
    AvatarFallback,
    Button,
    Field,
    FieldDescription,
    FieldError,
    FieldLabel
} from '@ortha-cms/design-system';
import { initialsOf } from '@ortha-cms/utils-admin';
import { useCurrentWorkspace } from '@ortha-cms/workspaces-admin';
import type { ContentField, RelationRef } from '../../../../types/contentType';
import { useContentSchema } from '../../../../api/useContentSchema';
import type { RelationCandidate } from '../../../../api/useRelationCandidates';
import { fieldLabel } from '../../../../utils/entryColumns';
import { adminProps } from '../../../../utils/adminProps';
import { toRelationIds } from '../../../../utils/relationIds';
import { contentEntryPath } from '../../../../utils/contentEntryPath';
import { handleFor, slugFromValues } from '../../../../utils/relationHandle';
import { RelationItemRow } from './RelationItemRow';
import { RelationPickerDialog } from './RelationPickerDialog';

const messages = defineMessages({
    assign: {
        id: 'content.relations.field.assign',
        defaultMessage: 'Select {label}'
    },
    empty: {
        id: 'content.relations.field.empty',
        defaultMessage: 'Nothing linked yet.'
    },
    remove: {
        id: 'content.relations.field.remove',
        defaultMessage: 'Remove {title}'
    },
    open: {
        id: 'content.relations.field.open',
        defaultMessage: 'Open {title} in a new tab'
    }
});

/**
 * The editor for one **single** relation field (the form-backed path — a single
 * relation stores one id string in the entry values). Shows the assigned record
 * as an avatar + title + `/handle` + status row with a **Replace** action and a
 * remove control; empty, it shows "Nothing linked yet." and a Select trigger.
 * The {@link RelationPickerDialog} handles search, query-builder filtering, and
 * the single-pick. Fully controlled: the parent owns the id value.
 */
export function RelationField({
    field,
    value,
    error,
    onChange,
    onBlur,
    hideLabel = false,
    initialRefs = []
}: {
    field: ContentField;
    value: unknown;
    error?: string;
    onChange: (value: unknown) => void;
    onBlur?: () => void;
    /** Suppress the built-in label (e.g. when a collapsible header carries it). */
    hideLabel?: boolean;
    /** Server-resolved links assigned when the entry loaded, for titling. */
    initialRefs?: readonly RelationRef[];
}) {
    const intl = useIntl();
    const workspace = useCurrentWorkspace();
    const [open, setOpen] = useState(false);
    // Records picked this session — the id in `value` is all the form keeps, so
    // we remember each chosen candidate to render its row (title/slug/status).
    const [picked, setPicked] = useState<Map<string, RelationCandidate>>(
        new Map()
    );

    const targetName = field.relation?.to ?? '';
    const label = fieldLabel(field);
    const description = adminProps(field).description;

    // The target type's label + fields title the picker and derive slugs.
    const { data: targetSchema } = useContentSchema(targetName, !!targetName);
    const targetLabel = targetSchema?.label ?? targetName;
    const targetFields = targetSchema?.fields ?? [];

    // The single assigned id, if any.
    const ids = toRelationIds(value, false);
    const id = ids[0];

    // Display detail for a linked id: the freshly-picked candidate wins (its slug
    // derived from the target schema), else the server-resolved ref from load,
    // else the raw id as a last resort.
    const refsById = new Map(initialRefs.map((ref) => [ref.id, ref]));
    const detailFor = (linkedId: string): RelationRef => {
        const candidate = picked.get(linkedId);
        if (candidate) {
            const slug = slugFromValues(candidate.values, targetFields);
            return {
                id: linkedId,
                title: candidate.title,
                ...(slug ? { slug } : {}),
                ...(candidate.status ? { status: candidate.status } : {})
            };
        }
        return refsById.get(linkedId) ?? { id: linkedId, title: linkedId };
    };

    const commit = (next: string | undefined) => {
        onChange(next ?? '');
        onBlur?.();
    };

    // Commit the picker's chosen id, remembering its candidate for display.
    const confirm = (next: string[], chosen: RelationCandidate[]) => {
        if (chosen.length) {
            setPicked((current) => {
                const merged = new Map(current);
                for (const candidate of chosen)
                    merged.set(candidate.id, candidate);
                return merged;
            });
        }
        commit(next[0]);
    };

    const removeLabelFor = (title: string) =>
        intl.formatMessage(messages.remove, { title });
    const openLabelFor = (title: string) =>
        intl.formatMessage(messages.open, { title });
    const hrefFor = (linkedId: string) =>
        targetName
            ? contentEntryPath(workspace.id, targetName, linkedId)
            : undefined;

    const detail = id ? detailFor(id) : null;

    return (
        <Field data-invalid={!!error}>
            {hideLabel ? null : <FieldLabel>{label}</FieldLabel>}

            {detail ? (
                <RelationItemRow
                    title={detail.title}
                    handle={handleFor(detail.title, detail.slug)}
                    status={detail.status}
                    leading={
                        <Avatar className="size-8 shrink-0">
                            <AvatarFallback className="text-xs">
                                {initialsOf(detail.title)}
                            </AvatarFallback>
                        </Avatar>
                    }
                    onRemove={() => commit(undefined)}
                    removeLabel={removeLabelFor(detail.title)}
                    href={hrefFor(detail.id)}
                    openLabel={openLabelFor(detail.title)}
                    onReplace={() => setOpen(true)}
                />
            ) : (
                <>
                    <p className="text-sm text-muted-foreground">
                        {intl.formatMessage(messages.empty)}
                    </p>
                    <div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shadow-none"
                            onClick={() => setOpen(true)}
                        >
                            <Plus className="size-4" />
                            {intl.formatMessage(messages.assign, {
                                label: targetLabel
                            })}
                        </Button>
                    </div>
                </>
            )}

            {description && !error ? (
                <FieldDescription>{description}</FieldDescription>
            ) : null}
            {error ? <FieldError>{error}</FieldError> : null}

            <RelationPickerDialog
                open={open}
                onOpenChange={setOpen}
                targetName={targetName}
                targetLabel={targetLabel}
                many={false}
                selectedIds={ids}
                onConfirm={confirm}
            />
        </Field>
    );
}
