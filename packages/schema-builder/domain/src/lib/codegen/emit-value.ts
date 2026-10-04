import { objectLiteral } from './object-literal';

/** One JSON value as TypeScript source. Strings single-quoted, as prettier leaves them. */
export function emitValue(value: unknown): string {
    if (typeof value === 'string')
        return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
    if (typeof value === 'number' || typeof value === 'boolean')
        return String(value);
    if (value === null) return 'null';
    if (Array.isArray(value)) return `[${value.map(emitValue).join(', ')}]`;
    if (typeof value === 'object')
        return objectLiteral(value as Record<string, unknown>);
    throw new Error(`Cannot write a ${typeof value} into a content type file.`);
}
