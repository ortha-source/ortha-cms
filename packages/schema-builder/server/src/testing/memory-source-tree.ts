import type { SourceTree } from '../lib/domain/ports/source-tree.port';

/** A {@link SourceTree} over a path → contents map, for specs. */
export class MemorySourceTree implements SourceTree {
    readonly files: Record<string, string>;

    constructor(files: Record<string, string> = {}) {
        this.files = { ...files };
    }

    async exists(path: string): Promise<boolean> {
        return path in this.files || this.under(path).length > 0;
    }

    async firstLine(path: string): Promise<string | null> {
        const text = this.files[path];
        return text === undefined ? null : text.split(/\r?\n/, 1)[0];
    }

    async read(path: string): Promise<string | null> {
        return this.files[path] ?? null;
    }

    async list(dir: string): Promise<string[]> {
        return this.under(dir)
            .map((file) => file.slice(dir.length + 1))
            .filter((name) => !name.includes('/'))
            .sort();
    }

    async write(path: string, text: string): Promise<void> {
        this.files[path] = text;
    }

    async copyDir(from: string, to: string): Promise<void> {
        for (const file of this.under(from))
            this.files[`${to}${file.slice(from.length)}`] = this.files[file];
    }

    async remove(path: string): Promise<void> {
        delete this.files[path];
        for (const file of this.under(path)) delete this.files[file];
    }

    private under(dir: string): string[] {
        return Object.keys(this.files).filter((file) =>
            file.startsWith(`${dir}/`)
        );
    }
}
