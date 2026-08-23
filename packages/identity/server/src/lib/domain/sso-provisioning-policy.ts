/**
 * Whether an address is inside the set of email domains a deployment allows
 * just-in-time provisioning for.
 *
 * **The allow-list is why this function exists rather than a boolean.** An
 * identity provider answers for everyone it knows, and a public one — Google
 * most obviously — knows everyone. "Create an account on first sign-in" without
 * a domain restriction means every Google account on earth can sign in to this
 * CMS, and the failure is silent: nothing breaks, the user list simply grows.
 * So the list is required by configuration, and this is the check.
 *
 * Matching is case-insensitive, exact on the domain, and deliberately **not**
 * suffix-based: `acme.com` must not admit `evil-acme.com`, and a naive
 * `endsWith` does exactly that. A subdomain is a different domain and has to be
 * listed on its own.
 */
export function isProvisionableEmail(
    email: string,
    allowedDomains: readonly string[]
): boolean {
    const at = email.lastIndexOf('@');
    if (at <= 0 || at === email.length - 1) {
        return false;
    }
    const domain = email.slice(at + 1).toLowerCase();
    return allowedDomains.some(
        (allowed) => allowed.trim().toLowerCase() === domain
    );
}

/**
 * Checks an operator's domain list at construction time, so a list that can
 * never match is a boot failure rather than a directory that mysteriously
 * cannot sign anybody in.
 *
 * @throws When the list is empty, or an entry is blank, carries an `@`, or is
 *   a URL. Each is a plausible mistake — `@acme.com`, `https://acme.com`,
 *   `acme.com, ` — and each produces a list that silently matches nothing.
 */
export function assertProvisionableDomains(domains: readonly string[]): void {
    if (domains.length === 0) {
        throw new Error(
            'SSO just-in-time provisioning needs at least one email domain. An identity provider answers for everyone it knows — a public one knows everyone — so provisioning with no domain restriction means anyone with an account there can sign in to this CMS.'
        );
    }
    for (const domain of domains) {
        const value = domain.trim();
        if (!value) {
            throw new Error(
                'SSO provisioning domains must not be blank — a stray comma in the list matches nothing and is invisible in a config file.'
            );
        }
        if (value.includes('@') || value.includes('/') || value.includes(':')) {
            throw new Error(
                `SSO provisioning domain "${domain}" should be a bare domain like "acme.com" — not an address, and not a URL. As written it can never match an email's domain.`
            );
        }
    }
}
