/** Formats generated source the way the project formats its own (prettier). */
export interface CodeFormatter {
    /** `source` formatted as the file at `path` (relative to the project root) would be. */
    format(source: string, path: string): Promise<string>;
}
