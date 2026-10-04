import type { SourceTree } from '../lib/domain/ports/source-tree.port';

/** A {@link SourceTree} over a path → contents map, for specs. */
export class MemorySourceTree implements SourceTree {
    constructor(private readonly files: Record<string, string> = {}) {}

    async exists(path: string): Promise<boolean> {
        return (
            path in this.files ||
            Object.keys(this.files).some((file) => file.startsWith(`${path}/`))
        );
    }

    async firstLine(path: string): Promise<string | null> {
        const text = this.files[path];
        return text === undefined ? null : text.split(/\r?\n/, 1)[0];
    }
}
