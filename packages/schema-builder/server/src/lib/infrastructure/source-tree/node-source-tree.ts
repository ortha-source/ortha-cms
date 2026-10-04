import {
    cp,
    mkdir,
    open,
    readdir,
    readFile,
    rm,
    stat,
    writeFile
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { SourceTree } from '../../domain/ports/source-tree.port';

/** How much of a file `firstLine` reads — a marker line is far shorter. */
const HEAD_BYTES = 512;

/** `fn`'s result, or `fallback` when the path is not there. */
async function orMissing<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
        throw error;
    }
}

/**
 * {@link SourceTree} over the local disk, rooted at the host app. Every path is
 * resolved inside the root; one that escapes it is refused rather than read.
 */
export class NodeSourceTree implements SourceTree {
    constructor(private readonly root: string) {}

    async exists(path: string): Promise<boolean> {
        const absolute = this.resolveOrNull(path);
        return absolute
            ? orMissing(async () => (await stat(absolute), true), false)
            : false;
    }

    async firstLine(path: string): Promise<string | null> {
        const absolute = this.resolveOrNull(path);
        if (!absolute) return null;
        return orMissing(async () => {
            const handle = await open(absolute, 'r');
            try {
                const buffer = Buffer.alloc(HEAD_BYTES);
                const { bytesRead } = await handle.read(
                    buffer,
                    0,
                    HEAD_BYTES,
                    0
                );
                return buffer
                    .subarray(0, bytesRead)
                    .toString('utf8')
                    .split(/\r?\n/, 1)[0];
            } finally {
                await handle.close();
            }
        }, null);
    }

    async read(path: string): Promise<string | null> {
        const absolute = this.resolveOrNull(path);
        return absolute
            ? orMissing(() => readFile(absolute, 'utf8'), null)
            : null;
    }

    async list(dir: string): Promise<string[]> {
        const absolute = this.resolveOrNull(dir);
        if (!absolute) return [];
        const entries = await orMissing(
            () => readdir(absolute, { withFileTypes: true }),
            []
        );
        return entries
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .sort();
    }

    async write(path: string, text: string): Promise<void> {
        const absolute = this.resolve(path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, text, 'utf8');
    }

    async copyDir(from: string, to: string): Promise<void> {
        const source = this.resolve(from);
        const target = this.resolve(to);
        await mkdir(target, { recursive: true });
        await orMissing(
            () => cp(source, target, { recursive: true }),
            undefined
        );
    }

    async remove(path: string): Promise<void> {
        await rm(this.resolve(path), { recursive: true, force: true });
    }

    /** An absolute path inside the root, or an error. */
    private resolve(path: string): string {
        const absolute = resolve(this.root, path);
        const inside = relative(this.root, absolute);
        if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
            throw new Error(
                `Refusing to touch ${path}: it is not inside ${this.root}.`
            );
        }
        return absolute;
    }

    /** {@link resolve} for reads: an escape reads as absent. */
    private resolveOrNull(path: string): string | null {
        try {
            return this.resolve(path);
        } catch {
            return null;
        }
    }
}
