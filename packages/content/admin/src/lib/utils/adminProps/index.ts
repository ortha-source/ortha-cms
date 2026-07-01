import type { ContentField } from '../../types/contentType';

/**
 * A content field's admin presentation hints, read with the loose wire typing
 * the admin sees (the server serializes them as an open bag). The single place
 * this cast lives, so every consumer — the field input, the relation editor —
 * reads the same shape and they can't drift.
 */
export function adminProps(field: ContentField): {
    description?: string;
    placeholder?: string;
    widget?: string;
    hidden?: boolean;
} {
    return field.admin as {
        description?: string;
        placeholder?: string;
        widget?: string;
        hidden?: boolean;
    };
}
