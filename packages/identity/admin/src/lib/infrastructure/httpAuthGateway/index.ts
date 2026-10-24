import { apiClient, HTTP_STATUS, toApiError } from '@orthacms/utils-admin';
import type {
    AcceptInviteInput,
    CurrentUser,
    InviteDetails,
    LoginCredentials,
    PasswordRecoveryAvailability,
    PasswordResetDetails,
    ResetPasswordInput,
    SsoProviderSummary
} from '../../../types/auth';
import type { AuthGateway } from '../authGateway';

/**
 * HTTP implementation of {@link AuthGateway} over the shared `apiClient` (axios,
 * same-origin, cookie-authed; paths omit the `/api` dev-proxy prefix). Every
 * failure is normalized with `toApiError`, so callers see `ApiError`, never
 * axios internals. The single place `apiClient` is used in this plugin.
 */
export const httpAuthGateway: AuthGateway = {
    async getCurrentUser(): Promise<CurrentUser | null> {
        try {
            const { data } = await apiClient.get<CurrentUser>('/auth/me');
            return data;
        } catch (error) {
            const apiError = toApiError(error);
            if (apiError.status === HTTP_STATUS.UNAUTHORIZED) {
                return null;
            }
            throw apiError;
        }
    },

    async listSsoProviders(): Promise<SsoProviderSummary[]> {
        try {
            const { data } =
                await apiClient.get<SsoProviderSummary[]>('/auth/sso');
            return data;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async login(credentials: LoginCredentials): Promise<void> {
        try {
            await apiClient.post('/auth/login', credentials);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async logout(): Promise<void> {
        try {
            await apiClient.post('/auth/logout');
        } catch (error) {
            throw toApiError(error);
        }
    },

    async describeInvite(token: string): Promise<InviteDetails> {
        try {
            const { data } = await apiClient.get<InviteDetails>(
                `/auth/invite/${encodeURIComponent(token)}`
            );
            return data;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async acceptInvite(input: AcceptInviteInput): Promise<void> {
        try {
            await apiClient.post('/auth/invite/accept', input);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async describePasswordReset(token: string): Promise<PasswordResetDetails> {
        try {
            const { data } = await apiClient.get<PasswordResetDetails>(
                `/auth/reset/${encodeURIComponent(token)}`
            );
            return data;
        } catch (error) {
            throw toApiError(error);
        }
    },

    async resetPassword(input: ResetPasswordInput): Promise<void> {
        try {
            await apiClient.post('/auth/reset', input);
        } catch (error) {
            throw toApiError(error);
        }
    },

    async passwordRecoveryAvailable(): Promise<boolean> {
        try {
            const { data } = await apiClient.get<PasswordRecoveryAvailability>(
                '/auth/password-recovery'
            );
            return data.available === true;
        } catch (error) {
            const apiError = toApiError(error);
            if (apiError.status === HTTP_STATUS.NOT_FOUND) {
                return false;
            }
            throw apiError;
        }
    },

    async requestPasswordRecovery(email: string): Promise<void> {
        try {
            await apiClient.post('/auth/password-recovery', { email });
        } catch (error) {
            throw toApiError(error);
        }
    }
};
