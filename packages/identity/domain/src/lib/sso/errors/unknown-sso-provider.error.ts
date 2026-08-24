/**
 * A request named an SSO provider this deployment has not registered.
 *
 * Names the registered set in the message, like the copilot's
 * `UnknownModelProviderError`: this is an operator-facing misconfiguration — a
 * typo in `plugins.ts`, or a stale bookmark — and the fastest fix is seeing
 * what *is* registered. The transport still renders it as a bare 404 to an
 * anonymous caller.
 */
export class UnknownSsoProviderError extends Error {
    constructor(
        readonly providerName: string,
        readonly registered: readonly string[]
    ) {
        super(
            `Unknown SSO provider "${providerName}". Registered: ${
                registered.length > 0 ? registered.join(', ') : '(none)'
            }.`
        );
        this.name = 'UnknownSsoProviderError';
    }
}
