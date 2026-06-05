import type { LoginCredentials } from '../../types/auth.type';

/**
 * Error thrown when a login request does not succeed. `invalidCredentials` is
 * `true` for the server's generic `401` (wrong email/password), and `false` for
 * any other failure (network error, `5xx`, …) so the UI can show a distinct
 * message.
 */
export class LoginError extends Error {
    /** Whether the failure was a `401` (bad credentials) vs. an unexpected error. */
    readonly invalidCredentials: boolean;

    constructor(invalidCredentials: boolean) {
        super(invalidCredentials ? 'Invalid credentials' : 'Login failed');
        this.name = 'LoginError';
        this.invalidCredentials = invalidCredentials;
    }
}

/**
 * Posts credentials to `POST /api/auth/login`. On success the server sets the
 * `httpOnly` `ortha_session` cookie and this resolves with no value — the cookie
 * is the auth state, so nothing is returned. Reached same-origin via the admin
 * dev proxy (`/api` → the API), so the cookie is first-party.
 *
 * @throws {LoginError} `invalidCredentials = true` on a `401`; `false` otherwise.
 */
export async function login(credentials: LoginCredentials): Promise<void> {
    let response: Response;
    try {
        response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(credentials)
        });
    } catch {
        // Network/transport failure — never a credentials problem.
        throw new LoginError(false);
    }

    if (!response.ok) {
        throw new LoginError(response.status === 401);
    }
}
