import { WORKSPACE_FEATURES } from './generated';
import {
    featuresFromDependencies,
    inspectEnvironment,
    maskValue
} from './inspect';
import { envSpec } from './catalog';

describe('inspectEnvironment', () => {
    const base = { DATABASE_URL: 'postgresql://u:p@db/cms' };

    it('says where each value came from', () => {
        const { entries } = inspectEnvironment({
            env: {
                ...base,
                APP_URL: 'https://cms.example.com',
                ANTHROPIC_API_KEY_FILE: '/run/secrets/anthropic'
            },
            features: WORKSPACE_FEATURES
        });
        const source = (name: string) =>
            entries.find((entry) => entry.spec.name === name);
        expect(source('DATABASE_URL')).toMatchObject({
            source: 'env',
            value: 'postgresql://u:•••@db/cms'
        });
        expect(source('PUBLIC_URL')).toMatchObject({
            source: 'renamed',
            from: 'APP_URL'
        });
        expect(source('ANTHROPIC_API_KEY')).toMatchObject({
            source: 'file',
            from: '/run/secrets/anthropic'
        });
        expect(source('PORT')).toMatchObject({
            source: 'default',
            value: '3000'
        });
        expect(source('MEDIA_S3_BUCKET')).toBeUndefined();
    });

    it('reports the refusal the server would give, without throwing', () => {
        const { findings } = inspectEnvironment({
            env: { ...base, COPILOT_ENABLED: 'yes', LOGIN_RATE_LIMIT: '3' },
            features: WORKSPACE_FEATURES
        });
        const messages = findings.map((finding) => finding.message).join('\n');
        expect(messages).toContain('COPILOT_ENABLED must be true or false');
        expect(messages).toContain('LOGIN_RATE_LIMIT=3');
    });

    it('catches what boots but is wrong in production', () => {
        const { findings } = inspectEnvironment({
            env: {
                ...base,
                NODE_ENV: 'production',
                PUBLIC_URL: 'http://cms.example.com',
                MAIL_URL: 'console://',
                MAIL_FROM: 'CMS <cms@example.com>',
                MAIL_REVEAL_LINKS: 'true',
                COPILOT_ENABLED: 'true'
            },
            features: WORKSPACE_FEATURES
        });
        const errors = findings.filter((f) => f.level === 'error');
        const warnings = findings.filter((f) => f.level === 'warning');
        expect(errors.map((f) => f.message).join('\n')).toMatch(
            /console:\/\/ in production[\s\S]*no backend is configured|no backend is configured[\s\S]*console:\/\/ in production/
        );
        expect(warnings.map((f) => f.message).join('\n')).toContain(
            'plain http://'
        );
        expect(warnings.map((f) => f.message).join('\n')).toContain(
            'TRUST_PROXY is unset'
        );
    });

    it('leaves process.env as it found it', () => {
        const before = process.env;
        inspectEnvironment({ env: { NODE_ENV: 'produciton' } });
        expect(process.env).toBe(before);
    });
});

describe('featuresFromDependencies', () => {
    it('maps installed packages to scaffolder features', () => {
        expect(
            [
                ...featuresFromDependencies({
                    '@orthacms/media-provider-s3': '1.0.0',
                    '@orthacms/identity-provider-saml': '1.0.0',
                    '@orthacms/mail-server': '1.0.0',
                    '@orthacms/mail-provider-smtp': '1.0.0'
                })
            ].sort()
        ).toEqual(['mail', 'mail-smtp', 'media-s3', 'sso', 'sso-saml']);
    });
});

describe('maskValue', () => {
    it('keeps a URL but its password, and the last four of any other secret', () => {
        expect(
            maskValue(
                envSpec('MAIL_URL'),
                'smtp://apikey:hunter2@smtp.example.com:587'
            )
        ).toBe('smtp://apikey:•••@smtp.example.com:587');
        expect(
            maskValue(envSpec('ANTHROPIC_API_KEY'), 'sk-ant-0123456789')
        ).toBe('•••6789');
        expect(maskValue(envSpec('PORT'), '3000')).toBe('3000');
    });
});
