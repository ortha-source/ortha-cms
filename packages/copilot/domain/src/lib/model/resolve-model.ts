import { UnknownModelError } from '../errors/unknown-model.error';

/**
 * Picks the model a request runs on: the one it named, or the provider's
 * **first** declared model as the default.
 *
 * A provider offers several models so an operator can switch between them
 * without a redeploy — a cheap one for routine turns, a frontier one for hard
 * work. Every adapter resolves that the same way, so the rule lives here
 * rather than being reimplemented three times.
 *
 * @throws {UnknownModelError} when the request names a model this provider
 *   does not offer. Falling back to the default instead would answer on a
 *   different model than the caller asked for, and bill it silently.
 */
export function resolveModel(
    requested: string | undefined,
    available: readonly string[]
): string {
    if (available.length === 0) {
        throw new Error(
            'This model provider declares no models. Configure at least one.'
        );
    }
    if (requested === undefined) {
        return available[0];
    }
    if (!available.includes(requested)) {
        throw new UnknownModelError(requested, available);
    }
    return requested;
}
