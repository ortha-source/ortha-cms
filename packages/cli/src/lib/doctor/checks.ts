import { X509Certificate } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

import {
    anthropicFromEnv,
    localStorageFromEnv,
    mailFromEnv,
    oidcFromEnv,
    openAiFromEnv,
    s3StorageFromEnv,
    samlFromEnv,
    type MailSettings
} from '@orthacms/config';
import { Client } from 'pg';

/** The outcome of one live check. */
export interface CheckResult {
    /** What was checked, as the operator would name it. */
    readonly name: string;
    readonly ok: boolean;
    /** What was found, or why it failed. */
    readonly detail: string;
}

/** A check that talks to something outside the process. */
export interface LiveCheck {
    readonly name: string;
    run(): Promise<string>;
}

/** How long any one check may take: a doctor that hangs is worse than none. */
const TIMEOUT_MS = 5_000;

/** Runs every check, never throwing; a failure is a result. */
export async function runChecks(
    checks: readonly LiveCheck[]
): Promise<CheckResult[]> {
    return Promise.all(
        checks.map(async (check) => {
            try {
                return {
                    name: check.name,
                    ok: true,
                    detail: await check.run()
                };
            } catch (error) {
                return {
                    name: check.name,
                    ok: false,
                    detail:
                        error instanceof Error ? error.message : String(error)
                };
            }
        })
    );
}

/** Resolves a module the app has installed, or `undefined` when it has not. */
function fromApp<T>(root: string, name: string): T | undefined {
    try {
        return createRequire(join(root, 'package.json'))(name) as T;
    } catch {
        return undefined;
    }
}

/** `fetch` with the doctor's timeout, refusing a non-2xx answer. */
async function get(
    url: string,
    headers: Record<string, string> = {}
): Promise<Response> {
    const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!response.ok) {
        throw new Error(`${url} answered ${response.status}`);
    }
    return response;
}

/** Connects, asks the server its version, and disconnects. */
export function databaseCheck(url: string): LiveCheck {
    return {
        name: 'Database',
        async run() {
            const client = new Client({
                connectionString: url,
                connectionTimeoutMillis: TIMEOUT_MS
            });
            await client.connect();
            try {
                const { rows } = await client.query<{ server_version: string }>(
                    'show server_version'
                );
                return `connected · PostgreSQL ${rows[0]?.server_version ?? '?'}`;
            } finally {
                await client.end();
            }
        }
    };
}

/** Writes and removes a file where uploads go. */
export function localStorageCheck(root: string): LiveCheck {
    return {
        name: 'Uploads (local disk)',
        async run() {
            const dir = resolve(root, localStorageFromEnv().rootDir);
            mkdirSync(dir, { recursive: true });
            const probe = join(dir, `.orthacms-doctor-${process.pid}`);
            writeFileSync(probe, '');
            rmSync(probe);
            return `${dir} is writable`;
        }
    };
}

/** Asks S3 whether the bucket is there and these credentials may use it. */
export function s3Check(root: string): LiveCheck {
    return {
        name: 'Uploads (S3)',
        async run() {
            const sdk = fromApp<{
                S3Client: new (options: object) => {
                    send(command: object): Promise<unknown>;
                };
                HeadBucketCommand: new (input: { Bucket: string }) => object;
            }>(root, '@aws-sdk/client-s3');
            if (!sdk) {
                throw new Error(
                    '@aws-sdk/client-s3 is not installed in this app'
                );
            }
            const settings = s3StorageFromEnv();
            const client = new sdk.S3Client({
                region: settings.region,
                endpoint: settings.endpoint,
                forcePathStyle: settings.forcePathStyle,
                credentials: settings.credentials
            });
            await client.send(
                new sdk.HeadBucketCommand({ Bucket: settings.bucket })
            );
            return `bucket ${settings.bucket} is reachable`;
        }
    };
}

/** Connects to the relay, upgrades to TLS where asked, and logs in. */
export function smtpCheck(root: string, mail: MailSettings): LiveCheck {
    return {
        name: 'Mail',
        async run() {
            if (mail.backend === 'console') {
                return 'console:// — messages go to the server log';
            }
            const nodemailer = fromApp<{
                createTransport(options: object): {
                    verify(): Promise<true>;
                    close(): void;
                };
            }>(root, 'nodemailer');
            if (!nodemailer || !mail.smtp) {
                throw new Error('nodemailer is not installed in this app');
            }
            const transport = nodemailer.createTransport({
                host: mail.smtp.host,
                port: mail.smtp.port ?? 587,
                secure: mail.smtp.secure ?? false,
                requireTLS: mail.smtp.requireTls ?? false,
                auth: mail.smtp.user
                    ? { user: mail.smtp.user, pass: mail.smtp.password }
                    : undefined,
                connectionTimeout: TIMEOUT_MS
            });
            try {
                await transport.verify();
            } finally {
                transport.close();
            }
            return `${mail.smtp.host} accepted the connection${mail.smtp.user ? ' and the login' : ''}`;
        }
    };
}

