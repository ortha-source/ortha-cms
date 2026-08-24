export { IdentityPlugin } from './lib/presentation/identityPlugin';
export type { IdentityAdminPlugin } from './lib/presentation/identityPlugin';
export { IdentityRouter } from './lib/presentation/router';
export { LoginForm } from './lib/presentation/components/LoginForm';
export { AcceptInviteForm } from './lib/presentation/components/AcceptInviteForm';
export type { AcceptInviteFormValues } from './lib/presentation/components/AcceptInviteForm';
export { ResetPasswordForm } from './lib/presentation/components/ResetPasswordForm';
export type { ResetPasswordFormValues } from './lib/presentation/components/ResetPasswordForm';
export { AuthLayout } from './lib/presentation/components/AuthLayout';
// The single-sign-on block from the sign-in card, and the hook behind it.
// Exported so another surface that offers a sign-in (a re-auth prompt, a
// future account-linking screen) renders the same buttons rather than
// rebuilding the URL convention.
export { SsoProviders } from './lib/presentation/components/SsoProviders';
export { useSsoProviders } from './lib/application/useSsoProviders';
export {
    PASSWORD_MIN_LENGTH,
    PASSWORD_MAX_BYTES,
    passwordByteLength
} from './lib/domain/value-objects/password';
export { AuthProvider } from './lib/presentation/auth/AuthProvider';
export { RequireAuth } from './lib/presentation/auth/RequireAuth';
export {
    useAuth,
    useHasPermission,
    AuthStatus
} from './lib/presentation/auth/authContext';
export type { AuthState, AuthUser } from './lib/presentation/auth/authContext';
export { useLogoutMutation } from './lib/application/useLogoutMutation';
export type {
    LoginCredentials,
    AuthTokens,
    CurrentUser,
    InviteDetails,
    AcceptInviteInput,
    PasswordResetDetails,
    ResetPasswordInput,
    SsoProviderSummary
} from './types/auth';
