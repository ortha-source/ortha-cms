/**
 * A run asked a provider for a model it does not offer. Thrown rather than
 * silently falling back to the default: a run that quietly answers on a
 * different model than it was told to would bill the wrong budget and make the
 * transcript a lie about what produced the answer.
 */
export class UnknownModelError extends Error {
    /**
     * @param requested The model id the run asked for.
     * @param available Every model this provider offers, so the message names
     *   the fix instead of only the failure.
     */
    constructor(
        readonly requested: string,
        readonly available: readonly string[]
    ) {
        super(
            `Model "${requested}" is not offered by this copilot provider. Available: ${
                available.length > 0 ? available.join(', ') : '(none)'
            }`
        );
        this.name = 'UnknownModelError';
    }
}
