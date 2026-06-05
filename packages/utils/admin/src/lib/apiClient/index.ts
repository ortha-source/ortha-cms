import axios from 'axios';

/**
 * The shared admin HTTP client. Targets the API behind the host's global `/api`
 * prefix (same-origin via the admin dev proxy) and sends credentials so the
 * `httpOnly` session cookie rides along — including cross-origin later, where
 * `withCredentials` becomes necessary.
 *
 * Plugins call this (`apiClient.post('/auth/login', …)`) instead of importing
 * `axios` directly, so base URL, credentials, and future interceptors (e.g. a
 * global `401` → redirect, added with auth gating) live in exactly one place.
 */
export const apiClient = axios.create({
    baseURL: '/api',
    withCredentials: true
});
