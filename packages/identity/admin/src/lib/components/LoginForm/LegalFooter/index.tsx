import { defineMessages, useIntl } from 'react-intl';
import { FieldDescription } from '@ortha-cms/design-system';

/** Intl descriptors for {@link LegalFooter}, co-located with the component. */
const messages = defineMessages({
    legalFooter: {
        id: 'identity.login.legalFooter',
        defaultMessage:
            'By clicking continue, you agree to our <terms>Terms of Service</terms> and <privacy>Privacy Policy</privacy>.'
    }
});

/** Legal disclaimer with links to the terms of service and privacy policy. */
export function LegalFooter() {
    const intl = useIntl();

    return (
        <FieldDescription className="px-6 text-center">
            {intl.formatMessage(messages.legalFooter, {
                // TODO(#8): wire to the real terms/privacy routes
                terms: (chunks) => (
                    <button type="button" key="terms">
                        {chunks}
                    </button>
                ),
                privacy: (chunks) => (
                    <button type="button" key="privacy">
                        {chunks}
                    </button>
                )
            })}
        </FieldDescription>
    );
}
