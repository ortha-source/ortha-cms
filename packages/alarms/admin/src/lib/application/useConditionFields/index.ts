import type { FilterField } from '@orthacms/query-builder-admin';
import {
    RECORDS_FILTER_FIELDS_SLOT,
    useContentSchema,
    useFilterFields,
    type ContentTypeDetail
} from '@orthacms/content-admin';

/**
 * Stands in for a content type that has not loaded yet.
 *
 * A module constant rather than an inline literal: it is passed to slot hooks
 * on every render, and a fresh object each time would defeat any memoisation a
 * contributor does on its identity.
 */
const NO_SCHEMA: ContentTypeDetail = {
    name: '',
    kind: 'collection',
    label: '',
    fields: []
};

/** What {@link useConditionFields} hands back. */
export type ConditionFields = {
    /** The full filterable surface: server-derived plus slot-contributed. */
    fields: FilterField[];
    /**
     * Still loading — the server half, or (when there is a type) the schema
     * the slot contributors read. A disabled query is `isPending` for ever,
     * so the schema half is gated on there being a type at all.
     */
    isPending: boolean;
    /** The server half failed. */
    isError: boolean;
    /** Retry the server half. */
    refetch: () => void;
};

/**
 * The fields an alarm's condition can name — **the records list's full
 * filterable surface, not just the server half.**
 *
 * A rule is created from a list filter, and that list offers slot-contributed
 * fields alongside the server-derived ones — i18n's `localeCount` /
 * `hasLocale` / `missingLocale`, answered by the same plugin's virtual-field
 * subqueries at evaluation time. Reading only `useFilterFields` meant a rule
 * saved over one of those came back as "This field is no longer available",
 * and the Apply gate then refused every edit to it.
 *
 * Shared by the editor and the alarm cards, so a chip on the list and the
 * same chip in the editor resolve their labels from one surface. Both queries
 * are cached per type, so a list of five alarms over two collections costs two
 * requests of each kind, not five.
 *
 * Hook-in-a-loop is rules-of-hooks-safe: slot items are registered once at boot
 * and never change, so the call order is stable across renders. `useFields` is
 * called unconditionally with a placeholder until the real schema lands —
 * guarding it on `schema.data` changes the hook count between renders and
 * takes the page down with the error boundary.
 */
export function useConditionFields(contentType: string): ConditionFields {
    const filterFields = useFilterFields(contentType || undefined);
    const schema = useContentSchema(contentType, Boolean(contentType));
    const slotFields = RECORDS_FILTER_FIELDS_SLOT.getItems().flatMap((item) =>
        item.useFields(schema.data ?? NO_SCHEMA)
    );
    return {
        // Not memoised, matching the records list's own call site: the slot's
        // hooks return a fresh array each render anyway.
        fields: [...filterFields.fields, ...slotFields],
        isPending:
            filterFields.isPending ||
            (Boolean(contentType) && schema.isPending),
        isError: filterFields.isError,
        refetch: filterFields.refetch
    };
}
