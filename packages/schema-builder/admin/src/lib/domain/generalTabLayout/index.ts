import { orderGeneralTab } from '@orthacms/content-domain';
import type {
    FieldEntry,
    GroupDoc,
    TypeDoc
} from '@orthacms/schema-builder-domain';
import { fieldsOnTab } from '../builtInTab';

/** One accordion block on the General tab and the fields drawn inside it. */
export type GeneralTabGroup = { group: GroupDoc; fields: FieldEntry[] };

/** The General tab as the entry editor draws it. */
export type GeneralTabLayout = {
    /** Fields above the groups, ordered by control shape (content-domain's table). */
    loose: FieldEntry[];
    /** The type's groups in order, each with its fields in declaration order. */
    groups: GeneralTabGroup[];
};

/**
 * The same arrangement `EntryFieldSections` renders: ungrouped fields first,
 * by rank — inputs, choices, long text — then each group with the author's
 * order kept. A field naming a group the type does not declare is drawn loose,
 * as the editor would (the DSL refuses that declaration anyway).
 */
export function generalTabLayout(type: TypeDoc): GeneralTabLayout {
    const general = fieldsOnTab(type, 'general');
    const keys = new Set(type.groups.map((group) => group.key));
    const groupOf = (entry: FieldEntry) => entry.spec.admin?.group;
    const loose = general.filter((entry) => !keys.has(groupOf(entry) ?? ''));
    return {
        loose: orderGeneralTab(
            loose.map((entry) => ({ type: entry.spec.type, entry }))
        ).map(({ entry }) => entry),
        groups: type.groups.map((group) => ({
            group,
            fields: general.filter((entry) => groupOf(entry) === group.key)
        }))
    };
}
