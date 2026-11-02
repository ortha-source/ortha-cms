import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

import {
    ENV_CATALOG,
    SETUP_STEPS,
    emailProblem,
    inspectEnvironment,
    mailFromEnv,
    maskValue,
    type SetupStep
} from '@orthacms/config';

import { createAdministrator, accountExists } from '../setup/admin';
import { runSetupCheck } from '../setup/checks';
import { runEngine, type EnvValues } from '../setup/engine';
import { applyToEnvFile, diffValues } from '../setup/env-file';
import {
    renderCompose,
    renderEnvList,
    renderKubernetesSecret,
    type OutputFormat
} from '../setup/output';
import { colors, terminalPrompter, type Prompter } from '../setup/prompter';
import { installedFeatures } from './doctor';
import { migrateCommand } from './migrate';

/** What `orthacms setup` was asked for. */
export interface SetupOptions {
    /** `--production`; asked when absent. */
    readonly production?: boolean;
    /** `--yes`: apply `--set` values without asking. Also any non-TTY run. */
    readonly yes: boolean;
    /** `--set NAME=value`, repeatable. */
    readonly set: readonly string[];
    /** `--output env|compose|kubernetes|file`. */
    readonly output?: OutputFormat;
    /** `--skip-checks`. */
    readonly skipChecks: boolean;
}

/** `NAME=value` pairs from `--set`, refusing a malformed one. */
export function parseSetPairs(pairs: readonly string[]): EnvValues {
    const values: EnvValues = {};
    for (const pair of pairs) {
        const match = /^([A-Z][A-Z0-9_]*)=(.*)$/s.exec(pair);
        if (!match) {
            throw new Error(`--set takes NAME=value (got "${pair}").`);
        }
        values[match[1] as string] = match[2] || undefined;
    }
    return values;
}

/** A password worth using: 18 random characters in three dashed groups. */
export function generatePassword(): string {
    const raw = randomBytes(18).toString('base64url').slice(0, 18);
    return `${raw.slice(0, 6)}-${raw.slice(6, 12)}-${raw.slice(12)}`;
}

/** A value fit for the summary: masked when the catalog calls it a secret. */
function shown(name: string, value: string | undefined): string {
    if (value === undefined) return '(removed)';
    const spec = ENV_CATALOG.find((entry) => entry.name === name);
    if (spec) return maskValue(spec, value);
    return /SECRET|PASSWORD|TOKEN|KEY|CERT/.test(name) ? '•••' : value;
}

/** Runs a command and resolves on exit 0. */
function exec(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { cwd, stdio: 'inherit' });
        child.on('error', reject);
        child.on('exit', (code) =>
            code === 0
                ? resolve()
                : reject(
                      new Error(
                          `${command} ${args.join(' ')} exited with code ${code}`
                      )
                  )
        );
    });
}

/**
 * `orthacms setup` — asks where this app runs, writes the settings, and checks
 * each one as it goes. Re-runnable: it reads the `.env` it finds, offers what
 * is there as the default, and changes only what you answer differently.
 */
export async function setupCommand(
    root: string,
    options: SetupOptions
): Promise<void> {
    const features = installedFeatures(root);
    const workspace = features.has('workspace');
    const envPath = join(root, '.env');
    const fileText = existsSync(envPath) ? readFileSync(envPath, 'utf8') : '';
    const fileValues: EnvValues = parseEnv(fileText);
    const color = Boolean(process.stdout.isTTY) && !process.env['NO_COLOR'];
    const c = colors(color);

    if (options.yes || !process.stdin.isTTY) {
        return applyWithoutAsking(
            root,
            options,
            fileText,
            fileValues,
            features
        );
    }

    const prompter = terminalPrompter(color);
    try {
        prompter.say(c.bold('Ortha CMS setup'));
        prompter.say(
            c.dim(
                'Writes your settings, checks every connection, creates your first admin.'
            )
        );
        prompter.say('');

        const production =
            options.production ??
            (fileValues['NODE_ENV'] === 'production' ||
                (await prompter.choice({
                    label: 'Where will this instance run?',
                    choices: [
                        {
                            value: 'dev',
                            label: 'This machine, for development'
                        },
                        {
                            value: 'prod',
                            label: 'A server or container (production)'
                        }
                    ],
                    default: 'dev'
                })) === 'prod');
        const initial: EnvValues = {
            ...fileValues,
            ...parseSetPairs(options.set),
            ...(production ? { NODE_ENV: 'production' } : {})
        };

        const only = await chooseSections(
            prompter,
            fileText,
            production,
            features,
            initial
        );
        const result = await runEngine({
            steps: SETUP_STEPS,
            production,
            features,
            initial,
            prompter,
            skipChecks: options.skipChecks,
            only,
            hooks: {
                check: (check, values) =>
                    runSetupCheck(root, check, values, workspace),
                beforeCheck: async (step, answers) => {
                    if (step.id === 'database' && answers['how'] === 'docker') {
                        await startDockerPostgres(root, prompter);
                    }
                },
                afterStep: async (step, answers, values) => {
                    if (step.id === 'database') {
                        await afterDatabase(
                            root,
                            prompter,
                            values,
                            production,
                            workspace
                        );
                    }
                    if (step.id === 'mail' && answers['how'] === 'smtp') {
                        await offerTestMessage(root, prompter, values);
                    }
                }
            }
        });

        await writeOutput(root, prompter, {
            production,
            format: options.output,
            fileText,
            fileValues,
            values: result.values
        });
        if (result.skipped.length > 0) {
            prompter.say(
                c.yellow(
                    `⚠ Skipped checks: ${result.skipped.join(', ')}. \`npx orthacms doctor\` will name them until they pass.`
                )
            );
        }
    } finally {
        prompter.close();
    }
}

