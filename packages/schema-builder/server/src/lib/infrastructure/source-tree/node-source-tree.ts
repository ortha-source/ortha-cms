import { open, stat } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { SourceTree } from '../../domain/ports/source-tree.port';

/** How much of a file `firstLine` reads — a marker line is far shorter. */
const HEAD_BYTES = 512;

/**
 * {@link SourceTree} over the local disk, rooted at the host app. Every path is
 * resolved inside the root; one that escapes it is refused rather than read.
 */
export class NodeSourceTree implements SourceTree {
    constructor(private readonly root: string) {}

    async exists(path: string): Promise<boolean> {
        try {
            await stat(this.resolve(path));
            return true;
        } catch {
            return false;
        }
    }

    async firstLine(path: string): Promise<string | null> {
        try {
            const handle = await open(this.resolve(path), 'r');
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
        } catch {
            return null;
        }
    }

    /** An absolute path inside the root, or an error. */
    private resolve(path: string): string {
        const absolute = resolve(this.root, path);
        const inside = relative(this.root, absolute);
        if (inside.startsWith('..') || isAbsolute(inside)) {
            throw new Error(
                `Refusing to touch ${path}: it is outside ${this.root}.`
            );
        }
        return absolute;
    }
}
