import { defineMessages, useIntl } from 'react-intl';
import {
    Card,
    CardContent,
    CardHeader,
    Skeleton
} from '@ortha-cms/design-system';
import { AuthLayout } from '../AuthLayout';

/** Intl descriptors for {@link LoginSkeleton}, co-located with the component. */
const messages = defineMessages({
    loading: {
        id: 'identity.login.skeleton.loading',
        defaultMessage: 'Loading…'
    }
});

/**
 * Lazy-route `Suspense` fallback for the sign-in page. Reuses {@link AuthLayout}
 * (the same muted, centered column with the brand mark) and sketches the login
 * card — title, two fields, submit button — so the chunk load doesn't flash an
 * empty centered spinner. A single `role="status"` region announces the busy
 * state; the card is `aria-hidden`.
 */
export function LoginSkeleton() {
    const intl = useIntl();

    return (
        <AuthLayout>
            <div role="status">
                <span className="sr-only">
                    {intl.formatMessage(messages.loading)}
                </span>
                <Card aria-hidden>
                    <CardHeader className="gap-2">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-4 w-56 max-w-full" />
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-20" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-9 w-full" />
                            </div>
                            <Skeleton className="h-9 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AuthLayout>
    );
}
