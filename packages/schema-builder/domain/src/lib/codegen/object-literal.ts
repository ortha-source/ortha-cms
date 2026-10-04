import { emitValue } from './emit-value';
import { propertyKey } from './property-key';

export interface LiteralOptions {
    /** Keys whose value is already source code: relation thunks, nested blocks. */
    raw?: Readonly<Record<string, string>>;
    /** Keys moved to the front, in this order. */
    first?: readonly string[];
}

/**
 * `{ a: 1, b: 'x' }` from a record: `undefined` dropped, order fixed. One line —
 * prettier lays it out afterwards; this only has to be valid and deterministic.
 */
export function objectLiteral(
    value: Readonly<Record<string, unknown>>,
    { raw = {}, first = [] }: LiteralOptions = {}
): string {
    const keys = Object.keys({ ...value, ...raw }).filter(
        (key) => key in raw || value[key] !== undefined
    );
    const ordered = [
        ...first.filter((key) => keys.includes(key)),
        ...keys.filter((key) => !first.includes(key))
    ];
    if (!ordered.length) return '{}';
    return `{ ${ordered.map((key) => `${propertyKey(key)}: ${key in raw ? raw[key] : emitValue(value[key])}`).join(', ')} }`;
}
