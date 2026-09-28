import type { ContentField, ContentFieldGroup } from '../types/contentType';
import { adminProps } from '../adminProps';

/** One collapsible section of the entry form and the fields drawn in it. */
export type FieldSection = {
    group: ContentFieldGroup;
    /** The section's fields, in schema declaration order. */
    fields: ContentField[];
};

/** The General tab split into the fields above every section and the sections. */
export type SectionedFields = {
    /** Fields naming no group (or a group the schema no longer declares). */
    ungrouped: ContentField[];
    /** Sections in the schema's declaration order, empty ones dropped. */
    sections: FieldSection[];
};

/**
 * Splits the General tab's fields by `admin.group`.
 *
 * Sections keep the fields' **declaration order** rather than the tab's
 * sort-by-control-shape: a section is the schema author's arrangement, and
 * re-sorting inside it would take the order out of their hands.
 *
 * A section left with no fields to draw — its members hidden, or all
 * relations and media living on other tabs — is dropped rather than rendered
 * as an empty fold. A field naming an unknown group falls back to ungrouped:
 * the server rejects that at define time, so this is only ever an admin
 * talking to a newer or older server, and losing the field would be worse.
 */
export function sectionFields(
    fields: ContentField[],
    groups: readonly ContentFieldGroup[] | undefined
): SectionedFields {
    const byKey = new Map<string, ContentField[]>(
        (groups ?? []).map((group) => [group.key, []])
    );
    const ungrouped: ContentField[] = [];

    for (const field of fields) {
        const key = adminProps(field).group;
        const bucket = typeof key === 'string' ? byKey.get(key) : undefined;
        if (bucket) bucket.push(field);
        else ungrouped.push(field);
    }

    return {
        ungrouped,
        sections: (groups ?? [])
            .map((group) => ({ group, fields: byKey.get(group.key) ?? [] }))
            .filter((section) => section.fields.length > 0)
    };
}
