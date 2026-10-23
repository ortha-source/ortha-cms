/**
 * The short, upper-cased extension of a file name (`report-q3.pdf` → `PDF`),
 * or `null` when there is none worth showing — no dot, a leading-dot name
 * like `.env`, or a "extension" too long to be one. Labels the tiles and rows
 * of files that have no picture to show, where a glyph alone can't tell a
 * PDF from a DOCX.
 */
export function fileExtension(name: string): string | null {
    const dot = name.lastIndexOf('.');
    if (dot <= 0 || dot === name.length - 1) return null;
    const ext = name.slice(dot + 1);
    return ext.length > 5 ? null : ext.toUpperCase();
}