/** On a re-run, which part to change — or all of it. */
async function chooseSections(
    prompter: Prompter,
    fileText: string,
    production: boolean,
    features: ReadonlySet<string>,
    values: EnvValues
): Promise<ReadonlySet<string> | undefined> {
    const configured = /^\s*[A-Z][A-Z0-9_]*=\S/m.test(fileText);
    if (!configured) return undefined;
    const context = { production, features, values };
    const applicable = SETUP_STEPS.filter((step) => step.when(context));
    const sections = [...new Set(applicable.map((step) => step.section))];
    const picked = await prompter.choice({
        label: 'Found .env. What do you want to change?',
        choices: [
            { value: '*', label: 'Everything, step by step' },
            ...sections.map((section) => ({ value: section, label: section }))
        ],
        default: '*'
    });
    if (picked === '*') return undefined;
    return new Set(
        SETUP_STEPS.filter((step: SetupStep) => step.section === picked).map(
            (step) => step.id
        )
    );
}

/** `docker compose up -d`, then wait until Postgres accepts connections. */
async function startDockerPostgres(
    root: string,
    prompter: Prompter
): Promise<void> {
    if (!existsSync(join(root, 'docker-compose.yml'))) {
        prompter.say('  No docker-compose.yml here — start Postgres yourself.');
        return;
    }
    await exec('docker', ['compose', 'up', '-d'], root);
    // The check that follows retries the connection itself; give the
    // container a moment to start listening first.
    await new Promise((resolve) => setTimeout(resolve, 3_000));
}

/** Migrations, then the first administrator, once the database answers. */
async function afterDatabase(
    root: string,
    prompter: Prompter,
    values: EnvValues,
    production: boolean,
    workspace: boolean
): Promise<void> {
    if (workspace) {
        prompter.say(
            '  This repository migrates and seeds itself: npx nx run server:dev:reset'
        );
        return;
    }
    const migrate =
        !production ||
        (await prompter.confirm({
            label: 'Apply pending migrations now?',
            default: true
        }));
    if (!migrate) {
        prompter.say(
            '  Run `npx orthacms migrate` before starting the server.'
        );
        return;
    }
    const saved = process.env;
    process.env = { ...saved, ...(values as NodeJS.ProcessEnv) };
    try {
        await migrateCommand(root);
        prompter.say('  ✔ Migrations applied');

        if (
            !(await prompter.confirm({
                label: 'Create an administrator account now?',
                default: true
            }))
        ) {
            return;
        }
        let email: string;
        for (;;) {
            email = await prompter.text({
                label: 'Email',
                default: values['ORTHACMS_ROOT_ADMIN_EMAIL']
            });
            const problem = emailProblem(email);
            if (!problem) break;
            prompter.say(`  ${problem}`);
        }
        if (await accountExists(values['DATABASE_URL'] as string, email)) {
            prompter.say(`  ${email} already has an account — left as it is.`);
        } else {
            const typed = await prompter.text({
                label: 'Password (Enter to generate one)',
                secret: true,
                optional: true
            });
            const password = typed || generatePassword();
            await createAdministrator(root, { email, password });
            prompter.say(`  ✔ Created administrator ${email}`);
            if (!typed) {
                prompter.say(
                    `  Password: ${password}  (shown once, written nowhere)`
                );
            }
        }
        // The account exists now; a password left in the environment is only
        // a password sitting in a file.
        values['ORTHACMS_ROOT_ADMIN_EMAIL'] = undefined;
        values['ORTHACMS_ROOT_ADMIN_PASSWORD'] = undefined;
        values['ORTHACMS_ROOT_ADMIN_NAME'] = undefined;
    } finally {
        process.env = saved;
    }
}

