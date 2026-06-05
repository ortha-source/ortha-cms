import { LoginPage } from '.';
import type { LoginCredentials } from '../../../types/auth.type';

/**
 * Route container for the sign-in page. Owns the submission seam: today it
 * renders the presentation-only {@link LoginPage} with a placeholder handler.
 * #8 wires `useLoginMutation` here and feeds `onSubmit`/`isPending`/`error`.
 */
export function SignInRoute() {
    const handleSubmit = (credentials: LoginCredentials) => {
        // TODO(#8): call useLoginMutation here and drive isPending/error.
        console.warn('Login submitted (not wired yet):', credentials.email);
    };

    return <LoginPage onSubmit={handleSubmit} />;
}
