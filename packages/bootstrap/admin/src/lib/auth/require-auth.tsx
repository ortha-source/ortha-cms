import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

/** Props for {@link RequireAuth}. */
type RequireAuthProps = {
    /** Path to redirect unauthenticated users to. */
    signInPath: string;
    /** The protected subtree (typically the authenticated shell). */
    children: ReactNode;
};

/**
 * Gates its children on authentication. While auth is resolving it renders
 * nothing (so the sign-in page never flashes for a logged-in user); once
 * resolved it either renders the children or redirects to `signInPath`,
 * preserving the attempted location in router state so the sign-in flow can
 * return the user there.
 *
 * The host mounts this once as the element of the pathless parent route that
 * wraps every private route — one check guards the whole authenticated area.
 */
export function RequireAuth({ signInPath, children }: RequireAuthProps) {
    const { status } = useAuth();
    const location = useLocation();

    if (status === 'loading') {
        return null;
    }

    if (status === 'unauthenticated') {
        return <Navigate to={signInPath} replace state={{ from: location }} />;
    }

    return <>{children}</>;
}
