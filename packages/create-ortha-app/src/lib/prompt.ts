import { createInterface } from 'node:readline/promises';

/** A question, its default, and how to validate the answer. */
export interface Question {
    /** What to show the user. */
    label: string;
    /** Value used when the answer is empty, or when running non-interactively. */
    fallback: string;
    /** Returns an error message when the answer is unusable. */
    validate?: (answer: string) => string | undefined;
}

/**
 * Asks a series of questions on the terminal.
 *
 * Skipped entirely when stdin is not a TTY (CI, a piped install) or when the
 * caller passes `--yes`. A scaffolder that blocks on a prompt nobody can answer
 * hangs a pipeline until it times out, which is a far worse failure than
 * defaulting.
 */
export async function ask(
    questions: Readonly<Record<string, Question>>,
    interactive: boolean
): Promise<Record<string, string>> {
    const answers: Record<string, string> = {};

    if (!interactive) {
        for (const [key, question] of Object.entries(questions)) {
            answers[key] = question.fallback;
        }
        return answers;
    }

    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try {
        for (const [key, question] of Object.entries(questions)) {
            for (;;) {
                const raw = await rl.question(
                    `${question.label} (${question.fallback}) `
                );
                const answer = raw.trim() || question.fallback;
                const error = question.validate?.(answer);

                if (!error) {
                    answers[key] = answer;
                    break;
                }
                console.error(`  ${error}`);
            }
        }
    } finally {
        rl.close();
    }

    return answers;
}
