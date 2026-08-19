/**
 * The one-shot signal that this tab's session was ended **for** the visitor —
 * revoked from another device, expired, or the account suspended — rather than
 * by them signing out or arriving signed-out.
 *
 * It exists because the two halves of that event live on opposite sides of the
 * auth boundary and cannot share React state. `AuthProvider` learns the fact
 * (it installs the transport's `401` handler and holds the cached user that
 * proves someone *was* signed in) and it wraps the **private** tree only; the
 * sign-in page, which has to explain what happened, renders outside it. Router
 * state would be the idiomatic carrier, but the redirect is issued by
 * `RequireAuth`, which knows only that nobody is signed in *now* — the same
 * state a bookmark opened in a fresh tab produces, and telling that visitor
 * their session ended would be a lie.
 *
 * Deliberately module scope: one tab, one session, and the flag is consumed by
 * the first page that acts on it.
 */
let sessionEnded = false;

/**
 * Record that the open session was ended underneath the visitor.
 *
 * Call this only when someone actually **was** signed in — a `401` on a tab
 * that never had a session is the ordinary signed-out state, not a loss.
 */
export function markSessionEnded(): void {
    sessionEnded = true;
}

/**
 * Read the flag and clear it, so the next arrival at the sign-in page is
 * treated as an ordinary visit.
 *
 * Safe to call from an effect under `StrictMode`'s double invocation: the
 * second call returns `false`, and the caller is expected to latch a `true`
 * rather than assign the result (see `LoginPage`).
 */
export function takeSessionEnded(): boolean {
    const ended = sessionEnded;
    sessionEnded = false;
    return ended;
}
