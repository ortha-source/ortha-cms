import type {
    FieldAdminDoc,
    FieldEntry
} from '@orthacms/schema-builder-domain';
import { patchAdmin, patchSpec } from '../../domain/fieldPatch';
import type { SchemaDraftState } from '../useSchemaDraft';

/** One field of the draft, and the three ways the sheet changes it. */
export type FieldEditor = {
    readonly entry: FieldEntry;
    readonly setName: (name: string) => void;
    readonly setSpec: (patch: Partial<Record<string, unknown>>) => void;
    readonly setAdmin: (patch: Partial<FieldAdminDoc>) => void;
};

/**
 * Edits apply to the draft as they are made — the sheet holds no copy that
 * could drift from what the review will show. `null` once the field is gone.
 */
export function useFieldEditor(
    draft: SchemaDraftState,
    typeName: string,
    key: string | null
): FieldEditor | null {
    const entry = draft.document.types
        .find((type) => type.name === typeName)
        ?.fields.find((field) => field.key === key);
    if (!entry) return null;
    const update = (name: string, spec: FieldEntry['spec']) =>
        draft.dispatch({
            type: 'field.update',
            typeName,
            key: entry.key,
            name,
            spec
        });
    return {
        entry,
        setName: (name) => update(name, entry.spec),
        setSpec: (patch) => update(entry.name, patchSpec(entry.spec, patch)),
        setAdmin: (patch) => update(entry.name, patchAdmin(entry.spec, patch))
    };
}
