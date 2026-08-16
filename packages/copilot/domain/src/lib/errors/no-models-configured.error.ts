/**
 * A provider was asked to resolve a model but declares none.
 *
 * Typed rather than a bare `Error` for the same reason
 * {@link UnknownModelError} is: the SSE controller classifies what it catches
 * to decide whether a failure is the operator's misconfiguration or a genuine
 * fault, and a plain `Error` is indistinguishable from a crash. The host
 * normally catches this at boot — `CopilotPlugin` refuses to start a provider
 * with an empty `models` list — so reaching it at run time means a provider was
 * constructed outside that path.
 */
export class NoModelsConfiguredError extends Error {
    constructor() {
        super(
            'This model provider declares no models. Configure at least one.'
        );
        this.name = 'NoModelsConfiguredError';
    }
}
