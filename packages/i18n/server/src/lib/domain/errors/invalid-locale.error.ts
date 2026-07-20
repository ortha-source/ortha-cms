/**
 * Raised by {@link Locale.create} when a locale's slug is malformed (not the
 * lowercase BCP-47-ish shape) or its display name is blank. Transport-agnostic
 * — the plugin factory surfaces it at construction, so a misconfigured host
 * fails before boot.
 */
export class InvalidLocaleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidLocaleError';
    }
}
