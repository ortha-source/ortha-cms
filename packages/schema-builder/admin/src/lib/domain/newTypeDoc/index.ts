import type { TypeDoc } from '@orthacms/schema-builder-domain';
import { newFieldKey } from '../identifiers';

/**
 * A type that does not exist yet: one text field, because the schema refuses
 * a type with none, and the DSL's defaults for the flags.
 */
export function newTypeDoc(
    name: string,
    label: string,
    kind: TypeDoc['kind']
): TypeDoc {
    return {
        name,
        kind,
        ...(kind === 'single' ? { path: `/${name.replace(/_/g, '-')}` } : {}),
        ...(label && label !== name ? { label } : {}),
        publishable: true,
        paranoid: false,
        i18n: false,
        groups: [],
        fields: [
            {
                key: newFieldKey(),
                name: 'title',
                spec: { type: 'text', required: true }
            }
        ],
        origin: 'new'
    };
}
