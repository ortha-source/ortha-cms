import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SETUP_STEPS, buildMailUrl, oidcIssuer } from '@orthacms/config';

import {
    generatePassword,
    parseSetPairs,
    setupCommand
} from '../commands/setup';
import { runEngine, type EngineHooks } from './engine';
import { applyToEnvFile, diffValues, quote } from './env-file';
import { renderCompose, renderKubernetesSecret } from './output';
import type { Prompter } from './prompter';

/**
 * A prompter that answers from a script, keyed by the start of each question,
 * and fails the test on a question the script did not expect — so a branch
 * that asks one question too many, or one too few, is a red test.
 */
function scripted(
    answers: Record<string, string | boolean>
): Prompter & { asked: string[] } {
    const asked: string[] = [];
    const find = (label: string) => {
        asked.push(label);
        const key = Object.keys(answers).find((prefix) =>
            label.startsWith(prefix)
        );
        if (key === undefined) throw new Error(`Unexpected question: ${label}`);
        return answers[key] as string | boolean;
    };
    return {
        asked,
        text: async ({ label, default: fallback }) => {
            const answer = find(label);
            return answer === '' ? (fallback ?? '') : String(answer);
        },
        choice: async ({ label, choices }) => {
            const answer = String(find(label));
            if (!choices.some((choice) => choice.value === answer)) {
                throw new Error(`"${answer}" is not offered for: ${label}`);
            }
            return answer;
        },
        confirm: async ({ label }) => Boolean(find(label)),
        say: () => undefined,
        close: () => undefined
    };
}

const passing: EngineHooks = {
    check: async () => ({ ok: true, detail: 'ok' })
};

describe('the setup engine', () => {
    it('follows the R2 branch: the endpoint and region come from the account id', async () => {
        const { values } = await runEngine({
            steps: SETUP_STEPS.filter((step) => step.id === 'storage-s3'),
            production: true,
            features: new Set(['media-s3']),
            initial: {},
            prompter: scripted({
                Bucket: 'acme-media',
                'Where is the bucket?': 'r2',
                'R2 account ID': '4f1c9e',
                'How does the app sign in': 'role',
                'Serve downloads': false
            }),
            hooks: passing
        });
        expect(values).toMatchObject({
            MEDIA_S3_BUCKET: 'acme-media',
            MEDIA_S3_ENDPOINT: 'https://4f1c9e.r2.cloudflarestorage.com',
            MEDIA_S3_REGION: 'auto',
            MEDIA_S3_ACCESS_KEY_ID: undefined,
            MEDIA_DIRECT_SERVE: undefined
        });
    });

    it('builds MAIL_URL from a preset and the login, encoding the password', async () => {
        const { values } = await runEngine({
            steps: SETUP_STEPS.filter((step) => step.id === 'mail'),
            production: true,
            features: new Set(['mail', 'mail-smtp']),
            initial: {},
            prompter: scripted({
                'How should invitations': 'smtp',
                'Which service?': 'resend',
                Username: '',
                'Password or API key': 're_s3cr@t',
                'Refuse to send': true,
                From: 'Acme <cms@acme.com>'
            }),
            hooks: passing
        });
        expect(values['MAIL_URL']).toBe(
            'smtp://resend:re_s3cr%40t@smtp.resend.com:587?requireTls=true'
        );
        expect(values['MAIL_FROM']).toBe('Acme <cms@acme.com>');
    });

    it('does not offer console:// outside this repository', async () => {
        await expect(
            runEngine({
                steps: SETUP_STEPS.filter((step) => step.id === 'mail'),
                production: false,
                features: new Set(['mail', 'mail-smtp']),
                initial: {},
                prompter: scripted({ 'How should invitations': 'console' }),
                hooks: passing
            })
        ).rejects.toThrow('not offered');
    });

    it('asks Entra its tenant and the email-verified question, and derives the issuer', async () => {
        const { values } = await runEngine({
            steps: SETUP_STEPS.filter((step) => step.id === 'sso-oidc'),
            production: true,
            features: new Set(['sso', 'sso-oidc']),
            initial: { PUBLIC_URL: 'https://cms.acme.com' },
            prompter: scripted({
                'Configure it now?': 'yes',
                'Which provider?': 'entra',
                'Tenant ID': 'acme-tenant',
                'Does your directory own': true,
                'Client ID': 'client',
                'Client secret': 'shh'
            }),
            hooks: passing
        });
        expect(values).toMatchObject({
            SSO_OIDC_ISSUER:
                'https://login.microsoftonline.com/acme-tenant/v2.0',
            SSO_OIDC_CLIENT_ID: 'client',
            SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT: 'true'
        });
    });

    it('skips production-only steps in development, and steps for uninstalled features', async () => {
        const prompter = scripted({
            Database: 'existing',
            'Connection string': 'postgresql://u:p@localhost/cms'
        });
        await runEngine({
            steps: SETUP_STEPS,
            production: false,
            features: new Set(['media-local']),
            initial: {},
            prompter,
            hooks: passing
        });
        expect(prompter.asked).toEqual(['Database', 'Connection string']);
    });

    it('offers retry, edit and skip when a check fails, and records a skip', async () => {
        const { skipped } = await runEngine({
            steps: SETUP_STEPS.filter(
                (step) => step.id === 'copilot-anthropic'
            ),
            production: true,
            features: new Set(['copilot-anthropic']),
            initial: {},
            prompter: scripted({
                'Anthropic API key': 'sk-bad',
                'What now?': 'skip'
            }),
            hooks: {
                check: async () => ({ ok: false, detail: 'answered 401' })
            }
        });
        expect(skipped).toEqual(['copilot-anthropic']);
    });

    it('asks to turn the copilot on only once a backend is configured', async () => {
        const prompter = scripted({ 'Anthropic API key': '' });
        await runEngine({
            steps: SETUP_STEPS.filter((step) => step.section === 'Copilot'),
            production: true,
            features: new Set(['copilot-anthropic']),
            initial: {},
            prompter,
            hooks: passing
        });
        expect(prompter.asked).toEqual([
            'Anthropic API key (Enter to leave Claude unregistered)'
        ]);
    });
});

