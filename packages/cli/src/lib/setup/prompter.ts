import { createInterface, type Interface } from 'node:readline';

/** One option in a pick-list. */
export interface PromptChoice {
    readonly value: string;
    readonly label: string;
    readonly hint?: string;
}

/**
 * What the wizard asks through. The engine depends on this and nothing else,
 * so it is driven by a terminal in use and by a script in tests.
 */
export interface Prompter {
    text(question: {
        label: string;
        default?: string;
        secret?: boolean;
        optional?: boolean;
    }): Promise<string>;
    choice(question: {
        label: string;
        choices: readonly PromptChoice[];
        default?: string;
    }): Promise<string>;
    confirm(question: { label: string; default: boolean }): Promise<boolean>;
    /** A line of output. */
    say(line: string): void;
    close(): void;
}

/** Colours for a terminal that wants them, and none for anything else. */
export function colors(enabled: boolean) {
    const wrap = (code: number) => (text: string) =>
        enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
    return {
        dim: wrap(2),
        bold: wrap(1),
        red: wrap(31),
        green: wrap(32),
        yellow: wrap(33),
        cyan: wrap(36)
    };
}

/** A secret's default, shown without showing it. */
function maskDefault(value: string): string {
    return value.length > 8 ? `•••${value.slice(-4)}` : '•••';
}

/**
 * A line-based prompter over stdin/stdout. Numbered choices rather than an
 * arrow-key picker: it works the same over SSH, in a CI log and through a
 * screen reader, and Enter always takes the default shown.
 */
export function terminalPrompter(color: boolean): Prompter {
    const c = colors(color);
    let muted = false;
    const rl: Interface = createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: Boolean(process.stdin.isTTY)
    });
    // Typed secrets are not echoed: readline writes every keystroke through
    // this, so swallowing it while muted is how the input stays hidden.
    const internals = rl as unknown as { _writeToOutput(text: string): void };
    const write = internals._writeToOutput.bind(rl);
    internals._writeToOutput = (text) => {
        if (!muted) write(text);
        else if (text.includes('\n')) write('\n');
    };
    // Lines are queued rather than answered by `rl.question`, which drops any
    // line that arrives while no question is pending — so a pasted block of
    // answers, or a fast typist, lost everything after the first line.
    const queued: string[] = [];
    const waiting: ((line: string | undefined) => void)[] = [];
    let closed = false;
    rl.on('line', (line) => {
        const waiter = waiting.shift();
        if (waiter) waiter(line);
        else queued.push(line);
    });
    rl.on('close', () => {
        closed = true;
        for (const waiter of waiting.splice(0)) waiter(undefined);
    });
    const ask = async (query: string, secret = false): Promise<string> => {
        rl.setPrompt(query);
        rl.prompt();
        muted = secret;
        const line =
            queued.length > 0
                ? queued.shift()
                : closed
                  ? undefined
                  : await new Promise<string | undefined>((resolve) =>
                        waiting.push(resolve)
                    );
        muted = false;
        if (line === undefined) {
            throw new Error(
                'Input ended before setup finished — nothing was written.'
            );
        }
        return line.trim();
    };

    return {
        async text({ label, default: fallback, secret, optional }) {
            const shown = fallback
                ? secret
                    ? maskDefault(fallback)
                    : fallback
                : '';
            for (;;) {
                const answer = await ask(
                    `${c.cyan('?')} ${c.bold(label)}${shown ? c.dim(` (${shown})`) : ''} › `,
                    secret
                );
                if (answer) return answer;
                if (fallback) return fallback;
                if (optional) return '';
                console.log(c.yellow('  An answer is needed here.'));
            }
        },
        async choice({ label, choices, default: fallback }) {
            console.log(`${c.cyan('?')} ${c.bold(label)}`);
            choices.forEach((choice, index) => {
                const marker = choice.value === fallback ? c.cyan('›') : ' ';
                console.log(
                    `  ${marker} ${index + 1}) ${choice.label}${choice.hint ? c.dim(` — ${choice.hint}`) : ''}`
                );
            });
            const preset = choices.findIndex(
                (choice) => choice.value === fallback
            );
            for (;;) {
                const answer = await ask(
                    `  ${c.dim(`1-${choices.length}`)}${preset >= 0 ? c.dim(` (${preset + 1})`) : ''} › `
                );
                const presetChoice = choices[preset];
                if (!answer && presetChoice) return presetChoice.value;
                const index = Number(answer) - 1;
                const picked = choices[index];
                if (picked) return picked.value;
                console.log(
                    c.yellow(`  Pick a number from 1 to ${choices.length}.`)
                );
            }
        },
        async confirm({ label, default: fallback }) {
            for (;;) {
                const answer = (
                    await ask(
                        `${c.cyan('?')} ${c.bold(label)} ${c.dim(fallback ? '(Y/n)' : '(y/N)')} › `
                    )
                ).toLowerCase();
                if (!answer) return fallback;
                if (['y', 'yes'].includes(answer)) return true;
                if (['n', 'no'].includes(answer)) return false;
            }
        },
        say(line) {
            console.log(line);
        },
        close() {
            rl.close();
        }
    };
}
