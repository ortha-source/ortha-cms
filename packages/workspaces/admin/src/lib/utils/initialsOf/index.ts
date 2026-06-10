/**
 * Derives up-to-two-letter uppercase initials from a name. Tolerant of extra,
 * leading, or trailing whitespace (splits on runs of whitespace and drops the
 * empty parts), so `"  Ada   Lovelace "` still yields `"AL"`.
 */
export function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}
