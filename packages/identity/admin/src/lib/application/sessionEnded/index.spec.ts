import { describe, expect, it } from 'vitest';
import { markSessionEnded, takeSessionEnded } from './index';

/**
 * The one-shot flag that tells the sign-in page *why* the visitor arrived:
 * because the session they had was ended underneath them, rather than because
 * they signed out or opened a bookmark in a fresh tab.
 *
 * Both halves of "one-shot" are load bearing. It has to survive the trip across
 * the auth boundary (module scope, because the two sides cannot share React
 * state), and it has to be consumed on the first read — `LoginPage` reads it
 * from an effect, which `StrictMode` invokes twice in development, so a flag
 * that stayed raised would either be re-latched forever or, once cleared on a
 * later visit, tell an ordinary visitor a lie about a session they never had.
 *
 * The state is module-global by design; every test here leaves it lowered,
 * which is what keeps them independent of each other's order.
 */
describe('sessionEnded', () => {
    it('reports nothing on a tab whose session was never marked as ended', () => {
        expect(takeSessionEnded()).toBe(false);
    });

    it('reports the loss once and then forgets it', () => {
        markSessionEnded();

        // The first read is the sign-in page explaining what happened…
        expect(takeSessionEnded()).toBe(true);
        // …and the second is StrictMode running the same effect again, which
        // must not see a session ending that has already been accounted for.
        expect(takeSessionEnded()).toBe(false);
    });

    it('stays a single signal no matter how many times it is raised', () => {
        markSessionEnded();
        markSessionEnded();

        expect(takeSessionEnded()).toBe(true);
        expect(takeSessionEnded()).toBe(false);
    });
});
