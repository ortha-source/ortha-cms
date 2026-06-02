/**
 * Typed application configuration for the Ortha CMS server.
 *
 * This is the single place that reads `process.env`. Everything
 * downstream (`createServer`, plugins) receives typed config — nothing
 * else should reach for environment variables directly. Deploy-specific
 * values come from the environment; stable tuning lives here as literals.
 */

/** Root server configuration. */
export interface OrthaConfig {
    /** Port the API listens on. Sourced from `PORT`, defaults to 3000. */
    port: number;
    /** Global API route prefix. */
    globalPrefix: string;
    /**
     * Per-plugin runtime config, keyed by plugin name. Empty until a
     * plugin needs options (e.g. `identity: { jwtSecret }`).
     */
    plugins: Record<string, unknown>;
}

const config: OrthaConfig = {
    port: Number(process.env['PORT']) || 3000,
    globalPrefix: 'api',
    plugins: {}
};

export default config;
