import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { Button, cn } from '@orthacms/design-system';
import { ArrowLeftIcon } from '../AuthIcons';

/** Intl descriptors for {@link BackToSignIn}, co-located with the component. */
const messages = defineMessages({
    back: {
        id: 'identity.backToSignIn',
        defaultMessage: 'Back to sign in'
    },
    goTo: {
        id: 'identity.goToSignIn',
        defaultMessage: 'Go to sign in'
    }
});

/** Props for {@link BackToSignIn}. */
type BackToSignInProps = {
    /**
     * `back` ("← Back to sign in") from a screen the person reached from the
     * sign-in form; `goTo` ("Go to sign in") from one they reached by a link.
     */
    wording?: 'back' | 'goTo';
    /** `outline` by default; `primary` when it is the screen's main action. */
    variant?: 'outline' | 'primary';
    /** Extra classes. */
    className?: string;
};

/**
 * The way out of every public auth screen that is not the sign-in form itself.
 * A link, because it is a navigation: it opens in a new tab, and it needs no
 * script to work.
 */
export function BackToSignIn({
    wording = 'goTo',
    variant = 'outline',
    className
}: BackToSignInProps) {
    const intl = useIntl();
    return (
        <Button
            asChild
            variant={variant === 'primary' ? 'default' : 'outline'}
            className={cn('h-9 w-full', className)}
        >
            <Link to="/identity/signin">
                {wording === 'back' && <ArrowLeftIcon />}
                {intl.formatMessage(
                    wording === 'back' ? messages.back : messages.goTo
                )}
            </Link>
        </Button>
    );
}
