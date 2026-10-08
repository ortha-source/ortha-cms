/** What an editable field list can do; absent, the list is read-only. */
export type FieldListEditing = {
    readonly onEdit: (key: string) => void;
    readonly onRemove: (key: string) => void;
    /** Moves the field with `key` to where the field with `before` is. */
    readonly onMove: (key: string, before: string) => void;
    /**
     * Puts the field with `key` in a group on General — `null` takes it out to
     * the loose fields — before the field with `before`, or last.
     */
    readonly onRegroup: (
        key: string,
        group: string | null,
        before: string | null
    ) => void;
    readonly onAddField: () => void;
    readonly onManageGroups: () => void;
    /** How many schema-rule issues a field has, by name. */
    readonly issuesOf: (field: string) => number;
};