/** Sends one message through the relay just configured, if asked. */
async function offerTestMessage(
    root: string,
    prompter: Prompter,
    values: EnvValues
): Promise<void> {
    if (
        !(await prompter.confirm({
            label: 'Send a test message?',
            default: true
        }))
    )
        return;
    const to = await prompter.text({ label: 'To' });
    const saved = process.env;
    process.env = { ...saved, ...(values as NodeJS.ProcessEnv) };
    try {
        const mail = mailFromEnv(['smtp']);
        const nodemailer = createRequire(join(root, 'package.json'))(
            'nodemailer'
        ) as {
            createTransport(options: object): {
                sendMail(message: object): Promise<unknown>;
                close(): void;
            };
        };
        if (!mail?.smtp) return;
        const transport = nodemailer.createTransport({
            host: mail.smtp.host,
            port: mail.smtp.port ?? 587,
            secure: mail.smtp.secure ?? false,
            requireTLS: mail.smtp.requireTls ?? false,
            auth: mail.smtp.user
                ? { user: mail.smtp.user, pass: mail.smtp.password }
                : undefined
        });
        try {
            await transport.sendMail({
                from: mail.from,
                to,
                subject: 'Ortha CMS: mail works',
                text: 'This message was sent by `orthacms setup` to check the relay. Invitations and password resets will arrive the same way.'
            });
            prompter.say(`  ✔ Sent to ${to} — check the inbox.`);
        } finally {
            transport.close();
        }
    } catch (error) {
        prompter.say(
            `  ✖ ${error instanceof Error ? error.message : String(error)}`
        );
    } finally {
        process.env = saved;
    }
}

/** Writes the settings where they were asked to go, and says what changed. */
async function writeOutput(
    root: string,
    prompter: Prompter,
    input: {
        production: boolean;
        format?: OutputFormat;
        fileText: string;
        fileValues: EnvValues;
        values: EnvValues;
    }
): Promise<void> {
    const format =
        input.format ??
        (input.production
            ? ((await prompter.choice({
                  label: 'Where should the settings go?',
                  choices: [
                      { value: 'env', label: 'Write .env' },
                      {
                          value: 'compose',
                          label: 'Print a Docker Compose environment block'
                      },
                      {
                          value: 'kubernetes',
                          label: 'Write a Kubernetes Secret (orthacms-secret.yaml)'
                      },
                      {
                          value: 'file',
                          label: 'Write orthacms.env for Fly, Render or Railway to import'
                      }
                  ],
                  default: 'env'
              })) as OutputFormat)
            : 'env');
    const changes = diffValues(input.fileValues, input.values);
    prompter.say('');
    switch (format) {
        case 'env':
            writeFileSync(
                join(root, '.env'),
                applyToEnvFile(input.fileText, changes),
                { mode: 0o600 }
            );
            prompter.say(`Wrote .env — ${Object.keys(changes).length} changed`);
            for (const [name, value] of Object.entries(changes)) {
                prompter.say(`  ${name.padEnd(32)} ${shown(name, value)}`);
            }
            break;
        case 'compose':
            prompter.say(renderCompose(input.values));
            break;
        case 'kubernetes':
            writeFileSync(
                join(root, 'orthacms-secret.yaml'),
                renderKubernetesSecret(input.values),
                { mode: 0o600 }
            );
            prompter.say(
                'Wrote orthacms-secret.yaml — kubectl apply -f orthacms-secret.yaml'
            );
            break;
        case 'file':
            writeFileSync(
                join(root, 'orthacms.env'),
                renderEnvList(input.values),
                { mode: 0o600 }
            );
            prompter.say(
                'Wrote orthacms.env. Fly: fly secrets import < orthacms.env. Render and Railway: paste it into the environment editor. Then delete the file.'
            );
            break;
    }
    prompter.say('');
    prompter.say(
        input.production
            ? 'Next: npx orthacms doctor, then deploy.'
            : 'Next: npm run dev'
    );
}

/**
 * `--yes`, or no terminal: apply `--set` values, check them the way the server
 * and `doctor` would, write them, and fail on anything wrong. A scaffolder or
 * CI that blocks on a prompt hangs until it times out.
 */
async function applyWithoutAsking(
    root: string,
    options: SetupOptions,
    fileText: string,
    fileValues: EnvValues,
    features: ReadonlySet<string>
): Promise<void> {
    const values: EnvValues = {
        ...fileValues,
        ...parseSetPairs(options.set),
        ...(options.production ? { NODE_ENV: 'production' } : {})
    };
    const env = Object.fromEntries(
        Object.entries({ ...process.env, ...values }).filter(
            ([, value]) => value !== undefined
        )
    ) as NodeJS.ProcessEnv;
    const { findings } = inspectEnvironment({ env, features });
    const errors = findings.filter((finding) => finding.level === 'error');
    for (const finding of findings) {
        console.log(
            `${finding.level === 'error' ? '✖' : '⚠'} ${finding.message}`
        );
    }
    if (errors.length > 0) {
        process.exitCode = 1;
        return;
    }
    const changes = diffValues(fileValues, values);
    const format = options.output ?? 'env';
    if (format === 'env') {
        writeFileSync(join(root, '.env'), applyToEnvFile(fileText, changes), {
            mode: 0o600
        });
        console.log(`Wrote .env — ${Object.keys(changes).length} changed`);
    } else if (format === 'compose') {
        console.log(renderCompose(values));
    } else if (format === 'kubernetes') {
        writeFileSync(
            join(root, 'orthacms-secret.yaml'),
            renderKubernetesSecret(values),
            { mode: 0o600 }
        );
        console.log('Wrote orthacms-secret.yaml');
    } else {
        writeFileSync(join(root, 'orthacms.env'), renderEnvList(values), {
            mode: 0o600
        });
        console.log('Wrote orthacms.env');
    }
}
