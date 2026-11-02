import { existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { RENAMED } from '@orthacms/utils-server';

import { ENV_CATALOG, type EnvVarSpec } from './catalog';
import {
    anthropicFromEnv,
    copilotEnabled,
    copilotQuotasFromEnv,
    openAiFromEnv
} from './copilot';
import { mailFromEnv, type MailBackend } from './mail';
import { checkRetiredEnv } from './retired';
import {
    databaseUrl,
    docsEnabled,
    mcpEnabled,
    port,
    rootAdminFromEnv,
    schemaBuilderFromEnv,
    trustProxy,
    webhooksFromEnv
} from './server';
import { githubFromEnv, oidcFromEnv, samlFromEnv, ssoFromEnv } from './sso';
import {
    azureStorageFromEnv,
    directServeFromEnv,
    gcsStorageFromEnv,
    localStorageFromEnv,
    s3StorageFromEnv,
    vercelBlobStorageFromEnv
} from './storage';
import { allowedOrigins, apiPublicUrl, publicUrl } from './urls';

/** Where a variable's value came from. */
export type EnvSource = 'env' | 'file' | 'renamed' | 'default' | 'unset';

/** One variable as it stands in this environment. */
export interface EnvEntry {
    readonly spec: EnvVarSpec;
    readonly source: EnvSource;
    /** The value, masked when it is a secret. */
    readonly value?: string;
    /** The old name or the file it was read from. */
    readonly from?: string;
}

/** Something about the environment worth saying. */
export interface EnvFinding {
    readonly level: 'error' | 'warning';
    readonly message: string;
}

/** What {@link inspectEnvironment} found. */
export interface EnvReport {
    readonly entries: readonly EnvEntry[];
    readonly findings: readonly EnvFinding[];
}

/**
 * The scaffolder features an app has installed, from its own dependencies.
 * `undefined` for this repository, which installs everything.
 */
export function featuresFromDependencies(
    dependencies: Readonly<Record<string, string>>
): Set<string> {
    const has = (name: string) => `@orthacms/${name}` in dependencies;
    const features = new Set<string>();
    const map: Record<string, string> = {
        'media-provider-local': 'media-local',
        'media-provider-s3': 'media-s3',
        'media-provider-gcs': 'media-gcs',
        'media-provider-azure': 'media-azure',
        'media-provider-vercel-blob': 'media-vercel-blob',
        'copilot-provider-anthropic': 'copilot-anthropic',
        'copilot-provider-openai': 'copilot-openai',
        'identity-provider-oidc': 'sso-oidc',
        'identity-provider-github': 'sso-github',
        'identity-provider-saml': 'sso-saml',
        'mail-provider-smtp': 'mail-smtp',
        'mail-server': 'mail',
        'mcp-server': 'mcp',
        'content-graphql': 'graphql'
    };
    for (const [pkg, feature] of Object.entries(map)) {
        if (has(pkg)) {
            features.add(feature);
        }
    }
    if (['sso-oidc', 'sso-github', 'sso-saml'].some((id) => features.has(id))) {
        features.add('sso');
    }
    return features;
}

/**
 * A value fit to print: a URL keeps everything but its password, any other
 * secret keeps its last four characters.
 */
export function maskValue(spec: EnvVarSpec, value: string): string {
    if (spec.kind !== 'secret') {
        return value;
    }
    try {
        const url = new URL(value);
        if (url.password) {
            url.password = '•••';
            return decodeURI(url.href);
        }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            return value;
        }
    } catch {
        // Not a URL: fall through to the generic mask.
    }
    return value.length > 8 ? `•••${value.slice(-4)}` : '•••';
}

/** One variable's value and where it came from. */
function entryFor(spec: EnvVarSpec, env: NodeJS.ProcessEnv): EnvEntry {
    const direct = env[spec.name]?.trim();
    if (direct) {
        return { spec, source: 'env', value: maskValue(spec, direct) };
    }
    const file = env[`${spec.name}_FILE`]?.trim();
    if (file) {
        return { spec, source: 'file', from: file, value: '(from file)' };
    }
    for (const previous of RENAMED[spec.name] ?? []) {
        const legacy = env[previous]?.trim();
        if (legacy) {
            return {
                spec,
                source: 'renamed',
                from: previous,
                value: maskValue(spec, legacy)
            };
        }
    }
    return spec.default !== undefined
        ? { spec, source: 'default', value: spec.default }
        : { spec, source: 'unset' };
}

/** Runs `build` for its refusal, if it has one. */
function attempt(findings: EnvFinding[], build: () => unknown): void {
    try {
        build();
    } catch (error) {
        findings.push({
            level: 'error',
            message: error instanceof Error ? error.message : String(error)
        });
    }
}

/** How {@link inspectEnvironment} is told what to look at. */
export interface InspectOptions {
    /** The environment to inspect. Defaults to `process.env`. */
    readonly env?: NodeJS.ProcessEnv;
    /**
     * What the app installed (`featuresFromDependencies`, or
     * `WORKSPACE_FEATURES` for this repository). `undefined` means everything
     * the catalog lists.
     */
    readonly features?: ReadonlySet<string>;
}

/**
 * Every variable the app reads, where its value came from, and what is wrong.
 *
 * The validation is not a second copy of the rules: it runs the same builders
 * the server runs at boot, so a refusal here is the refusal the server would
 * give. On top of that it says what the server cannot know is a mistake — an
 * old name still in use, a production deployment behind a proxy nobody told it
 * about, a debugging switch left on.
 */
