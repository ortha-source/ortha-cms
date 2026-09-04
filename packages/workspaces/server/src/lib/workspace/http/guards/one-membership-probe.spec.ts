import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/**
 * "One rule, one probe" — read off the repository rather than argued.
 *
 * `WorkspaceGuard` and `WorkspaceMemberGuard` answer the same question from two
 * places (a header, a path parameter) and both hand the decision to
 * {@link authorizeWorkspaceAccess}. That is the whole of the claim, and it is
 * made of an **absence**: nothing an e2e run can see distinguishes a guard that
 * delegates from one carrying its own copy of the rule — both 403 a non-member
 * today, and the copy is what drifts a release later, silently, on one of the
 * two paths. `route-guards.spec.ts` pins that every route wears a guard;
 * `workspace-access.spec.ts` pins what the shared function decides. Neither can
 * see a second implementation appearing beside them.
 *
 * There is exactly one other caller of the membership probe, and it is
 * deliberate: media's download route derives its workspace from the asset's own
 * row (there is no header to guard on) and answers **404**, because a 403 would
 * confirm that the id exists. It is named here so that adding a second such
 * exception is a decision somebody makes on purpose, in this file, rather than
 * a diff nobody notices.
 *
 * The technique — and the guard-on-the-guard that keeps a walk which found
 * nothing from passing every check below — is `activity/server`'s
 * `package-shape.spec.ts`.
 */

/** The repository root: the nearest ancestor holding `nx.json`. */
const REPO = (() => {
    let dir = __dirname;
    while (!existsSync(join(dir, 'nx.json'))) {
        const parent = dirname(dir);
        if (parent === dir) {
            throw new Error('nx.json not found above ' + __dirname);
        }
        dir = parent;
    }
    return dir;
})();

/** Directory names a source walk never descends into. */
const SKIP_DIRS = new Set([
    'node_modules',
    'dist',
    'out-tsc',
    'test-output',
    'migrations'
]);

/** Every non-test TypeScript file under `root`. */
function sourceFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) {
                continue;
            }
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(path);
            } else if (
                /\.tsx?$/.test(entry.name) &&
                !/\.spec\.tsx?$/.test(entry.name)
            ) {
                out.push(path);
            }
        }
    };
    walk(root);
    return out;
}

/**
 * One `{ file, line, text }` per **code** line of `files`.
 *
 * Comment lines are dropped, and that is load-bearing rather than tidiness:
 * both guards' doc blocks name `authorizeWorkspaceAccess`, this file's own
 * prose names `isMember`, and the media controller explains its exception at
 * length. Counting prose as a call site would make every check below either
 * permanently red or allow-listed into uselessness.
 */
function codeLines(
    files: string[]
): { file: string; line: number; text: string }[] {
    const out: { file: string; line: number; text: string }[] = [];
    for (const file of files) {
        const lines = readFileSync(file, 'utf8').split('\n');
        for (const [index, text] of lines.entries()) {
            const trimmed = text.trimStart();
            if (
                trimmed.startsWith('*') ||
                trimmed.startsWith('//') ||
                trimmed.startsWith('/*')
            ) {
                continue;
            }
            out.push({ file: relative(REPO, file), line: index + 1, text });
        }
    }
    return out;
}

/** `path:line` — the point of failing is to say where. */
const at = (hit: { file: string; line: number }) => `${hit.file}:${hit.line}`;

/** Where the shared rule lives. */
const RULE =
    'packages/workspaces/server/src/lib/workspace/http/guards/workspace-access.ts';

/** The two guards that must delegate to it. */
const GUARDS = [
    'packages/workspaces/server/src/lib/workspace/http/guards/workspace.guard.ts',
    'packages/workspaces/server/src/lib/workspace/http/guards/workspace-member.guard.ts'
];

/** The probe's own declaration — not a call site. */
const PROBE_DECLARATION =
    'packages/workspaces/server/src/lib/workspace/infrastructure/queries/membership-check.query.ts';

