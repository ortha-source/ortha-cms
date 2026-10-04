import type { FieldEntry } from './field-entry';
import type { GroupDoc } from './group-doc';

/**
 * Who owns a type's file. `builder` — generated, editable here. `code` —
 * written by hand, shown read-only. `new` — exists only in this draft.
 */
export type TypeOrigin = 'builder' | 'code' | 'new';

export interface TypeDoc {
    name: string;
    kind: 'collection' | 'single';
    /** Pages only. */
    path?: string;
    label?: string;
    description?: string;
    publishable: boolean;
    paranoid: boolean;
    i18n: boolean;
    /** In display order. */
    groups: GroupDoc[];
    /** In declaration order — the generated file's order too. */
    fields: FieldEntry[];
    origin: TypeOrigin;
}
