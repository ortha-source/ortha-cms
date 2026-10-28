import { RENAMED } from '@orthacms/utils-server';

import type { EnvValues } from './engine';

/** A value as a `.env` line writes it — quoted when it has to be. */
export function quote(value: string): string {
    if (/^[\w.:/@%+,=~-]*$/.test(value)) {
        return value;
    }
    if (!value.includes("'")) {
        return `'${value}'`;
    }
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
}

/** The `KEY` a line assigns, commented out or not. */
function keyOf(line: string): { key: string; commented: boolean } | undefined {
    const match = /^\s*(#\s*)?([A-Z][A-Z0-9_]*)=/.exec(line);
    return match
        ? { key: match[2] as string, commented: Boolean(match[1]) }
        : undefined;
}

/**
 * The `.env` text with `changes` applied, everything else left as it was.
 *
 * A key already assigned is rewritten in place; one present only as a
 * commented-out example (`# PUBLIC_URL=https://…`, as the generated file
 * lists them) is uncommented there, so it stays under its section and
 * comment; anything else is appended. A removed key's line goes, and writing a
 * renamed variable removes the old name's line, so the file never holds both.
 */
export function applyToEnvFile(text: string, changes: EnvValues): string {
    const lines = text === '' ? [] : text.replace(/\n$/, '').split('\n');
    const pending = new Map(Object.entries(changes));
    for (const [current, previous] of Object.entries(RENAMED)) {
        if (changes[current] !== undefined) {
            for (const name of previous) {
                if (!pending.has(name)) pending.set(name, undefined);
            }
        }
    }
    const done = new Set<string>();
    const out: string[] = [];
    for (const line of lines) {
        const assigned = keyOf(line);
        if (!assigned || !pending.has(assigned.key) || done.has(assigned.key)) {
            out.push(line);
            continue;
        }
        const value = pending.get(assigned.key);
        if (value === undefined) {
            // Removed: an active line goes; a commented example stays.
            if (assigned.commented) out.push(line);
            else done.add(assigned.key);
            continue;
        }
        out.push(`${assigned.key}=${quote(value)}`);
        done.add(assigned.key);
    }
    for (const [key, value] of pending) {
        if (value !== undefined && !done.has(key)) {
            out.push(`${key}=${quote(value)}`);
        }
    }
    return `${out.join('\n')}\n`;
}

/** The changes between two environments: new and changed values, and removals. */
export function diffValues(before: EnvValues, after: EnvValues): EnvValues {
    const changes: EnvValues = {};
    for (const key of new Set([
        ...Object.keys(before),
        ...Object.keys(after)
    ])) {
        if ((before[key] || undefined) !== (after[key] || undefined)) {
            changes[key] = after[key] || undefined;
        }
    }
    return changes;
}
