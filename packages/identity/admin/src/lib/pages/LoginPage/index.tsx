import { AuthLayout } from '../../components/AuthLayout';
import { LoginForm } from '../../components/LoginForm';
import type { LoginCredentials } from '../../../types/auth.type';

/**
 * Props for the {@link LoginPage} component.
 */
type LoginPageProps = {
    /** Called when the login form is submitted. UI-only until #8 wires auth. */
    onSubmit?: (credentials: LoginCredentials) => void;
    /** Whether a submission is in flight. */
    isPending?: boolean;
    /** Error message to surface, if any. */
    error?: string;
};

/**
 * Login page. Uses the shared {@link AuthLayout} with a {@link LoginForm}.
 */
export function LoginPage({ onSubmit, isPending, error }: LoginPageProps) {
    return (
        <AuthLayout>
            <LoginForm onSubmit={onSubmit} isPending={isPending} error={error} />
        </AuthLayout>
    );
}
