/**
 * Raised by {@link LocalePolicy.resolve} when a request names a locale slug
 * that isn't configured. Transport-agnostic — {@link LocaleRegistryService}
 * maps it to HTTP 400 (the uniform unknown-locale gate every request path
 * funnels through).
 */
export class UnknownLocaleError extends Error {
    constructor(public readonly slug: string) {
        super(`Unknown locale "${slug}".`);
        this.name = 'UnknownLocaleError';
    }
}
