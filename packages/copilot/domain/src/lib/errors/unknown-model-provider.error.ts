/**
 * A provider name was requested that no one registered — a misconfigured
 * `defaultProvider`, or a resolver returning a name outside the map.
 * Transport-agnostic by design; the HTTP layer decides how it renders.
 */
export class UnknownModelProviderError extends Error {
    /**
     * @param providerName The unregistered provider name that was asked for.
     * @param registered Every name the registry does hold, so the message
     *   names the fix instead of only the failure.
     */
    constructor(
        readonly providerName: string,
        readonly registered: readonly string[]
    ) {
        super(
            `Unknown copilot model provider "${providerName}". Registered: ${
                registered.length > 0 ? registered.join(', ') : '(none)'
            }`
        );
        this.name = 'UnknownModelProviderError';
    }
}
