import type {
    SetupCheck,
    SetupContext,
    SetupField,
    SetupStep
} from '@orthacms/config';

import type { Prompter } from './prompter';

/** The environment being built: a value per variable, `undefined` to remove it. */
export type EnvValues = Record<string, string | undefined>;

/** What a check reports. */
export interface CheckOutcome {
    readonly ok: boolean;
    readonly detail: string;
}

/** The parts of the wizard the engine does not own. */
export interface EngineHooks {
    /** Runs a step's live check against the values so far. */
    check(check: SetupCheck, values: EnvValues): Promise<CheckOutcome>;
    /** Before a step's check — e.g. starting Postgres in Docker. */
    beforeCheck?(
        step: SetupStep,
        answers: Record<string, string>,
        values: EnvValues
    ): Promise<void>;
    /** After a step passes its check (or has none). */
    afterStep?(
        step: SetupStep,
        answers: Record<string, string>,
        values: EnvValues
    ): Promise<void>;
}

/** What the engine was asked to do. */
export interface EngineOptions {
    readonly steps: readonly SetupStep[];
    readonly production: boolean;
    readonly features: ReadonlySet<string>;
    /** The environment as it stands: the `.env` file and anything exported. */
    readonly initial: EnvValues;
    readonly prompter: Prompter;
    readonly hooks: EngineHooks;
    /** Skip the live checks. */
    readonly skipChecks?: boolean;
    /** Step ids to run; all applicable ones when absent. */
    readonly only?: ReadonlySet<string>;
}

/** What came out. */
export interface EngineResult {
    readonly values: EnvValues;
    /** Steps whose check failed and was skipped — `doctor` will name them. */
    readonly skipped: readonly string[];
}

/**
 * Walks the steps: asks each field that applies, follows the branch a choice
 * opens, writes what each answer maps to, derives what is computed, and runs
 * the step's check — offering to retry, edit or skip when it fails.
 */
export async function runEngine(options: EngineOptions): Promise<EngineResult> {
    const values: EnvValues = { ...options.initial };
    const skipped: string[] = [];
    const { prompter } = options;
    const context = (): SetupContext => ({
        production: options.production,
        features: options.features,
        values
    });
    const apply = (
        writes: Readonly<Record<string, string | undefined>> | undefined
    ) => {
        for (const [name, value] of Object.entries(writes ?? {})) {
            values[name] = value || undefined;
        }
    };

    async function ask(
        fields: readonly SetupField[],
        answers: Record<string, string>
    ): Promise<void> {
        for (const field of fields) {
            if (field.when && !field.when(context(), answers)) continue;
            const help = field.help?.(context());
            if (help) prompter.say(`  ${help}`);
            if (field.kind === 'choice') {
                const choices = field.choices.filter(
                    (choice) => !choice.when || choice.when(context())
                );
                const fallback = field.default?.(context());
                const value = await prompter.choice({
                    label: field.label,
                    choices,
                    default: choices.some((choice) => choice.value === fallback)
                        ? fallback
                        : choices[0]?.value
                });
                answers[field.id] = value;
                const chosen = choices.find((choice) => choice.value === value);
                if (field.env) apply({ [field.env]: value });
                apply(chosen?.writes);
                if (chosen?.then) await ask(chosen.then, answers);
            } else if (field.kind === 'confirm') {
                const yes = await prompter.confirm({
                    label: field.label,
                    default: field.default(context())
                });
                answers[field.id] = yes ? 'yes' : 'no';
                apply(yes ? field.writes?.yes : field.writes?.no);
            } else {
                const fallback =
                    field.default?.(context()) ??
                    (field.env ? values[field.env] : undefined);
                for (;;) {
                    const value = await prompter.text({
                        label: field.label,
                        default: fallback,
                        secret: field.kind === 'secret',
                        optional: field.optional
                    });
                    const problem = value ? field.validate?.(value) : undefined;
                    if (problem) {
                        prompter.say(`  ${problem}`);
                        continue;
                    }
                    answers[field.id] = value;
                    if (field.env) apply({ [field.env]: value });
                    break;
                }
            }
        }
    }

    for (const step of options.steps) {
        if (options.only && !options.only.has(step.id)) continue;
        if (!step.when(context())) continue;
        prompter.say('');
        prompter.say(step.title);
        for (;;) {
            const answers: Record<string, string> = {};
            await ask(step.fields, answers);
            apply(step.derive?.(answers, context()));
            if (!step.check || options.skipChecks) {
                await options.hooks.afterStep?.(step, answers, values);
                break;
            }
            await options.hooks.beforeCheck?.(step, answers, values);
            let outcome = await options.hooks.check(step.check, values);
            let next: 'done' | 'edit' = 'done';
            while (!outcome.ok) {
                prompter.say(`  ✖ ${outcome.detail}`);
                const decision = await prompter.choice({
                    label: 'What now?',
                    choices: [
                        { value: 'retry', label: 'Retry' },
                        { value: 'edit', label: 'Edit the answers' },
                        {
                            value: 'skip',
                            label: 'Skip — fix it later (orthacms doctor will name it)'
                        }
                    ],
                    default: 'edit'
                });
                if (decision === 'retry') {
                    outcome = await options.hooks.check(step.check, values);
                    continue;
                }
                if (decision === 'skip') skipped.push(step.id);
                next = decision === 'edit' ? 'edit' : 'done';
                break;
            }
            if (outcome.ok) prompter.say(`  ✔ ${outcome.detail}`);
            if (next === 'edit') continue;
            if (outcome.ok)
                await options.hooks.afterStep?.(step, answers, values);
            break;
        }
    }
    return { values, skipped };
}
