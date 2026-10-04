import type { TypeDoc } from '../document/type-doc';
import type { SchemaChange, TypeFlag } from './schema-change';

const FLAGS: readonly TypeFlag[] = ['publishable', 'paranoid', 'i18n'];

/** The storage envelope: each flag that flipped is one change. */
export function diffTypeFlags(a: TypeDoc, b: TypeDoc): SchemaChange[] {
    return FLAGS.filter((flag) => a[flag] !== b[flag]).map((flag) => ({
        kind: 'type.flag',
        type: a.name,
        flag,
        to: b[flag]
    }));
}