describe('the helpers behind the steps', () => {
    it('uses smtps:// for 465 and never adds requireTls to it', () => {
        expect(buildMailUrl({ host: 'h', port: 465, requireTls: true })).toBe(
            'smtps://h:465'
        );
    });

    it('gives Auth0 its trailing slash, which the iss claim carries', () => {
        expect(
            oidcIssuer({ provider: 'auth0', domain: 'acme.eu.auth0.com' })
        ).toBe('https://acme.eu.auth0.com/');
    });

    it('generates a password of three dashed groups', () => {
        expect(generatePassword()).toMatch(/^[\w-]{6}-[\w-]{6}-[\w-]{6}$/);
    });

    it('refuses a --set without a name', () => {
        expect(() => parseSetPairs(['=x'])).toThrow('--set takes NAME=value');
        expect(parseSetPairs(['A=1', 'B='])).toEqual({ A: '1', B: undefined });
    });
});

describe('writing .env', () => {
    it('rewrites in place, uncomments an example, appends the rest, removes what went', () => {
        const before = [
            '# The address people open the admin on.',
            '# PUBLIC_URL=https://cms.example.com',
            'APP_URL=http://old.example.com',
            'DATABASE_URL=postgresql://old',
            'ORTHACMS_ROOT_ADMIN_PASSWORD=hunter2',
            ''
        ].join('\n');
        expect(
            applyToEnvFile(before, {
                PUBLIC_URL: 'https://cms.acme.com',
                DATABASE_URL: 'postgresql://new',
                ORTHACMS_ROOT_ADMIN_PASSWORD: undefined,
                MAIL_FROM: 'Acme <cms@acme.com>'
            })
        ).toBe(
            [
                '# The address people open the admin on.',
                'PUBLIC_URL=https://cms.acme.com',
                'DATABASE_URL=postgresql://new',
                "MAIL_FROM='Acme <cms@acme.com>'",
                ''
            ].join('\n')
        );
    });

    it('quotes what a .env parser would otherwise cut short', () => {
        expect(quote('plain-value_1')).toBe('plain-value_1');
        expect(quote('has # hash')).toBe("'has # hash'");
        expect(quote("it's")).toBe('"it\'s"');
    });

    it('diffs to the changed and the removed keys only', () => {
        expect(
            diffValues(
                { A: '1', B: '2', C: '3' },
                { A: '1', B: '9', C: undefined }
            )
        ).toEqual({
            B: '9',
            C: undefined
        });
    });
});

describe('the other outputs', () => {
    it('renders a Kubernetes Secret and a Compose block with every value quoted', () => {
        const values = {
            PUBLIC_URL: 'https://cms.acme.com',
            MAIL_FROM: 'A <a@b.c>',
            GONE: undefined
        };
        expect(renderKubernetesSecret(values)).toContain(
            '  MAIL_FROM: "A <a@b.c>"'
        );
        expect(renderKubernetesSecret(values)).not.toContain('GONE');
        expect(renderCompose(values)).toContain(
            '      PUBLIC_URL: "https://cms.acme.com"'
        );
    });
});

describe('orthacms setup --yes', () => {
    let root: string;
    const saved = process.env;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'orthacms-setup-'));
        writeFileSync(
            join(root, 'package.json'),
            JSON.stringify({
                dependencies: { '@orthacms/media-provider-local': '1' }
            })
        );
        writeFileSync(
            join(root, '.env'),
            'DATABASE_URL=postgresql://u:p@localhost/cms\n'
        );
        process.env = {};
        jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        process.env = saved;
        process.exitCode = undefined;
        rmSync(root, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    it('applies --set values and writes them, without asking anything', async () => {
        await setupCommand(root, {
            yes: true,
            set: ['PUBLIC_URL=https://cms.acme.com', 'TRUST_PROXY=1'],
            production: true,
            skipChecks: true
        });
        const env = readFileSync(join(root, '.env'), 'utf8');
        expect(env).toContain('PUBLIC_URL=https://cms.acme.com');
        expect(env).toContain('NODE_ENV=production');
        expect(process.exitCode).toBeUndefined();
    });

    it('refuses to write a configuration the server would refuse', async () => {
        await setupCommand(root, {
            yes: true,
            set: [],
            production: true,
            skipChecks: true
        });
        expect(process.exitCode).toBe(1);
        expect(readFileSync(join(root, '.env'), 'utf8')).not.toContain(
            'NODE_ENV'
        );
    });
});
