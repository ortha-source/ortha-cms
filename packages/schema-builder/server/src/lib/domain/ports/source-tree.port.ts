/**
 * The host app's files, addressed relative to its root. The only port that
 * reaches the disk; the read path needs two questions of it.
 */
export interface SourceTree {
    /** Whether a file or folder exists. */
    exists(path: string): Promise<boolean>;
    /** A file's first line, or `null` when the file does not exist. */
    firstLine(path: string): Promise<string | null>;
}
