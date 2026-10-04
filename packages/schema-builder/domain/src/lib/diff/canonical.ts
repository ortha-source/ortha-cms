/** JSON with sorted keys and no `undefined` — the basis of equality and hashing. */
export function canonical(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
        Object.keys(record)
            .filter((key) => record[key] !== undefined)
            .sort()
            .map((key) => [key, canonical(record[key])])
    );
}

/** The canonical JSON text of a value. */
export const canonicalJson = (value: unknown): string =>
    JSON.stringify(canonical(value));
