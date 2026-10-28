import { renderConfigReference, renderEnvFile } from './render';

/**
 * The features this repository's own server reads: the `apps/server` the CMS
 * is developed against, which registers every SSO adapter, both copilot
 * backends, MCP, GraphQL, mail and local storage.
 */
export const WORKSPACE_FEATURES: ReadonlySet<string> = new Set([
    'workspace',
    'media-local',
    'mail',
    'sso',
    'sso-oidc',
    'sso-github',
    'sso-saml',
    'copilot-anthropic',
    'copilot-openai',
    'mcp',
    'graphql'
]);

const SECRET_FILES =
    '# Any variable can be read from a file instead: set NAME_FILE=/path/to/secret.';

/** The repository's `.env.example`. */
export function renderWorkspaceEnvExample(): string {
    return renderEnvFile({
        features: WORKSPACE_FEATURES,
        active: {
            DATABASE_URL:
                'postgresql://orthacms:orthacms@localhost:5432/orthacms'
        },
        header: [
            '# Ortha CMS — environment for this repository’s server.',
            '#',
            '# Generated from packages/config/src/lib/catalog.ts: edit the catalog and run',
            '# `ORTHACMS_WRITE_GENERATED=1 npx nx test config`, not this file. What each',
            '# variable means, its rules and the old names still read:',
            '# docs/configuration.md.',
            '#',
            '# Copy it to .env. Everything commented out is the default, so a fresh copy',
            '# boots as it is. To run a second checkout next to this one, change PORT,',
            '# ADMIN_PORT and the database name.',
            SECRET_FILES
        ]
    });
}

/** The scaffolder's `env.tmpl`, which renders into a generated app's `.env`. */
export function renderTemplateEnv(): string {
    return renderEnvFile({
        features: 'template',
        active: {
            DATABASE_URL: '__DATABASE_URL__',
            ORTHACMS_ROOT_ADMIN_EMAIL: '__ADMIN_EMAIL__',
            ORTHACMS_ROOT_ADMIN_PASSWORD: '__ADMIN_PASSWORD__',
            // Written whatever was picked, so the switch is there to turn on
            // (create-orthacms-app I-15).
            COPILOT_ENABLED: 'false',
            MCP_ENABLED: 'false'
        },
        header: [
            '# Environment for __APP_TITLE__.',
            '#',
            '# Everything commented out is the default. `npx orthacms setup` fills this in',
            '# for you and checks each value; `npx orthacms doctor` shows what is in',
            '# effect. Clear the ORTHACMS_ROOT_ADMIN_* lines once you have signed in.',
            SECRET_FILES
        ]
    });
}

/** Every generated file, by path from the repository root. */
export function generatedFiles(): Record<string, string> {
    return {
        '.env.example': renderWorkspaceEnvExample(),
        'packages/create-orthacms-app/templates/default/env.tmpl':
            renderTemplateEnv(),
        'docs/configuration.md': renderConfigReference()
    };
}
