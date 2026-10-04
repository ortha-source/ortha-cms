/** Words in a label: letters and digits, anything else a separator. */
const words = (label: string): string[] =>
    label
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean);

/** A field name from a label: `Publish date` → `publishDate`. Starts with a letter. */
export function toFieldName(label: string): string {
    const name = words(label)
        .map((word, index) =>
            index === 0
                ? word.toLowerCase()
                : word[0].toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
    return /^[a-z]/.test(name) ? name : name ? `f${name}` : '';
}

/** A type name from a label: `Blog posts` → `blog_posts`. Starts with a letter. */
export function toTypeName(label: string): string {
    const name = words(label)
        .map((word) => word.toLowerCase())
        .join('_');
    return /^[a-z]/.test(name) ? name : name ? `t_${name}` : '';
}

/** `base`, or `base2`, `base3`… — the first not already taken. */
export function uniqueName(base: string, taken: Iterable<string>): string {
    const used = new Set(taken);
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(`${base}${n}`)) n += 1;
    return `${base}${n}`;
}

/** A key for a field that does not exist yet — never mistaken for a loaded one. */
export const newFieldKey = (): string =>
    `new:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
