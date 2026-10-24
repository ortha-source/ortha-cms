import { useQuery } from '@tanstack/react-query';
import { STALE_TIME, type ApiError } from '@orthacms/utils-admin';
import { httpAuthGateway } from '../../infrastructure/httpAuthGateway';

/** Query key for whether the deployment sends password-recovery mail. */
export const passwordRecoveryKey = ['auth', 'password-recovery'] as const;

/**
 * Whether this deployment sends password-recovery mail
 * (`GET /api/auth/password-recovery`), which decides what the "Forgot it?"
 * screen is: a form that sends a link, or the card that says who can make one.
 *
 * A property of the deployment, fixed until an operator redeploys, so it is
 * cached for the life of the page. One retry covers a blip; past that the page
 * falls back to the "ask an admin" card, which is true on every deployment.
 */
export function usePasswordRecoveryAvailability() {
    return useQuery<boolean, ApiError>({
        queryKey: passwordRecoveryKey,
        queryFn: () => httpAuthGateway.passwordRecoveryAvailable(),
        retry: 1,
        staleTime: STALE_TIME.Forever
    });
}