/** Fetches the discovery document and compares its issuer byte for byte. */
export function oidcCheck(issuer: string): LiveCheck {
    return {
        name: 'Single sign-on (OIDC)',
        async run() {
            const url = `${issuer.replace(/\/$/, '')}/.well-known/openid-configuration`;
            const document = (await (await get(url)).json()) as {
                issuer?: string;
            };
            if (document.issuer !== issuer) {
                throw new Error(
                    `the provider calls itself "${document.issuer}", not "${issuer}" — the iss claim must match SSO_OIDC_ISSUER exactly, trailing slash included`
                );
            }
            return 'discovery document found, issuer matches';
        }
    };
}

/** Parses the IdP certificate and says when it expires. */
export function samlCertificateCheck(pem: string): LiveCheck {
    return {
        name: 'Single sign-on (SAML certificate)',
        async run() {
            const body = pem.includes('BEGIN CERTIFICATE')
                ? pem
                : `-----BEGIN CERTIFICATE-----\n${pem}\n-----END CERTIFICATE-----`;
            const certificate = new X509Certificate(body);
            const expires = new Date(certificate.validTo);
            const days = Math.floor(
                (expires.getTime() - Date.now()) / 86_400_000
            );
            if (days < 0) {
                throw new Error(
                    `the certificate expired on ${expires.toDateString()}`
                );
            }
            if (days < 30) {
                throw new Error(
                    `the certificate expires in ${days} days (${expires.toDateString()}) — sign-in stops then`
                );
            }
            return `valid until ${expires.toDateString()}`;
        }
    };
}

/** Lists the models the key may use. */
export function anthropicCheck(apiKey: string, baseUrl?: string): LiveCheck {
    return {
        name: 'Copilot (Claude)',
        async run() {
            const base = (baseUrl ?? 'https://api.anthropic.com').replace(
                /\/$/,
                ''
            );
            const body = (await (
                await get(`${base}/v1/models`, {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                })
            ).json()) as { data?: { id: string }[] };
            return `key works · ${body.data?.length ?? 0} models available`;
        }
    };
}

/** Lists the models an OpenAI-compatible endpoint serves. */
export function openAiCheck(baseUrl: string, apiKey: string): LiveCheck {
    return {
        name: 'Copilot (OpenAI-compatible)',
        async run() {
            const body = (await (
                await get(
                    `${baseUrl.replace(/\/$/, '')}/models`,
                    apiKey ? { authorization: `Bearer ${apiKey}` } : {}
                )
            ).json()) as { data?: { id: string }[] };
            const count = body.data?.length ?? 0;
            if (count === 0) {
                throw new Error(
                    'the endpoint serves no models — pull one first (ollama pull …)'
                );
            }
            return `${count} models available`;
        }
    };
}

/**
 * The checks this app's configuration calls for. Each builder is wrapped:
 * one the static inspection already reported as broken yields no check.
 */
export function plannedChecks(
    root: string,
    features: ReadonlySet<string>,
    databaseUrl: string | undefined
): LiveCheck[] {
    const checks: LiveCheck[] = [];
    const safely = <T>(build: () => T): T | undefined => {
        try {
            return build();
        } catch {
            return undefined;
        }
    };
    if (databaseUrl) checks.push(databaseCheck(databaseUrl));
    if (features.has('media-local')) checks.push(localStorageCheck(root));
    if (features.has('media-s3') && safely(s3StorageFromEnv))
        checks.push(s3Check(root));
    if (features.has('mail')) {
        const backends: ('smtp' | 'console')[] = features.has('workspace')
            ? ['smtp', 'console']
            : ['smtp'];
        const mail = safely(() => mailFromEnv(backends));
        if (mail) checks.push(smtpCheck(root, mail));
    }
    const oidc = features.has('sso-oidc') ? safely(oidcFromEnv) : undefined;
    if (oidc) checks.push(oidcCheck(oidc.issuer));
    const saml = features.has('sso-saml') ? safely(samlFromEnv) : undefined;
    if (saml) checks.push(samlCertificateCheck(saml.idpCert));
    const claude = features.has('copilot-anthropic')
        ? safely(anthropicFromEnv)
        : undefined;
    if (claude) checks.push(anthropicCheck(claude.apiKey, claude.baseUrl));
    const openai = features.has('copilot-openai')
        ? safely(openAiFromEnv)
        : undefined;
    if (openai) checks.push(openAiCheck(openai.baseUrl, openai.apiKey));
    return checks;
}
