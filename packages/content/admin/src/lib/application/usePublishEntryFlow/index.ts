import { useCallback, useState } from 'react';
import { canPublish, type EntryFieldSpecMap } from '@ortha-cms/content-domain';
import { useHasPermission } from '@ortha-cms/identity-admin';
import type {
    ContentTypeDetail,
    EntryRecord,
    RelationDelta
} from '../../domain/types/contentType';
import { CONTENT_PUBLISH, ENTRY_STATUS } from '../../domain/constants';
import { toFieldSpec } from '../../infrastructure/entryFieldSpec';
import { useSaveEntry } from '../useSaveEntry';
import { useEntryStatusActions } from '../useEntryStatusActions';

/** One run of the save/publish use case. */
export type SubmitEntryInput = {
    /** The content type's full schema — its fields drive the publish gate. */
    schema: ContentTypeDetail;
    /** Whether the type is publishable (drives the publish/unpublish toggle). */
    publishable: boolean;
    /** The field values to persist. */
    values: Record<string, unknown>;
    /** Publish intent — the primary action asks to publish, the draft action doesn't. */
    publish: boolean;
    /** Staged many/inverse relation deltas to persist with the save. */
    relations?: Record<string, RelationDelta>;
    /** The record being edited, or undefined on a create / empty single page. */
    entry?: EntryRecord;
    /** Slot-contributed create-body params (create only). */
    bodyExtra?: Record<string, string>;
    /**
     * Fields excluded from the publish gate — the hidden/ungranted relations the
     * editor also skipped in its client validation, so the flow's gate judges the
     * same value set the form did. (Link-managed many/inverse relations are skipped
     * by the kernel itself.)
     */
    ignoreFields?: ReadonlySet<string>;
};

/** The classified outcome of one submit, for the caller's toast + navigation. */
export type SubmitEntryResult = {
    /** The saved record returned by the write. */
    saved: EntryRecord;
    /** Whether the save was a create (no prior id — the caller navigates to it). */
    wasCreate: boolean;
    /** Whether the entry was published as part of this submit. */
    published: boolean;
    /** Whether an already-published entry was reverted to draft by this submit. */
    unpublished: boolean;
};

/** What {@link usePublishEntryFlow} exposes to the entry view. */
export type PublishEntryFlow = {
    /**
     * Runs the save use case: persist the values (+ staged relation deltas), then
     * — for a publishable type — either publish (when the intent is publish and the
     * kernel {@link canPublish} gate passes) or revert to draft (when saving a
     * draft over an already-published entry, with permission). Resolves with the
     * classified {@link SubmitEntryResult}; rejects on a server error (e.g. a 422)
     * so the editor can surface field issues.
     */
    submit: (input: SubmitEntryInput) => Promise<SubmitEntryResult>;
    /** Reverts a published entry to draft (the sidebar's Unpublish action). */
    unpublish: (id: string) => Promise<EntryRecord>;
    /** Soft-deletes the entry (the sidebar's Delete action). */
    remove: (id: string) => Promise<void>;
    /** Whether a save / publish / unpublish is in flight (drives the rail's busy state). */
    isSaving: boolean;
    /** Whether an unpublish or delete is in flight (disables the rail). */
    isMutating: boolean;
};

/**
 * The **save/publish use case** for one entry, factored out of the entry view so
 * the view renders the result instead of sequencing mutations itself. Owns the
 * create→update id continuity (a save after a failed publish updates the draft, it
 * doesn't create a second row), applies the shared `@ortha-cms/content-domain`
 * {@link canPublish} kernel gate before publishing (the single validation source,
 * the same rule the editor's publish gate shows), and exposes the entry lifecycle
 * mutations. Cache invalidation lives in the underlying mutations.
 *
 * Takes only the stable `typeName` so it can be called unconditionally (before the
 * schema resolves); the schema and publishable flag are supplied per {@link submit}.
 */
export function usePublishEntryFlow(typeName: string): PublishEntryFlow {
    const save = useSaveEntry(typeName);
    const status = useEntryStatusActions(typeName);
    const hasPublishPermission = useHasPermission(CONTENT_PUBLISH);
    // In create mode, remember the id returned by a successful create so a retry
    // after a failed chained publish updates that draft instead of re-creating.
    const [createdId, setCreatedId] = useState<string | undefined>(undefined);

    const submit = useCallback(
        async (input: SubmitEntryInput): Promise<SubmitEntryResult> => {
            const existingId = input.entry?.id ?? createdId;
            const saved = await save.mutateAsync({
                id: existingId,
                values: input.values,
                relations: input.relations,
                ...(input.bodyExtra && Object.keys(input.bodyExtra).length
                    ? { extra: input.bodyExtra }
                    : {})
            });
            // Record the new id before chaining publish: if publish then fails, the
            // draft persists and the user's retry must target it (not POST again).
            if (!existingId) setCreatedId(saved.id);

            // The publish gate over the same value set the editor validated: build
            // the kernel field-spec map, skipping the caller's ignored fields.
            const fields: EntryFieldSpecMap = {};
            for (const field of input.schema.fields) {
                if (input.ignoreFields?.has(field.name)) continue;
                fields[field.name] = toFieldSpec(field);
            }
            const willPublish =
                input.publish &&
                input.publishable &&
                canPublish(fields, input.values);
            // "Save as draft" on an already-published entry reverts it (unpublish),
            // so the primary and draft actions are a clean toggle — only when the
            // user may publish/unpublish.
            const willUnpublish =
                !input.publish &&
                input.publishable &&
                hasPublishPermission &&
                input.entry?.status === ENTRY_STATUS.Published;

            if (willPublish) {
                await status.publish.mutateAsync(saved.id);
            } else if (willUnpublish) {
                await status.unpublish.mutateAsync(saved.id);
            }

            return {
                saved,
                wasCreate: !existingId,
                published: willPublish,
                unpublished: willUnpublish
            };
        },
        [save, status, hasPublishPermission, createdId]
    );

    const unpublish = useCallback(
        (id: string) => status.unpublish.mutateAsync(id),
        [status]
    );
    const remove = useCallback(
        (id: string) => status.remove.mutateAsync(id),
        [status]
    );

    return {
        submit,
        unpublish,
        remove,
        isSaving:
            save.isPending ||
            status.publish.isPending ||
            status.unpublish.isPending,
        isMutating: status.unpublish.isPending || status.remove.isPending
    };
}
