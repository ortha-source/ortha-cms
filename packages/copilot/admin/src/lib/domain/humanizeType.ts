/**
 * A content type's machine name as a person reads it — `blog-posts` becomes
 * "Blog posts". The route carries only the name, and this package imports no
 * content plugin to look the label up; for the names types are actually given,
 * this reads as the label.
 */
export function humanizeType(name: string): string {
    const words = name.replace(/[-_]+/g, ' ').trim();
    return words ? words[0].toUpperCase() + words.slice(1) : name;
}
