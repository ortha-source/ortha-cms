/**
 * Asking the registry what it already has, before asking it to take anything.
 *
 * A `PUT` is the rate-limited operation; a `GET` is not. Knowing the answer
 * first is what lets a resumed release skip the 24 packages that already went
 * out instead of re-uploading them to earn 24 `EPUBLISHCONFLICT`s — and it is
 * what tells a publish whether it is bumping a version or **creating a name**,
 * which npm limits far more tightly (see `publish.ts`).
 */

export type RegistryState =
    /** This exact version is already on the registry — nothing to do. */
    | 'version-published'
    /** The name exists; this would add a version to it. */
    | 'name-exists'
    /** The name has never been published — this publish would create it. */
    | 'name-absent'
    /** The registry did not say; publish and let the `PUT` decide. */
    | 'unknown';

export interface ProbeRequest {
    name: string;
    version: string;
    /** Defaults to the public npm registry. */
    registry?: string;
    /** Sent as a bearer token, so a restricted package reads as existing. */
    token?: string;
}

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';

/**
 * One packument `GET`. Every failure mode collapses to `'unknown'`, which the
 * caller treats as "go ahead and try" — a probe that cannot answer must never
 * be the reason a package fails to publish.
 */
export async function probeRegistry(
    request: ProbeRequest
): Promise<RegistryState> {
    const base = request.registry ?? DEFAULT_REGISTRY;
    // A scoped name's slash has to be escaped; `encodeURIComponent` would also
    // escape it, but npm's own clients use the `%2f` form against `/@scope%2fname`.
    const url = new URL(
        request.name.replace('/', '%2f'),
        base.endsWith('/') ? base : `${base}/`
    );

    try {
        const response = await fetch(url, {
            headers: {
                accept: 'application/vnd.npm.install-v1+json, application/json',
                ...(request.token
                    ? { authorization: `Bearer ${request.token}` }
                    : {})
            }
        });

        if (response.status === 404) return 'name-absent';
        if (!response.ok) return 'unknown';

        const packument = (await response.json()) as {
            versions?: Record<string, unknown>;
        };

        return packument.versions?.[request.version]
            ? 'version-published'
            : 'name-exists';
    } catch {
        // Offline, DNS, a proxy in the way — none of that is our answer to give.
        return 'unknown';
    }
}

/**
 * The auth token npm itself would use, pulled from the environment the release
 * script already set up. It is only needed so a **restricted** package reads as
 * `'name-exists'` rather than `'name-absent'`; an anonymous probe is otherwise
 * just as good.
 */
export function registryTokenFromEnv(
    env: NodeJS.ProcessEnv,
    registry = DEFAULT_REGISTRY
): string | undefined {
    const key = `npm_config_${registry.replace(/^https?:/, '').replace(/\/?$/, '/')}:_authToken`;

    return env[key] ?? env.NPM_TOKEN ?? env.NODE_AUTH_TOKEN;
}
