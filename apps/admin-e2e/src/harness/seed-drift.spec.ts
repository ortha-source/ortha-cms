import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

/**
 * The one place this suite is allowed to look at app source — and it looks at
 * the **text**, never the module.
 *
 * The harness hard-codes a copy of the server's permission catalogue
 * (`ALL_PERMISSIONS` in `support/api/auth.ts`), because `GET /api/auth/me` is
 * mocked and something has to say what an admin holds. A key added on the server
 * and not here does not fail anything: it simply means the signed-in admin every
 * suite uses silently lacks it, so the UI behind it renders "no access" — or
 * does not render at all — and no spec was ever able to see the page.
 *
 * That is not hypothetical. `tokens:read` / `tokens:create` / `tokens:delete`
 * were missing for the life of the `/api-tokens` page, which is why that page
 * shipped with **zero** e2e coverage: it was invisible to every suite that had
 * ever run. `copilot:use` was missing too, and took the whole copilot surface
 * with it — the sidebar switcher, the dock and the Agents view all answered
 * "No access" to a mock claiming to hold every permission.
 *
 * A black-box suite cannot import `PERMISSIONS`, and the catalogue is not on any
 * wire the browser can reach. Reading the constant out of the file is the only
 * mechanism left, and a brittle regex that fails loudly beats a blind spot that
 * fails silently — the failure mode this whole file exists to prevent.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');
const SERVER_CATALOGUE = join(
    REPO_ROOT,
    'packages/identity/server/src/lib/rbac/system-roles.ts'
);
const HARNESS_SEED = join(__dirname, '..', 'support', 'api', 'auth.ts');

/** Strip comments, so a permission key quoted in prose is not read as one. */
function code(path: string): string {
    return readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '');
}

/** The single-quoted strings inside the first block `pattern` captures. */
function keysIn(path: string, pattern: RegExp): string[] {
    const block = code(path).match(pattern);
    if (!block) {
        throw new Error(
            `Could not find the declaration this check reads in ${path}. ` +
                `It was renamed or moved — update the pattern here rather than ` +
                `deleting the check; it guards a whole class of invisible page.`
        );
    }
    return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

test.describe('harness seed drift', () => {
    test('the signed-in mock grants exactly the server permission catalogue', () => {
        const server = keysIn(
            SERVER_CATALOGUE,
            /export const PERMISSIONS = \{([\s\S]*?)\} as const;/
        );
        const harness = keysIn(
            HARNESS_SEED,
            /const ALL_PERMISSIONS = \[([\s\S]*?)\];/
        );

        // Guard against the check itself passing for the wrong reason: two empty
        // sets are equal, and a regex that stopped matching would give exactly
        // that.
        expect(server.length).toBeGreaterThan(20);

        expect(
            harness,
            'ALL_PERMISSIONS in support/api/auth.ts has drifted from PERMISSIONS ' +
                'in identity-server. Any key only on the server side is one the ' +
                'suite\'s "admin holding everything" does not hold, so the UI ' +
                'behind it is invisible to every spec.'
        ).toEqual(server);
    });
});
