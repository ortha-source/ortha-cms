import type { TypeDoc } from '../document/type-doc';
import type { SchemaChange, TypeMetaKey } from './schema-change';
import { same } from './same';

const META_KEYS: readonly TypeMetaKey[] = [
    'label',
    'description',
    'path',
    'groups'
];

/** Presentation of the type itself: labels, page path, form groups. */
export function diffTypeMeta(a: TypeDoc, b: TypeDoc): SchemaChange[] {
    const keys = META_KEYS.filter((key) => !same(a[key], b[key]));
    return keys.length ? [{ kind: 'type.meta', type: a.name, keys }] : [];
}
