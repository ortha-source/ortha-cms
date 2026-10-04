import { same } from './same';

/** The top-level keys whose values differ between two objects, sorted. */
export function changedKeys(a: object, b: object): string[] {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].filter((key) => !same(left[key], right[key])).sort();
}