/** The one sanctioned exception, and why it is one. */
const DOCUMENTED_EXCEPTION =
    'packages/media/server/src/lib/http/controllers/download-asset.controller.ts';

describe('one workspace-access rule, one membership probe [workspaces:I-02]', () => {
    /** Every production source in the repository, tests excluded. */
    const REPO_CODE = codeLines([
        ...sourceFiles(join(REPO, 'packages')),
        ...sourceFiles(join(REPO, 'apps'))
    ]);

    it('reads the repository at all', () => {
        // The guard on the guard. A walk that skipped everything would pass
        // every check below while proving nothing about any of them.
        expect(REPO_CODE.length).toBeGreaterThan(20000);
    });

    it('defines the rule exactly once', () => {
        const definitions = REPO_CODE.filter((hit) =>
            /export\s+async\s+function\s+authorizeWorkspaceAccess\b/.test(
                hit.text
            )
        );
        expect(definitions.map((hit) => hit.file)).toEqual([RULE]);
    });

    it.each(GUARDS)('delegates to it from %s', (guard) => {
        const lines = REPO_CODE.filter((hit) => hit.file === guard);
        // Non-vacuous: a path typo here would otherwise "pass" on an empty set.
        expect(lines.length).toBeGreaterThan(10);

        expect(
            lines.filter((hit) => /authorizeWorkspaceAccess\(/.test(hit.text))
        ).toHaveLength(1);

        // …and decides nothing itself. A guard that grew its own probe, its own
        // 403, or its own uuid check has stopped sharing the rule even while it
        // still calls it.
        expect(
            lines
                .filter((hit) =>
                    /\.isMember\(|ForbiddenException|WORKSPACE_ID_PATTERN|\.select\(/.test(
                        hit.text
                    )
                )
                .map(at)
        ).toEqual([]);
    });

    it('has exactly one other caller of the membership probe, and it is the documented one', () => {
        const callers = REPO_CODE.filter(
            (hit) =>
                /\.isMember\(/.test(hit.text) && hit.file !== PROBE_DECLARATION
        );

        // The shared rule, plus media's download route — one line each. A
        // third entry is a second membership decision, which is the thing this
        // invariant denies. Compared by file rather than `file:line` so an
        // edited comment above the call does not fail it.
        expect(callers.map((hit) => hit.file).sort()).toEqual([
            DOCUMENTED_EXCEPTION,
            RULE
        ]);
    });

    it('lets the exception answer 404 rather than 403, and wear no WorkspaceGuard', () => {
        // Code lines only: the controller's own doc block says "the one media
        // route without `WorkspaceGuard`" in prose, and reading the raw file
        // would count that sentence as the guard it denies.
        const code = REPO_CODE.filter(
            (hit) => hit.file === DOCUMENTED_EXCEPTION
        );
        expect(code.length).toBeGreaterThan(10);

        // Why it is exempt at all: the workspace comes from the asset's row,
        // so there is no header for `WorkspaceGuard` to authorize.
        expect(
            code.filter((hit) =>
                hit.text.includes('@UseGuards(PermissionsGuard)')
            )
        ).toHaveLength(1);
        expect(
            code.filter((hit) => hit.text.includes('WorkspaceGuard')).map(at)
        ).toEqual([]);

        // And why it may not simply reuse the shared rule: a 403 would
        // distinguish "not yours" from "no such asset", which is the
        // enumeration signal this route exists to withhold. The refusal it
        // does raise is the same one a missing id gets.
        const source = readFileSync(join(REPO, DOCUMENTED_EXCEPTION), 'utf8');
        const decision = source.slice(
            source.indexOf('await this.members.isMember(')
        );
        expect(decision).toContain('throw new NotFoundException();');
        expect(
            code.filter((hit) => hit.text.includes('ForbiddenException'))
        ).toEqual([]);
    });
});
