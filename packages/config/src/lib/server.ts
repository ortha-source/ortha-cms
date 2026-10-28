import { resolve } from 'node:path';

import {
    defined,
    isProduction,
    readEnum,
    readEnv,
    readFlag,
    readPositiveInt,
    readTrustProxy,
    requireEnv
} from '@orthacms/utils-server';

/** The port the server listens on (`PORT`, default 3000). */
export function port(): number {
    return readPositiveInt('PORT', 3000);
}

/** Express `trust proxy` (`TRUST_PROXY`), `undefined` when unset. */
export function trustProxy(): boolean | number | string | undefined {
    return readTrustProxy('TRUST_PROXY');
}

/** The PostgreSQL connection string. Refuses to load without one. */
export function databaseUrl(hint?: string): string {
    return requireEnv(
        'DATABASE_URL',
        hint ?? 'Set it in .env, or run `orthacms setup`.'
    );
}

/**
 * Whether this process sends webhooks and mail (`ORTHACMS_WORKERS`, default
 * on). Off, deliveries still queue for a process that has it on.
 */
export function workersEnabled(): boolean {
    return readFlag('ORTHACMS_WORKERS', true);
}

/** Whether the API reference and GraphiQL are published (`API_DOCS`). */
export function docsEnabled(): boolean {
    return readFlag('API_DOCS', !isProduction());
}

/** Whether the MCP endpoint is mounted (`MCP_ENABLED`, default off). */
export function mcpEnabled(): boolean {
    return readFlag('MCP_ENABLED', false);
}

/** The webhook sender's environment-dependent settings. */
export interface WebhookSettings {
    /** `0` when `ORTHACMS_WORKERS=false`: queue, but send nothing from here. */
    deliveryIntervalMs?: number;
    allowInsecureUrls: boolean;
    allowPrivateNetworks: boolean;
}

/** Where webhooks may reach, and whether this process sends them. */
export function webhooksFromEnv(): WebhookSettings {
    return defined({
        deliveryIntervalMs: workersEnabled() ? undefined : 0,
        allowInsecureUrls: readFlag('WEBHOOKS_ALLOW_INSECURE_URLS', false),
        allowPrivateNetworks: readFlag('WEBHOOKS_ALLOW_PRIVATE_NETWORKS', false)
    });
}

/** The schema builder's settings, as the environment gives them. */
export interface SchemaBuilderSettings {
    enabled: boolean;
    production: boolean;
    /** Absolute: resolved against the directory the server starts in. */
    projectRoot: string;
    restart: 'watch' | 'manual';
}

/**
 * The schema builder's settings. Editing writes code, so the plugin refuses it
 * in production whatever `SCHEMA_BUILDER` says (ADR-0020).
 */
export function schemaBuilderFromEnv(): SchemaBuilderSettings {
    return {
        enabled: readFlag('SCHEMA_BUILDER', false),
        production: isProduction(),
        projectRoot: resolve(readEnv('SCHEMA_BUILDER_ROOT') ?? 'apps/server'),
        restart: readEnum(
            'SCHEMA_BUILDER_RESTART',
            ['watch', 'manual'],
            'watch'
        )
    };
}

/** The administrator to provision on boot, if any. */
export interface RootAdminSettings {
    email: string;
    password: string;
    name: string;
}

/**
 * `ORTHACMS_ROOT_ADMIN_*`. Empty strings when unset, which is what the
 * identity plugin reads as "provision nobody". Read through `readEnv`, so a
 * password of three spaces is nothing rather than a password.
 */
export function rootAdminFromEnv(): RootAdminSettings {
    return {
        email: readEnv('ORTHACMS_ROOT_ADMIN_EMAIL') ?? '',
        password: readEnv('ORTHACMS_ROOT_ADMIN_PASSWORD') ?? '',
        name: readEnv('ORTHACMS_ROOT_ADMIN_NAME') ?? ''
    };
}
