/**
 * What a generated app is made of.
 *
 * **This file is the contract between the release and the scaffolder.** Every
 * published `@orthacms/*` package is accounted for here exactly once — as core,
 * as part of an optional feature, or as deliberately transitive — and
 * `features.spec.ts` fails the build when one is not. That guard is the point:
 * adding a package to the workspace should force a decision about whether a new
 * app gets it, rather than the template quietly falling a release behind.
 *
 * Versions are *not* listed. Every `@orthacms/*` dependency is pinned to the
 * scaffolder's own version at render time (`__ORTHA_VERSION__`), so a release
 * bumps the whole set with no edit here.
 */

/** An optional capability a new app can opt into. */
export interface Feature {
    /** Stable id — used by `ortha:if` blocks in the templates and by flags. */
    id: string;
    /** What the picker shows. */
    label: string;
    /** One line under the label. */
    hint: string;
    /** `@orthacms/*` packages added to the app when this is enabled. */
    packages: readonly string[];
    /** Whether it starts ticked. */
    enabledByDefault: boolean;
    /**
     * `false` for a capability that exists in the codebase but has no published,
     * working adapter yet. Shown greyed out and unselectable rather than hidden,
     * so the picker tells the truth about what is coming.
     */
    available: boolean;
    /**
     * Always on, and shown ticked but unselectable. For REST, which is not a
     * choice — it is what the other protocols adapt.
     */
    locked?: boolean;
}

/**
 * The packages every app gets, whatever it opts into.
 *
 * The **copilot** is here — plugin, admin panel and the offline `fake` adapter —
 * even though it is a large feature nobody may want. Two reasons. Its server
 * half arrives anyway: five core plugins (`content`, `activity`, `i18n`,
 * `media`, `users`) depend on `copilot-server` to contribute their tools, so
 * the code is on disk whatever the manifest says, and leaving it undeclared
 * bought nothing but a missing chat panel. And `fake` needs no key and no
 * network, so a default app gets a copilot that genuinely works offline —
 * while `COPILOT_ENABLED` stays `false`, so nothing reaches a model until an
 * operator says so.
 *
 * The **extension points** are here for the same reason — `content-domain`,
 * `copilot-domain`, `tools-server`, `query-builder-admin`. Every one of them
 * already arrives transitively, so an import would resolve on npm's flat
 * `node_modules` today; declaring them is what makes that resolution something
 * the app owns rather than something it borrows. An undeclared import breaks
 * the moment a version conflict nests a copy, and never resolves under pnpm at
 * all.
 *
 * **SSO** contributes two entries on the same reasoning as the copilot's.
 * `identity-domain` is an extension point — the `SsoProvider` port an operator
 * implements to reach an identity provider we do not ship an adapter for — and
 * it already arrives transitively through `identity-server`, so declaring it is
 * what makes that resolution something the app owns rather than borrows.
 * `identity-provider-fake` is the scripted identity provider: it needs no
 * tenant and no network, so it is how a generated app's sign-in page can be
 * exercised offline, exactly as `copilot-provider-fake` is for the chat. Note
 * that shipping it installs nothing: an adapter only does something once the
 * composition root registers it, and the template registers none.
 *
 * `design-system`, `utils-admin` and `utils-server` are here even though the
 * template's own files barely touch them: they are the first things anyone
 * reaches for when writing a page or a plugin of their own, and relying on
 * npm's hoisting to make an undeclared import work is a phantom dependency —
 * it resolves until a version conflict nests a copy, and never resolves under
 * pnpm at all.
 */
export const CORE_PACKAGES: readonly string[] = [
    '@orthacms/activity-admin',
    '@orthacms/activity-server',
    '@orthacms/api-tokens-admin',
    '@orthacms/bootstrap-admin',
    '@orthacms/bootstrap-server',
    '@orthacms/content-admin',
    '@orthacms/content-domain',
    '@orthacms/content-server',
    '@orthacms/copilot-admin',
    '@orthacms/copilot-domain',
    '@orthacms/copilot-provider-fake',
    '@orthacms/copilot-server',
    '@orthacms/database',
    '@orthacms/design-system',
    '@orthacms/i18n-admin',
    '@orthacms/i18n-server',
    '@orthacms/identity-admin',
    '@orthacms/identity-domain',
    '@orthacms/identity-provider-fake',
    '@orthacms/identity-server',
    '@orthacms/insights-admin',
    '@orthacms/media-admin',
    '@orthacms/media-server',
    '@orthacms/query-builder-admin',
    '@orthacms/segments-domain',
    '@orthacms/segments-server',
    '@orthacms/shell-admin',
    '@orthacms/tools-server',
    '@orthacms/transfer-admin',
    '@orthacms/transfer-domain',
    '@orthacms/transfer-server',
    '@orthacms/users-admin',
    '@orthacms/users-server',
    '@orthacms/utils-admin',
    '@orthacms/utils-server',
    '@orthacms/workspaces-admin',
    '@orthacms/workspaces-server',
    '@orthacms/wysiwyg-admin'
];

