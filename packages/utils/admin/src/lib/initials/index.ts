/** Up-to-two uppercase initials from the leading character of each part. */
function initialsFromParts(parts: string[]): string {
    return parts
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

/**
 * Derives up-to-two-letter uppercase initials from a name. Tolerant of extra,
 * leading, or trailing whitespace (splits on runs of whitespace and drops the
 * empty parts), so `"  Ada   Lovelace "` still yields `"AL"`.
 */
export function initialsOf(name: string): string {
    return initialsFromParts(name.split(/\s+/));
}

/**
 * Derives up-to-two-letter uppercase initials from an email's local part (the
 * text before `@`), splitting on `.`, `-`, `_`, and `+` — so
 * `"ada.lovelace@example.com"` yields `"AL"`. Falls back to the whole string
 * when there is no `@`.
 */
export function initialsFromEmail(email: string): string {
    const local = email.split('@')[0] ?? email;
    return initialsFromParts(local.split(/[.\-_+]+/));
}
