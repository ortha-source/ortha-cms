/**
 * An OpenAPI security scheme a plugin's guards accept. Structurally the
 * OpenAPI 3 `SecuritySchemeObject`, restated here so the plugin contract
 * stays free of `@nestjs/swagger`'s deep import paths.
 */
export interface ApiSecurityScheme {
    /** Scheme kind. */
    type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
    /** Human description shown in the reference's auth panel. */
    description?: string;
    /** `apiKey` only — the header/cookie/query parameter name. */
    name?: string;
    /** `apiKey` only — where the credential travels. */
    in?: 'header' | 'cookie' | 'query';
    /** `http` only — e.g. `bearer` or `basic`. */
    scheme?: string;
    /** `http` + `bearer` only — a hint at the token's shape. */
    bearerFormat?: string;
}

/**
 * The generated OpenAPI document, as far as a plugin's `decorate` pass needs to
 * see it. Structural rather than `@nestjs/swagger`'s `OpenAPIObject` so a plugin
 * amending the document doesn't take on that dependency's type surface.
 */
export interface OpenApiDocument {
    /** Reusable schemas, keyed by name. */
    components?: {
        schemas?: Record<string, unknown>;
        [key: string]: unknown;
    };
    /** Operations keyed by route, then by method. */
    paths: Record<string, Record<string, unknown>>;
    [key: string]: unknown;
}

/**
 * A plugin's contribution to the host's OpenAPI document. Authentication is
 * plugin-owned (the host has no guards of its own), so the plugin that ships
 * a guard is also the one that describes how to satisfy it.
 */
export interface PluginApiDocs {
    /** Security schemes to register on the document, keyed by scheme name. */
    securitySchemes?: Record<string, ApiSecurityScheme>;
    /**
     * Scheme names advertised as document-level alternatives. Each becomes its
     * own entry in the document's `security` array — OpenAPI reads a list of
     * requirements as **OR**, so `['session', 'apiToken']` means "either one".
     * Individual routes may still be public; this only tells the reference
     * which credentials to offer when trying a request.
     */
    defaultSecurity?: string[];
    /**
     * Optional final pass over the generated document, run after every
     * operation has been tagged, in plugin-registration order.
     *
     * `@nestjs/swagger` reflects **static** TypeScript — decorated classes and
     * their metadata. A plugin whose contract is *runtime data* (content types
     * defined in code and held in a registry, not classes) has nothing for the
     * scanner to see, so it describes itself here instead: add schemas under
     * `components.schemas`, then reference them from its own operations.
     *
     * Amend only what the plugin owns — every plugin shares this document.
     */
    decorate?(document: OpenApiDocument): void;
}
