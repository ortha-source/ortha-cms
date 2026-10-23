import { orderGeneralTab } from '@orthacms/content-domain';
import type { ContentField, ContentFieldGroup } from '../types/contentType';
import { sectionFields } from '../fieldSections';

/**
 * The key of the run of fields above the first declared section — "Basics"
 * in the On this page list. Marked on the form like a section is.
 */
export const BASICS_SECTION = '__basics';

/** "On this page" needs at least this many sections; fewer need no map. */
export const MIN_PAGE_SECTIONS = 3;

/**
 * The narrowest work area "On this page" is drawn beside the form in, in
 * pixels: its 184px list and gutter plus the form's 768px measure. Narrower,
 * it is a "Sections" menu in the title block.
 */
export const PAGE_NAV_MIN_WIDTH = 1024;

/** One row of "On this page": a section and the fields drawn in it. */
export type PageSection = {
    /** The group's key, or {@link BASICS_SECTION}. */
    key: string;
    /** The group's label; absent for Basics, which the UI names. */
    label?: string;
    /** The fields in it, by name — what its changed / issue counts read. */
    fields: string[];
};

/**
 * The Content form's sections in the order it draws them: the ungrouped
 * fields first as **Basics** (when there are any), then each declared section
 * — built from the same `sectionFields` / `orderGeneralTab` the form uses, so
 * the list can never disagree with the page.
 */
export function pageSections(
    fields: ContentField[],
    groups: readonly ContentFieldGroup[] | undefined
): PageSection[] {
    const { ungrouped, sections } = sectionFields(fields, groups);
    const loose = new Set(ungrouped);
    const basics = orderGeneralTab(fields).filter((field) => loose.has(field));
    return [
        ...(basics.length > 0
            ? [
                  {
                      key: BASICS_SECTION,
                      fields: basics.map((field) => field.name)
                  }
              ]
            : []),
        ...sections.map(({ group, fields: inSection }) => ({
            key: group.key,
            label: group.label,
            fields: inSection.map((field) => field.name)
        }))
    ];
}
