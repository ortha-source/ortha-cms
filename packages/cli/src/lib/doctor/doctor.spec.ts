import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { envSpec } from '@orthacms/config';

import { diagnose, installedFeatures } from '../commands/doctor';
import {
    anthropicCheck,
    oidcCheck,
    openAiCheck,
    runChecks,
    samlCertificateCheck
} from './checks';
import { failed, formatReport, reportJson, type DoctorReport } from './report';

/** A response `fetch` would give, for a check that reads JSON. */
function answer(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status });
}

describe('orthacms doctor', () => {
    const saved = process.env;
    let root: string;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'orthacms-doctor-'));
        writeFileSync(
            join(root, 'package.json'),
            JSON.stringify({
                dependencies: {
                    '@orthacms/media-provider-local': '1.0.0',
                    '@orthacms/identity-provider-oidc': '1.0.0'
                }
            })
        );
        process.env = { DATABASE_URL: 'postgresql://u:secret@db/cms' };
    });

    afterEach(() => {
        process.env = saved;
        rmSync(root, { recursive: true, force: true });
        jest.restoreAllMocks();
    });

    it('reads what the app installed from its manifest', () => {
        expect([...installedFeatures(root)].sort()).toEqual([
            'media-local',
            'sso',
            'sso-oidc'
        ]);
    });

    it('treats a workspace as this repository, which installs everything', () => {
        writeFileSync(
            join(root, 'package.json'),
            JSON.stringify({ workspaces: ['packages/*'] })
        );
        expect(installedFeatures(root).has('workspace')).toBe(true);
    });

    it('offline, reports values and problems without connecting to anything', async () => {
        process.env['COPILOT_ENABLED'] = 'true';
        const report = await diagnose(root, { offline: true });
        expect(report.checks).toEqual([]);
        expect(failed(report)).toBe(true);
        const text = formatReport(report, { color: false, all: false });
        expect(text).toContain('postgresql://u:•••@db/cms');
        expect(text).not.toContain('secret');
        expect(text).toContain('no backend is configured');
        expect(text).toMatch(/1 problem, \d+ warnings?/);
    });

    it('never puts a secret in the JSON report', async () => {
        process.env['SSO_OIDC_ISSUER'] = 'https://idp.example.com';
        process.env['SSO_OIDC_CLIENT_ID'] = 'id';
        process.env['SSO_OIDC_CLIENT_SECRET'] = 'very-secret-value';
        const json = reportJson(await diagnose(root, { offline: true }));
        expect(json).not.toContain('very-secret-value');
        expect(JSON.parse(json).variables).toContainEqual(
            expect.objectContaining({
                name: 'SSO_OIDC_CLIENT_SECRET',
                value: '•••alue'
            })
        );
    });
});

describe('the live checks', () => {
    afterEach(() => jest.restoreAllMocks());

    it('turns a throw into a failed result rather than an exception', async () => {
        const [result] = await runChecks([
            { name: 'Broken', run: () => Promise.reject(new Error('refused')) }
        ]);
        expect(result).toEqual({
            name: 'Broken',
            ok: false,
            detail: 'refused'
        });
    });

    it('compares the OIDC issuer byte for byte', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue(
            answer({ issuer: 'https://idp.example.com/' })
        );
        await expect(
            oidcCheck('https://idp.example.com').run()
        ).rejects.toThrow('trailing slash included');
    });

    it('sends the key and version header to Anthropic, and counts the models', async () => {
        const fetch = jest
            .spyOn(global, 'fetch')
            .mockResolvedValue(answer({ data: [{ id: 'a' }, { id: 'b' }] }));
        await expect(anthropicCheck('sk-key').run()).resolves.toBe(
            'key works · 2 models available'
        );
        expect(fetch).toHaveBeenCalledWith(
            'https://api.anthropic.com/v1/models',
            expect.objectContaining({
                headers: {
                    'x-api-key': 'sk-key',
                    'anthropic-version': '2023-06-01'
                }
            })
        );
    });

    it('fails an OpenAI-compatible endpoint that serves no models', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue(answer({ data: [] }));
        await expect(
            openAiCheck('http://localhost:11434/v1', '').run()
        ).rejects.toThrow('serves no models');
    });

    it('names the status of an endpoint that refuses', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue(answer({}, 401));
        await expect(anthropicCheck('sk-bad').run()).rejects.toThrow(
            'answered 401'
        );
    });

    it('refuses a SAML certificate it cannot parse', async () => {
        await expect(
            samlCertificateCheck('not a certificate').run()
        ).rejects.toThrow();
    });
});

describe('the report', () => {
    it('lists a required variable even when it is unset', () => {
        const report: DoctorReport = {
            entries: [{ spec: envSpec('DATABASE_URL'), source: 'unset' }],
            findings: [],
            checks: []
        };
        expect(formatReport(report, { color: false, all: false })).toContain(
            'DATABASE_URL'
        );
    });
});
