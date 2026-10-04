/**
 * The host app's files, addressed relative to its root. The only port that
 * reaches the disk. Reads answer `null`/`false` for what is not there; writes
 * create the folders they need.
 */
export interface SourceTree {
    /** Whether a file or folder exists. */
    exists(path: string): Promise<boolean>;
    /** A file's first line, or `null` when the file does not exist. */
    firstLine(path: string): Promise<string | null>;
    /** A whole file, or `null` when it does not exist. */
    read(path: string): Promise<string | null>;
    /** The names of the files directly in a folder; empty when it does not exist. */
    list(dir: string): Promise<string[]>;
    /** Writes a file, creating its folder. */
    write(path: string, text: string): Promise<void>;
    /** Copies a folder recursively; copying a missing folder creates an empty one. */
    copyDir(from: string, to: string): Promise<void>;
    /** Removes a file or a folder recursively; removing nothing is fine. */
    remove(path: string): Promise<void>;
}
