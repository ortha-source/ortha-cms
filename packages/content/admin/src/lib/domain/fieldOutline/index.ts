import { orderGeneralTab } from '@orthacms/content-domain';
import type { ContentField, ContentFieldGroup } from '../types/contentType';
import { layoutFields } from '../fieldLayout';
import { sectionFields } from '../fieldSections';

/** One stop in the General tab's outline. */
export type OutlineItem =
    | {
          kind: 'section';
          /** The group's key — what the section's element is marked with. */
          key: string;
          label: string;
      }
    | {
          kind: 'field';
          field: ContentField;
          /** The section the field is drawn in, when it is in one. */
          section?: string;
      };

/** A run of fields flattened in the order `FieldStack` draws them. */
function drawn(fields: ContentField[]): ContentField[] {
    return layoutFields(fields).flatMap((block) =>
        block.kind === 'row' ? block.fields : [block.field]
    );
}

/**
 * The General tab as the outline lists it: every field, and every declared
 * section, **in the order the form draws them**.
 *
 * Built from the very functions `EntryFieldSections` lays the form out with
 * (`orderGeneralTab`, `sectionFields`, `layoutFields`) and branching the same
 * three ways — sections, a translated/shared split, or one flat run — so a bar
 * can never sit above a field that is drawn below its neighbour. A row's
 * fields keep their left-to-right order, which is also their tab order.
 *
 * Section stops are only the schema's own sections: they are collapsible, so
 * jumping to one is a real navigation. The translated/shared split is a pair of
 * labelled runs the reader scrolls through anyway, and listing them would add
 * two stops that lead to no control.
 */
export function outlineGeneralTab(
    fields: ContentField[],
    groups: readonly ContentFieldGroup[] | undefined
): OutlineItem[] {
    const ordered = orderGeneralTab(fields);
    if (ordered.length === 0) return [];

    const asItems = (run: ContentField[], section?: string): OutlineItem[] =>
        drawn(run).map((field) =>
            section
                ? { kind: 'field', field, section }
                : { kind: 'field', field }
        );

    const { ungrouped, sections } = sectionFields(fields, groups);
    if (sections.length > 0) {
        const loose = new Set(ungrouped);
        return [
            ...asItems(ordered.filter((field) => loose.has(field))),
            ...sections.flatMap(({ group, fields: inSection }) => [
                {
                    kind: 'section' as const,
                    key: group.key,
                    label: group.label
                },
                ...asItems(inSection, group.key)
            ])
        ];
    }

    const translated = ordered.filter((field) => field.localized);
    const shared = ordered.filter((field) => !field.localized);
    if (translated.length === 0 || shared.length === 0) {
        return asItems(ordered);
    }
    return [...asItems(translated), ...asItems(shared)];
}
