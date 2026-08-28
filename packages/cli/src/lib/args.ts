/**
 * Argv parsing for the `ortha` binary.
 *
 * Split out of `cli.ts` because that file runs `main()` on import: anything
 * left in it is untestable, and the one thing worth testing here is which
 * arguments mean "show the help" — the first command a new user types.
 */

export const USAGE = `ortha — the Ortha CMS command line

Usage: ortha <command> [options]

Commands:
  dev                    Run the API and admin dev servers together
  build                  Compile the server and build the admin bundle
  start                  Run the built server
  migrate                Apply every plugin's pending migrations
  generate [--name=<n>]  Generate a migration for this app's content tables
  studio [--host --port] Open Drizzle Studio on this app's database

Options:
  --server               build/dev: the server only, skipping the admin
  --admin                build: the admin bundle only
  -h, --help             Show this message
`;

/** Reads `--flag=value`, or `--flag value`, from argv. */
export function option(
    argv: readonly string[],
    name: string
): string | undefined {
    const inline = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (inline) return inline.slice(`--${name}=`.length);

    const index = argv.indexOf(`--${name}`);
    const next = index === -1 ? undefined : argv[index + 1];

    return next && !next.startsWith('-') ? next : undefined;
}

/** Whether a bare `--flag` is present. */
export function flag(argv: readonly string[], name: string): boolean {
    return argv.includes(`--${name}`);
}

/**
 * Whether this invocation is asking for the usage text.
 *
 * Deliberately reads the **whole** argv rather than the arguments after the
 * command. `ortha --help` puts `--help` in the command position, and a check
 * that only looked past it fell through to the `switch` and answered the most
 * common first command with `Unknown command "--help"` and exit code 1.
 *
 * `help` as a bare word is accepted for the same reason: it costs one clause
 * and it is what people type when the flag has just failed them.
 */
export function wantsHelp(args: readonly string[]): boolean {
    return (
        args.length === 0 ||
        args[0] === 'help' ||
        args.includes('--help') ||
        args.includes('-h')
    );
}
