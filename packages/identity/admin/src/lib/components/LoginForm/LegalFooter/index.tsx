import { defineMessages, useIntl } from 'react-intl';
import { FieldDescription } from '@ortha-cms/design-system';

/** Intl descriptors for {@link LegalFooter}, co-located with the component. */
const messages = defineMessages({
    legalFooter: {
        id: 'identity.login.legalFooter',
        defaultMessage:
            'By clicking continue, you agree to our {termsLink} and {privacyLink}.'
    },
    termsOfService: {
        id: 'identity.login.termsOfService',
        defaultMessage: 'Terms of Service'
    },
    privacyPolicy: {
        id: 'identity.login.privacyPolicy',
        defaultMessage: 'Privacy Policy'
    }
});

/** Legal disclaimer with links to the terms of service and privacy policy. */
export function LegalFooter() {
    const intl = useIntl();

    return (
        <FieldDescription className="px-6 text-center">
            {intl.formatMessage(messages.legalFooter, {
                termsLink: (
                    <a key="terms" href="#">
                        {intl.formatMessage(messages.termsOfService)}
                    </a>
                ),
                privacyLink: (
                    <a key="privacy" href="#">
                        {intl.formatMessage(messages.privacyPolicy)}
                    </a>
                )
            })}
        </FieldDescription>
    );
}
