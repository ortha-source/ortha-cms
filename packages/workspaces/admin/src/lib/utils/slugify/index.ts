/**
 * Derives a URL slug from a free-text name: lower-cased, accents stripped,
 * runs of non-alphanumerics collapsed to single hyphens, and trimmed of
 * leading/trailing hyphens. Produces a value matching `^[a-z0-9-]+$` (or an
 * empty string for input with no usable characters).
 */
export function slugify(input: string): string {
    return input
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
