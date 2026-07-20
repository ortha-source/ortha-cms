export { IdentityPlugin } from './lib/presentation/identityPlugin';
export type { IdentityAdminPlugin } from './lib/presentation/identityPlugin';
export { IdentityRouter } from './lib/presentation/router';
export { LoginForm } from './lib/presentation/components/LoginForm';
export { AuthLayout } from './lib/presentation/components/AuthLayout';
export { AuthProvider } from './lib/presentation/auth/AuthProvider';
export { RequireAuth } from './lib/presentation/auth/RequireAuth';
export {
    useAuth,
    useHasPermission,
    AuthStatus
} from './lib/presentation/auth/authContext';
export type {
    AuthState,
    AuthUser
} from './lib/presentation/auth/authContext';
export { useLogoutMutation } from './lib/application/useLogoutMutation';
export type {
    LoginCredentials,
    AuthTokens,
    CurrentUser
} from './types/auth';
