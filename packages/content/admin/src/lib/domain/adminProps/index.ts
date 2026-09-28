import type { ContentField } from '../types/contentType';

/**
 * A content field's admin presentation hints, read with the loose wire typing
 * the admin sees (the server serializes them as an open bag). The single place
 * this cast lives, so every consumer — the field input, the relation editor —
 * reads the same shape and they can't drift.
 */
export function adminProps(field: ContentField): AdminHints {
    return field.admin as AdminHints;
}

/** The admin hints the stock editor reads. */
type AdminHints = {
    description?: string;
    placeholder?: string;
    widget?: string;
    hidden?: boolean;
    /**
     * Groups the field onto one line of the form with every other field
     * carrying the same key. Read loosely — it arrives from the open bag.
     */
    row?: unknown;
    /** The form section (a key of the type's `groups`) the field is drawn in. */
    group?: unknown;
};
