import { defineMessages, useIntl } from 'react-intl';
import { Button } from '@orthacms/design-system';
import { useSsoProviders } from '../../../application/useSsoProviders';
import { KeyIcon } from '../AuthIcons';

/** Intl descriptors for {@link SsoProviders}, co-located with the component. */
const messages = defineMessages({
    separator: {
        id: 'identity.login.sso.separator',
        defaultMessage: 'or with email'
    },
    continueWith: {
        id: 'identity.login.sso.continueWith',
        defaultMessage: 'Continue with {provider}'
    },
    acceptWith: {
        id: 'identity.acceptInvite.sso.acceptWith',
        defaultMessage: 'Accept with {provider}'
    }
});

/** Props for {@link SsoProviders}. */
type SsoProvidersProps = {
    /**
     * Where to land after signing in — the location the gate was aiming at.
     * Carried through the handshake in the attempt row, and validated
     * server-side as a same-origin path, so a value from the router's state
     * cannot become an off-site redirect.
     */
    redirectTo?: string;
    /**
     * The raw invite token, when this is the accept-invitation screen rather
     * than the sign-in one. It turns the handshake into invite acceptance: the
     * server redeems the invite and activates the account with **no password**,
     * so the identity provider becomes the only way in — which is what the
     * person chose by using this button.
     *
     * The server checks that the address the provider vouches for is the one
     * that was invited, so this cannot be used to claim someone else's
     * invitation.
     */
    inviteToken?: string;
    /** The separator's text, which differs between the two screens. */
    separatorLabel?: string;
    /**
     * Which side of the buttons the separator goes on. `after` on sign-in,
     * where single sign-on **leads** and the password form follows ("or with
     * email"); `before` on the invitation, where the password form is the
     * main path and a provider is the alternative ("or").
     */
    separatorPosition?: 'before' | 'after';
};

/** The "— or with email —" rule between the two ways in. */
function OrLine({ label }: { label: string }) {
    return (
        <div
            data-slot="sso-separator"
            className="flex items-center gap-2.5 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border"
        >
            {label}
        </div>
    );
}

/**
 * The single sign-on block: one button per registered identity provider, and
 * the "or" rule that separates it from the password form.
 *
 * **Single sign-on leads on the sign-in screen** (the R7 redesign): where a
 * deployment has a provider, it is how most people are expected to come in, so
 * its buttons come first in reading and tab order and the password form
 * follows under "or with email". On the invitation they follow the password
 * form instead, under "or".
 *
 * **These are links, not buttons with click handlers.** Signing in through a
 * provider is a full-page navigation to `/api/auth/sso/:name/start`, which
 * answers `302`. An anchor is what a navigation is, so middle-click and
 * open-in-new-tab behave, and no JavaScript stands between the person and the
 * redirect. They are styled as buttons because that is what they are *for*;
 * `Button asChild` is the design system's own way to say so.
 *
 * **It renders nothing at all** when the deployment registers no providers,
 * when the list is still loading, or when the request failed. The password form
 * is the sign-in page; this is an addition to it. Showing a spinner would make
 * every visitor wait on a feature most deployments do not use, and showing an
 * error would hand someone a problem they cannot act on while they are trying
 * to sign in a way that still works.
 */
export function SsoProviders({
    redirectTo,
    inviteToken,
    separatorLabel,
    separatorPosition = 'after'
}: SsoProvidersProps) {
    const intl = useIntl();
    const { data: providers } = useSsoProviders();

    if (!providers || providers.length === 0) {
        return null;
    }

    const separator = (
        <OrLine
            label={separatorLabel ?? intl.formatMessage(messages.separator)}
        />
    );

    return (
        <>
            {separatorPosition === 'before' && separator}
            <div className="flex flex-col gap-3">
                {providers.map((provider) => (
                    <Button
                        key={provider.name}
                        asChild
                        variant="outline"
                        className="h-9 w-full"
                    >
                        <a
                            href={startUrl(
                                provider.name,
                                redirectTo,
                                inviteToken
                            )}
                        >
                            <KeyIcon />
                            {intl.formatMessage(
                                inviteToken
                                    ? messages.acceptWith
                                    : messages.continueWith,
                                { provider: provider.label }
                            )}
                        </a>
                    </Button>
                ))}
            </div>
            {separatorPosition === 'after' && separator}
        </>
    );
}

/**
 * The sign-in URL for one provider.
 *
 * Same-origin and absolute-from-root, so it works under the dev proxy
 * (`/api` → the API) and in a deployment serving both from one host — the same
 * assumption `apiClient` already makes. The provider name is encoded because it
 * is a path segment, even though the server refuses to register a name that
 * would need encoding; belt and braces cost nothing here, and the guard lives
 * in a different package.
 */
function startUrl(
    name: string,
    redirectTo?: string,
    inviteToken?: string
): string {
    const url = new URLSearchParams();
    if (redirectTo && redirectTo !== '/') {
        url.set('redirect', redirectTo);
    }
    if (inviteToken) {
        url.set('invite', inviteToken);
    }
    const query = url.toString();
    const path = `/api/auth/sso/${encodeURIComponent(name)}/start`;
    return query ? `${path}?${query}` : path;
}
