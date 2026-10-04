/** What an editable field list can do; absent, the list is read-only. */
export type FieldListEditing = {
    readonly onEdit: (key: string) => void;
    readonly onRemove: (key: string) => void;
    /** Moves the field with `key` to where the field with `before` is. */
    readonly onMove: (key: string, before: string) => void;
    readonly onAddField: () => void;
    readonly onManageGroups: () => void;
    /** How many schema-rule issues a field has, by name. */
    readonly issuesOf: (field: string) => number;
};
