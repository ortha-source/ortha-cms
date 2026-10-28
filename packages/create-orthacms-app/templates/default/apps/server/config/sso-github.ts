// orthacms:if sso-github
import type { GithubProviderConfig } from '@orthacms/identity-provider-github';
import { githubFromEnv } from '@orthacms/config';

/**
 * The GitHub provider, or nothing until both credentials are set — the secret
 * is not optional: GitHub has no PKCE, so it is the only thing proving the
 * code is redeemed by this application.
 *
 * The name, the label and `organization` (which only shapes GitHub's account
 * chooser — who gets in is this CMS's decision) are code, beside it.
 */
export function githubProvider():
    | (GithubProviderConfig & { name: string })
    | undefined {
    const settings = githubFromEnv();
    return settings && { name: 'github', ...settings };
}
// orthacms:end
