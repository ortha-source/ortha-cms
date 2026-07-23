/**
 * A provider-assigned storage key. Opaque to the domain — the media core never
 * parses it; only the provider that minted it interprets its structure.
 */
export class StorageKey {
    private constructor(private readonly key: string) {}

    /** Wraps a raw provider key. */
    static create(value: string): StorageKey {
        return new StorageKey(value);
    }

    /** The underlying key string. */
    get value(): string {
        return this.key;
    }
}
