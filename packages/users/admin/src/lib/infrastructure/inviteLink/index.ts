/**
 * The admin route that redeems an invite. Owned by `@orthacms/identity-admin`
 * (its router mounts `accept-invite` under `/identity`); repeated here because
 * a path string is not worth a package dependency, and the e2e suites assert
 * the built link so a drift would fail loudly.
 */
const ACCEPT_INVITE_PATH = '/identity/accept-invite';

/**
 * Builds the invite link an admin hands to an invitee, from the raw token the
 * API returned once.
 *
 * The origin comes from the browser rather than server config on purpose: the
 * admin is *already* looking at the app on the URL the invitee should use, so
 * `window.location.origin` is right by construction — no `publicBaseUrl` to
 * misconfigure, and no host header to poison. A mailed invitation's link is
 * built server-side from the mail plugin's configured `appUrl`; this is
 * only ever the copy-it-yourself path.
 */
export function inviteLinkFor(token: string): string {
    const url = new URL(ACCEPT_INVITE_PATH, window.location.origin);
    url.searchParams.set('token', token);
    return url.toString();
}
