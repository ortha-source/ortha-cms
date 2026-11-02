import type { SetupCheck } from '@orthacms/config';

import {
    anthropicCheck,
    databaseCheck,
    localStorageCheck,
    oidcCheck,
    openAiCheck,
    runChecks,
    s3Check,
    samlCertificateCheck,
    smtpCheck,
    type LiveCheck
} from '../doctor/checks';
import {
    anthropicFromEnv,
    mailFromEnv,
    oidcFromEnv,
    openAiFromEnv,
    samlFromEnv
} from '@orthacms/config';
import type { CheckOutcome, EnvValues } from './engine';

/**
 * Runs one of `doctor`'s live checks against values that are not in the
 * environment yet: the answers so far are swapped in for the duration, so
 * the check reads them through the same builders the server will.
 */
export async function runSetupCheck(
    root: string,
    check: SetupCheck,
    values: EnvValues,
    workspace: boolean
): Promise<CheckOutcome> {
    const saved = process.env;
    process.env = Object.fromEntries(
        Object.entries({ ...saved, ...values }).filter(
            ([, value]) => value !== undefined
        )
    ) as NodeJS.ProcessEnv;
    try {
        const live = build(root, check, values, workspace);
        if (!live) {
            return { ok: true, detail: 'nothing configured to check' };
        }
        const [result] = await runChecks([live]);
        return { ok: result?.ok ?? false, detail: result?.detail ?? '' };
    } catch (error) {
        return {
            ok: false,
            detail: error instanceof Error ? error.message : String(error)
        };
    } finally {
        process.env = saved;
    }
}

/** The live check a step names, or nothing when its feature is unconfigured. */
function build(
    root: string,
    check: SetupCheck,
    values: EnvValues,
    workspace: boolean
): LiveCheck | undefined {
    switch (check) {
        case 'database':
            return values['DATABASE_URL']
                ? databaseCheck(values['DATABASE_URL'])
                : undefined;
        case 'storage-local':
            return localStorageCheck(root);
        case 'storage-s3':
            return s3Check(root);
        case 'mail': {
            const mail = mailFromEnv(
                workspace ? ['smtp', 'console'] : ['smtp']
            );
            return mail ? smtpCheck(root, mail) : undefined;
        }
        case 'oidc': {
            const oidc = oidcFromEnv();
            return oidc ? oidcCheck(oidc.issuer) : undefined;
        }
        case 'saml': {
            const saml = samlFromEnv();
            return saml ? samlCertificateCheck(saml.idpCert) : undefined;
        }
        case 'anthropic': {
            const claude = anthropicFromEnv();
            return claude
                ? anthropicCheck(claude.apiKey, claude.baseUrl)
                : undefined;
        }
        case 'openai': {
            const openai = openAiFromEnv();
            return openai
                ? openAiCheck(openai.baseUrl, openai.apiKey)
                : undefined;
        }
    }
}
