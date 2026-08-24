import {
    createFakeSsoProvider,
    type FakeSsoProvider
} from '@orthacms/identity-provider-fake';

/** The scripted people the e2e identity provider can sign in. */
export const SSO_SUBJECTS = {
    /** Matches a seeded, active account by verified email. */
    linked: 'idp-subject-linked',
    /** Matches a seeded account, but the provider will not vouch for the address. */
    unverified: 'idp-subject-unverified',
    /** Verified, but no Ortha account holds the address. */
    stranger: 'idp-subject-stranger'
} as const;

/** The addresses those subjects report. Suites seed accounts against them. */
export const SSO_EMAILS = {
    linked: 'sso-linked@example.com',
    unverified: 'sso-unverified@example.com',
    stranger: 'sso-stranger@example.com'
} as const;

/**
 * The identity provider the e2e app boots with — scripted, offline, and a real
 * verifier (it signs its own responses, so tampering is refused by code rather
 * than by assumption).
 *
 * Constructed at module scope and shared, like the copilot's fake model
 * providers, because `buildTestPlugins` needs the same instance a suite drives
 * with `signInAs`.
 */
export const fakeSsoProvider: FakeSsoProvider = createFakeSsoProvider({
    label: 'Fake IdP',
    users: [
        {
            subject: SSO_SUBJECTS.linked,
            email: SSO_EMAILS.linked,
            name: 'SSO Linked'
        },
        {
            subject: SSO_SUBJECTS.unverified,
            email: SSO_EMAILS.unverified,
            emailVerified: false,
            name: 'SSO Unverified'
        },
        {
            subject: SSO_SUBJECTS.stranger,
            email: SSO_EMAILS.stranger,
            name: 'SSO Stranger'
        }
    ]
});