/** Packages the app needs to build and run itself, as devDependencies. */
export const CORE_DEV_PACKAGES: readonly string[] = ['@orthacms/cli'];

/**
 * Packages deliberately left undeclared — published, but with no reason for a
 * generated app to import them.
 *
 * Both entries are tools for **writing a storage provider**, not for running
 * one. `StorageProviderCheck` refuses to boot a database whose rows were
 * written by a provider that is no longer configured, so the in-memory backend
 * is a test and offline-development affordance, never a deployment: offering it
 * in the scaffolder would be offering an app that loses every upload on
 * restart. The testkit is the contract suite those providers run against.
 *
 * Everything else a generated app can reach is in its own manifest, so "it
 * resolves because npm hoisted it" is never the answer to why an import works.
 * Putting a package here is a decision the coverage guard accepts; forgetting
 * it entirely is not.
 */
export const TRANSITIVE_PACKAGES: readonly string[] = [
    '@orthacms/media-provider-memory',
    '@orthacms/media-provider-testkit'
];

/**
 * Where uploads are written.
 *
 * A single-choice group: media always runs, the question is only which adapter
 * backs it. S3 is listed and disabled — the package exists but has never been
 * released, and offering it would generate an app that cannot install.
 */
export const MEDIA_PROVIDERS: readonly Feature[] = [
    {
        id: 'media-local',
        label: 'Local filesystem',
        hint: 'Writes to a directory on disk. Point MEDIA_LOCAL_ROOT at a volume in production.',
        packages: ['@orthacms/media-provider-local'],
        enabledByDefault: true,
        available: true
    },
    {
        id: 'media-azure',
        label: 'Azure Blob Storage',
        hint: 'Set MEDIA_AZURE_CONTAINER and a connection string. Managed identity needs a hand-built client — see the package docs.',
        packages: ['@orthacms/media-provider-azure'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'media-gcs',
        label: 'Google Cloud Storage',
        hint: 'Native GCS auth. If an HMAC key is acceptable, the S3-compatible adapter reaches GCS too — one package fewer.',
        packages: ['@orthacms/media-provider-gcs'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'media-vercel-blob',
        label: 'Vercel Blob',
        hint: 'Smallest setup on Vercel — but every blob gets a permanent public URL, so not for confidential media.',
        packages: ['@orthacms/media-provider-vercel-blob'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'media-s3',
        label: 'S3-compatible',
        hint: 'Cloudflare R2, AWS S3, MinIO, Spaces, B2, Wasabi — set MEDIA_S3_BUCKET and, for anything but AWS, MEDIA_S3_ENDPOINT.',
        packages: ['@orthacms/media-provider-s3'],
        enabledByDefault: false,
        available: true
    }
];

/**
 * Model backends for the AI copilot.
 *
 * A multi-choice group, and picking none is the meaningful default: enabling a
 * hosted provider sends workspace content to a third party, which
 * [ADR-0005](https://github.com/ortha-source/ortha-cms/blob/main/docs/adr/0005-copilot-authority-model.md)
 * §10 says is an operator's decision to make explicitly. Pick nothing and the
 * copilot is not registered at all.
 *
 * `copilot-provider-fake` is not offered here — it is installed automatically
 * whenever the copilot is on. It is a shipped adapter rather than test
 * scaffolding (ADR-0004 §3): it needs no key and no network, so it is what
 * makes the chat work offline, and it is registered last so it is the default
 * only when it is the only one.
 */
export const COPILOT_PROVIDERS: readonly Feature[] = [
    {
        id: 'copilot-anthropic',
        label: 'Claude (Anthropic)',
        hint: 'Native Claude. Needs ANTHROPIC_API_KEY.',
        packages: ['@orthacms/copilot-provider-anthropic'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'copilot-openai',
        label: 'OpenAI-compatible endpoint',
        hint: 'Ollama, vLLM, LiteLLM, Azure or OpenAI. Needs COPILOT_OPENAI_BASE_URL.',
        packages: ['@orthacms/copilot-provider-openai'],
        enabledByDefault: false,
        available: true
    }
];

/**
 * How people sign in to the admin.
 *
 * A single opt-in, and off by default, because SSO is not something a CMS can
 * usefully guess at: it needs an issuer, a client and a callback URL registered
 * on the other side, none of which a scaffolder can invent. A generated app
 * without it signs in with email and password, which is the invite-only flow
 * Ortha has always had.
 *
 * **One entry covers most of the field.** Okta, Auth0, Keycloak, Google, Entra
 * ID, Authentik, Zitadel, JumpCloud, Ping and GitLab all speak OpenID Connect,
 * and the named vendors are preset factories inside that one package rather
 * than packages of their own — the SSO equivalent of the copilot's
 * OpenAI-compatible adapter.
 *
 * The other two are here because their **wire** genuinely differs, which is the
 * only thing that earns a package: GitHub is OAuth2 with no identity token, and
 * SAML is a POST binding with XML signatures. Each also brings its own
 * dependency — `jose` for OIDC, `@node-saml/node-saml` for SAML — which is a
 * second reason not to install them for an app that will never speak them.
 *
 * `identity-provider-fake` is not offered: it is installed unconditionally,
 * like `copilot-provider-fake`, because it needs no tenant and no network and
 * is how a generated app's sign-in page is exercised offline. Installing it
 * registers nothing — an adapter only does something once the composition root
 * names it, and the template names none.
 */
export const SSO_PROVIDERS: readonly Feature[] = [
    {
        id: 'sso-oidc',
        label: 'OpenID Connect single sign-on',
        hint: 'Okta, Auth0, Keycloak, Google, Entra ID and the rest. Needs SSO_OIDC_ISSUER and SSO_OIDC_CLIENT_ID.',
        packages: ['@orthacms/identity-provider-oidc'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'sso-github',
        label: 'GitHub sign-in',
        hint: 'GitHub or GitHub Enterprise Server. Needs SSO_GITHUB_CLIENT_ID and SSO_GITHUB_CLIENT_SECRET.',
        packages: ['@orthacms/identity-provider-github'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'sso-saml',
        label: 'SAML 2.0 single sign-on',
        hint: 'For an identity provider that speaks SAML rather than OIDC. Needs the IdP certificate and entry point.',
        packages: ['@orthacms/identity-provider-saml'],
        enabledByDefault: false,
        available: true
    }
];

/**
 * How the content API is spoken.
 *
 * REST is always there and is shown `locked` rather than hidden, because "which
 * protocols does this app serve" is a more useful question than "do you want
 * these two extras" — the answer should read as a set, with the one you always
 * get visible in it.
 *
 * Neither addition brings a credential or a permission of its own: GraphQL is
 * an adapter over the REST API's own services
 * ([ADR-0008](https://github.com/ortha-source/ortha-cms/blob/main/docs/adr/0008-graphql-as-a-protocol-adapter.md)),
 * and MCP reuses the same API tokens and scopes. They are opt-in because an
 * endpoint nobody asked for is still an endpoint.
 */
export const PROTOCOLS: readonly Feature[] = [
    {
        id: 'rest',
        label: 'REST',
        hint: 'Always on — /api/v1/…, the API every other protocol adapts.',
        packages: [],
        enabledByDefault: true,
        available: true,
        locked: true
    },
    {
        id: 'graphql',
        label: 'GraphQL content API',
        hint: 'POST /api/v1/graphql, alongside REST. Same tokens, same scopes.',
        packages: ['@orthacms/content-graphql'],
        enabledByDefault: false,
        available: true
    },
    {
        id: 'mcp',
        label: 'MCP server',
        hint: 'Lets an external agent do content CRUD with an API token. Off unless MCP_ENABLED=true.',
        packages: ['@orthacms/mcp-server'],
        enabledByDefault: false,
        available: true
    }
];

/** Every optional feature, in the order the wizard asks about them. */
export const ALL_FEATURES: readonly Feature[] = [
    ...MEDIA_PROVIDERS,
    ...COPILOT_PROVIDERS,
    ...SSO_PROVIDERS,
    ...PROTOCOLS
];

/** The answers a scaffold run resolves to. */
export interface FeatureSelection {
    /** Ids of every enabled feature — what `ortha:if` blocks are tested against. */
    enabled: ReadonlySet<string>;
}

/**
 * The `@orthacms/*` dependencies for a selection, sorted.
 *
 * Built here rather than with `ortha:if` blocks inside `package.json.tmpl`:
 * removing lines from JSON is how you get a trailing comma and an app that
 * cannot even be installed, and the failure would name the template rather than
 * the feature that was switched off.
 */
export function resolvePackages(selection: FeatureSelection): string[] {
    const packages = new Set(CORE_PACKAGES);

    for (const feature of ALL_FEATURES) {
        if (!selection.enabled.has(feature.id)) continue;
        for (const name of feature.packages) packages.add(name);
    }

    return [...packages].sort();
}

/** The dev-time `@orthacms/*` dependencies, sorted. */
export function resolveDevPackages(): string[] {
    return [...CORE_DEV_PACKAGES].sort();
}

/** The feature ids in force for a selection — what `ortha:if` tests against. */
export function resolveFlags(selection: FeatureSelection): Set<string> {
    return new Set(selection.enabled);
}
