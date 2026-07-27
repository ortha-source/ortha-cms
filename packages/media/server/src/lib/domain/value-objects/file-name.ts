import { InvalidFileNameError } from '../errors/invalid-file-name.error';

/** Upper bound on a stored file name's length. */
const MAX_LENGTH = 255;

/**
 * A non-empty, length-bounded file name (extension included). A value object:
 * it is always a leaf name, never a path — path separators are rejected so a
 * name can't smuggle traversal into a storage key.
 */
export class FileName {
    private constructor(private readonly name: string) {}

    /** Builds a {@link FileName}, rejecting empty, over-long, or path-y input. */
    static create(raw: string): FileName {
        const trimmed = raw.trim();
        if (
            trimmed.length === 0 ||
            trimmed.length > MAX_LENGTH ||
            trimmed.includes('/') ||
            trimmed.includes('\\')
        ) {
            throw new InvalidFileNameError(raw);
        }
        return new FileName(trimmed);
    }

    /** The underlying name string. */
    get value(): string {
        return this.name;
    }

    /** Structural equality on the underlying value. */
    equals(other: FileName): boolean {
        return this.name === other.name;
    }
}