export function inspectEnvironment(options: InspectOptions = {}): EnvReport {
    const env = options.env ?? process.env;
    const features = options.features;
    const installed = (id: string) => !features || features.has(id);
    const relevant = ENV_CATALOG.filter(
        (spec) => !spec.features || spec.features.some(installed)
    );
    const entries = relevant.map((spec) => entryFor(spec, env));
    const findings: EnvFinding[] = [];

    const saved = process.env;
    const warnings: string[] = [];
    const savedWarn = console.warn;
    process.env = env;
    console.warn = (message: unknown) => warnings.push(String(message));
    try {
        attempt(findings, () => checkRetiredEnv(env, (m) => warnings.push(m)));
        attempt(findings, databaseUrl);
        attempt(findings, port);
        attempt(findings, trustProxy);
        attempt(findings, publicUrl);
        attempt(findings, apiPublicUrl);
        attempt(findings, allowedOrigins);
        attempt(findings, docsEnabled);
        attempt(findings, webhooksFromEnv);
        attempt(findings, schemaBuilderFromEnv);
        attempt(findings, rootAdminFromEnv);
        attempt(findings, copilotQuotasFromEnv);
        if (installed('mcp')) attempt(findings, mcpEnabled);
        if (installed('mail')) {
            // `console://` is installed in this repository's server only.
            const backends: MailBackend[] = installed('workspace')
                ? ['smtp', 'console']
                : ['smtp'];
            attempt(findings, () => mailFromEnv(backends));
        }
        if (installed('sso')) attempt(findings, ssoFromEnv);
        if (installed('sso-oidc')) attempt(findings, oidcFromEnv);
        if (installed('sso-github')) attempt(findings, githubFromEnv);
        if (installed('sso-saml')) attempt(findings, samlFromEnv);
        if (installed('media-local')) attempt(findings, localStorageFromEnv);
        if (installed('media-s3')) attempt(findings, s3StorageFromEnv);
        if (installed('media-gcs')) attempt(findings, gcsStorageFromEnv);
        if (installed('media-azure')) attempt(findings, azureStorageFromEnv);
        if (installed('media-vercel-blob'))
            attempt(findings, vercelBlobStorageFromEnv);
        attempt(findings, directServeFromEnv);

        let enabled = false;
        attempt(findings, () => {
            enabled = copilotEnabled();
        });
        const backends = [anthropicFromEnv, openAiFromEnv].filter((build) => {
            try {
                return build() !== undefined;
            } catch {
                return false;
            }
        });
        if (enabled && backends.length === 0) {
            findings.push({
                level: 'error',
                message:
                    'COPILOT_ENABLED=true but no backend is configured (ANTHROPIC_API_KEY or COPILOT_OPENAI_BASE_URL) — the server refuses to start.'
            });
        }
        productionChecks(env, findings);
    } finally {
        process.env = saved;
        console.warn = savedWarn;
    }
    for (const message of warnings) {
        findings.push({ level: 'warning', message });
    }
    return { entries, findings };
}

/** What a production deployment gets wrong without being refused for it. */
function productionChecks(
    env: NodeJS.ProcessEnv,
    findings: EnvFinding[]
): void {
    const value = (name: string) => env[name]?.trim() ?? '';
    const on = (name: string) =>
        ['true', '1'].includes(value(name).toLowerCase());
    if (value('NODE_ENV') !== 'production') {
        return;
    }
    const url = value('PUBLIC_URL') || value('APP_URL');
    if (url.startsWith('http://')) {
        findings.push({
            level: 'warning',
            message:
                'PUBLIC_URL is plain http:// in production: the session cookie is Secure, so browsers will not send it back and sign-in fails.'
        });
    }
    if (!value('TRUST_PROXY')) {
        findings.push({
            level: 'warning',
            message:
                'TRUST_PROXY is unset. Fine if the server is exposed directly; behind a load balancer every client shares one login rate-limit bucket.'
        });
    }
    if (
        value('MAIL_URL').startsWith('console:') ||
        value('MAIL_PROVIDER') === 'console'
    ) {
        findings.push({
            level: 'error',
            message:
                'Mail goes to console:// in production: invitations look sent and reach nobody.'
        });
    }
    if (on('MAIL_REVEAL_LINKS')) {
        findings.push({
            level: 'warning',
            message:
                'MAIL_REVEAL_LINKS=true: invite and reset links are returned in API responses as well as emailed.'
        });
    }
    if (on('WEBHOOKS_ALLOW_INSECURE_URLS')) {
        findings.push({
            level: 'warning',
            message:
                'WEBHOOKS_ALLOW_INSECURE_URLS=true: webhook payloads may travel over plain HTTP.'
        });
    }
    if (on('WEBHOOKS_ALLOW_PRIVATE_NETWORKS')) {
        findings.push({
            level: 'warning',
            message:
                'WEBHOOKS_ALLOW_PRIVATE_NETWORKS=true: a webhook URL can reach this network, including cloud metadata endpoints.'
        });
    }
    if (value('ORTHACMS_ROOT_ADMIN_PASSWORD')) {
        findings.push({
            level: 'warning',
            message:
                'ORTHACMS_ROOT_ADMIN_PASSWORD is still set. Once the administrator exists, remove it — it is a password sitting in the environment.'
        });
    }
    const root = value('MEDIA_LOCAL_ROOT') || './.storage/media';
    if (!isAbsolute(root) && existsSync('/.dockerenv')) {
        findings.push({
            level: 'warning',
            message: `Uploads go to ${root} inside a container: unless that is a mounted volume, they vanish on the next deploy.`
        });
    }
}
