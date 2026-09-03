const execFileSync = jest.fn();

jest.mock('node:child_process', () => ({
    execFileSync: (...args: unknown[]) => execFileSync(...args)
}));

import { runDrizzleKitGenerate } from './generate';

beforeEach(() => jest.clearAllMocks());

describe('runDrizzleKitGenerate', () => {
    it('runs drizzle-kit’s bin on this node, from the plugin’s project root', () => {
        runDrizzleKitGenerate(
            '/repo/packages/media/server',
            'drizzle.config.ts'
        );

        const [command, args, options] = execFileSync.mock.calls[0];
        expect(command).toBe(process.execPath);
        expect(args[0]).toMatch(/drizzle-kit[/\\]bin\.cjs$/);
        expect(args.slice(1)).toEqual([
            'generate',
            '--config=drizzle.config.ts'
        ]);
        expect(options).toEqual({
            cwd: '/repo/packages/media/server',
            stdio: 'inherit'
        });
    });

    it('omits --name entirely when none was given, letting drizzle-kit pick one', () => {
        runDrizzleKitGenerate('/repo/x', 'drizzle.config.ts');

        expect(execFileSync.mock.calls[0][1]).not.toContain(
            expect.stringContaining('--name')
        );
    });

    /**
     * `execFileSync` is given an argv array and no shell, so a migration name
     * is a migration name however it is spelled.
     */
    it('passes a hostile --name as one literal argv element [cli:I-21]', () => {
        runDrizzleKitGenerate('/repo/x', 'drizzle.config.ts', 'a b; rm -rf /');

        expect(execFileSync.mock.calls[0][1]).toContain('--name=a b; rm -rf /');
        expect(execFileSync.mock.calls[0][2]).not.toHaveProperty('shell');
    });

    /**
     * `execFileSync`'s own Error stringifies the whole argv — node's path,
     * drizzle-kit's bin path, every flag — which Nx then prints as a
     * multi-frame stack. drizzle-kit has already said what was wrong on the
     * inherited stdio; what is missing is which project failed.
     */
    describe('when drizzle-kit exits non-zero', () => {
        beforeEach(() => {
            execFileSync.mockImplementation(() => {
                throw Object.assign(
                    new Error(
                        `Command failed: ${process.execPath} /n_m/drizzle-kit/bin.cjs generate --config=drizzle.config.ts`
                    ),
                    { status: 1 }
                );
            });
        });

        it('names the project and the exit code instead of re-printing the argv', () => {
            expect(() =>
                runDrizzleKitGenerate(
                    '/repo/packages/media/server',
                    'drizzle.config.ts'
                )
            ).toThrow(
                'drizzle-kit generate failed in /repo/packages/media/server (exit 1)'
            );
        });

        it('points at the config whose schema paths are the usual cause', () => {
            expect(() =>
                runDrizzleKitGenerate('/repo/x', 'drizzle.config.ts')
            ).toThrow(/drizzle\.config\.ts's `schema` paths/);
        });

        it('keeps the original error as the cause, so --verbose still has it', () => {
            let caught: Error | undefined;
            try {
                runDrizzleKitGenerate('/repo/x', 'drizzle.config.ts');
            } catch (error) {
                caught = error as Error;
            }

            expect((caught?.cause as Error).message).toContain(
                'Command failed'
            );
        });
    });
});
