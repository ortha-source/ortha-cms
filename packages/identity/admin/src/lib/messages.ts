import { defineMessages } from 'react-intl';

/** Intl message descriptors for the identity admin plugin. */
export const messages = defineMessages({
    loginTitle: {
        id: 'identity.login.title',
        defaultMessage: 'Welcome back'
    },
    loginDescription: {
        id: 'identity.login.description',
        defaultMessage: 'Login to your account to continue'
    },
    emailLabel: {
        id: 'identity.login.emailLabel',
        defaultMessage: 'Email'
    },
    emailPlaceholder: {
        id: 'identity.login.emailPlaceholder',
        defaultMessage: 'm@example.com'
    },
    passwordLabel: {
        id: 'identity.login.passwordLabel',
        defaultMessage: 'Password'
    },
    passwordPlaceholder: {
        id: 'identity.login.passwordPlaceholder',
        defaultMessage: '••••••••'
    },
    forgotPassword: {
        id: 'identity.login.forgotPassword',
        defaultMessage: 'Forgot your password?'
    },
    loginButton: {
        id: 'identity.login.button',
        defaultMessage: 'Login'
    },
    loginButtonPending: {
        id: 'identity.login.buttonPending',
        defaultMessage: 'Logging in...'
    },
    authFailedTitle: {
        id: 'identity.login.authFailedTitle',
        defaultMessage: 'Authentication failed'
    },
    noAccount: {
        id: 'identity.login.noAccount',
        defaultMessage: "Don't have an account? {signUpLink}"
    },
    signUp: {
        id: 'identity.login.signUp',
        defaultMessage: 'Sign up'
    },
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
