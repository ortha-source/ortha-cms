import { defineMessages, useIntl } from 'react-intl';
import { AuthLayout } from '../AuthLayout';
import { AuthCardSkeleton } from '../AuthCardSkeleton';

/** Intl descriptors for {@link LoginSkeleton}, co-located with the component. */
const messages = defineMessages({
    loading: {
        id: 'identity.login.skeleton.loading',
        defaultMessage: 'Loading…'
    },
    heading: {
        id: 'identity.login.skeleton.heading',
        defaultMessage: 'Sign in'
    }
});

/**
 * Lazy-route `Suspense` fallback for the public auth screens. Reuses
 * {@link AuthLayout} (the same centred column with the brand mark) and sketches
 * the sign-in card, so the chunk load doesn't flash an empty page. The page's
 * `<h1>` is visually hidden and not focused (`ORT-167`): `AuthLayout` skips the
 * focus move for a skeleton that is about to be replaced.
 */
export function LoginSkeleton() {
    const intl = useIntl();

    return (
        <AuthLayout surface="chunk-loading" focusHeading={false}>
            <AuthCardSkeleton
                heading={intl.formatMessage(messages.heading)}
                status={intl.formatMessage(messages.loading)}
            />
        </AuthLayout>
    );
}
