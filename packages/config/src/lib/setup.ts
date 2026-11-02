/**
 * The steps `orthacms setup` walks through, as data.
 *
 * The wizard knows nothing about mail, SSO or storage: it renders fields,
 * follows the branch a choice opens, writes the variables a step resolves to,
 * and runs the live check a step names. Everything specific — which question,
 * which branch, which variable — is declared here, next to the builders that
 * read the same variables, so the wizard cannot ask for a variable the server
 * does not read.
 *
 * A step is shown only when it applies: a feature that is not installed has no
 * step, a production-only question is skipped in development, and a branch
 * nobody chose is never asked.
 */

import { absoluteUrl } from './urls';

/** What a step can see while it is being asked. */
export interface SetupContext {
    /** `orthacms setup --production`, or the answer to the first question. */
    readonly production: boolean;
    /** What the app installed (`featuresFromDependencies`). */
    readonly features: ReadonlySet<string>;
    /** The existing environment merged with everything answered so far. */
    readonly values: Readonly<Record<string, string | undefined>>;
}

/** What every field has. */
interface FieldBase {
    /** The answer's key within the step. */
    readonly id: string;
    /** The question. */
    readonly label: string;
    /** A line shown before the question, when there is something to know first. */
    readonly help?: (context: SetupContext) => string | undefined;
    /** The variable the answer is written to, if it maps to one directly. */
    readonly env?: string;
    /** Whether to ask at all, given the answers so far in this step. */
    readonly when?: (
        context: SetupContext,
        answers: Readonly<Record<string, string>>
    ) => boolean;
}

/** A typed answer. `secret` is masked as it is typed. */
export interface TextField extends FieldBase {
    readonly kind: 'text' | 'secret';
    /** Shown in the prompt and used on Enter. Defaults to the current value. */
    readonly default?: (context: SetupContext) => string | undefined;
    /** Enter on an empty answer is allowed, and clears the variable. */
    readonly optional?: boolean;
    /** A reason to ask again, or `undefined` for a good answer. */
    readonly validate?: (value: string) => string | undefined;
}

/** One option of a {@link ChoiceField}. */
export interface SetupChoice {
    readonly value: string;
    readonly label: string;
    readonly hint?: string;
    /** Offered only when this holds. */
    readonly when?: (context: SetupContext) => boolean;
    /** The questions this choice opens. */
    readonly then?: readonly SetupField[];
    /** Variables this choice sets; `undefined` removes one. */
    readonly writes?: Readonly<Record<string, string | undefined>>;
}

/** A pick from a list. */
export interface ChoiceField extends FieldBase {
    readonly kind: 'choice';
    readonly choices: readonly SetupChoice[];
    readonly default?: (context: SetupContext) => string | undefined;
}

/** A yes or no. */
export interface ConfirmField extends FieldBase {
    readonly kind: 'confirm';
    readonly default: (context: SetupContext) => boolean;
    /** What a yes and a no write; `undefined` removes a variable. */
    readonly writes?: {
        readonly yes?: Readonly<Record<string, string | undefined>>;
        readonly no?: Readonly<Record<string, string | undefined>>;
    };
}

/** Any field. */
export type SetupField = TextField | ChoiceField | ConfirmField;

/** A live check the wizard runs once a step is answered. */
export type SetupCheck =
    | 'database'
    | 'storage-local'
    | 'storage-s3'
    | 'mail'
    | 'oidc'
    | 'saml'
    | 'anthropic'
    | 'openai';

/** One screen of the wizard. */
export interface SetupStep {
    readonly id: string;
    readonly title: string;
    /** The section of the re-run menu this step belongs to. */
    readonly section: string;
    readonly when: (context: SetupContext) => boolean;
    readonly fields: readonly SetupField[];
    /** Variables computed from the answers, e.g. an endpoint from an account id. */
    readonly derive?: (
        answers: Readonly<Record<string, string>>,
        context: SetupContext
    ) => Readonly<Record<string, string | undefined>>;
    readonly check?: SetupCheck;
}

/** `undefined` for a good URL, the reason otherwise. */
function urlProblem(value: string): string | undefined {
    try {
        absoluteUrl('The address', value);
        return undefined;
    } catch (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

/** `undefined` for something that looks like an address, the reason otherwise. */
export function emailProblem(value: string): string | undefined {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? undefined
        : 'That does not look like an email address.';
}

/** The current value of a variable, as a default. */
const current =
    (name: string) =>
    (context: SetupContext): string | undefined =>
        context.values[name];

/** Whether a feature is installed. */
const has =
    (feature: string) =>
    (context: SetupContext): boolean =>
        context.features.has(feature);

/** Where SSO callbacks go, for the line shown before the questions. */
function callbackUrl(context: SetupContext, provider: string): string {
    const base =
        context.values['API_PUBLIC_URL'] ??
        context.values['PUBLIC_URL'] ??
        `http://localhost:${context.values['ADMIN_PORT'] ?? '4200'}`;
    return `${base.replace(/\/+$/, '')}/api/auth/sso/${provider}/callback`;
}

/** The SMTP relays the wizard knows the host and login of. */
export const SMTP_PRESETS: Readonly<
    Record<string, { label: string; host: string; port: number; user?: string }>
> = {
    resend: {
        label: 'Resend',
        host: 'smtp.resend.com',
        port: 587,
        user: 'resend'
    },
    postmark: { label: 'Postmark', host: 'smtp.postmarkapp.com', port: 587 },
    sendgrid: {
        label: 'SendGrid',
        host: 'smtp.sendgrid.net',
        port: 587,
        user: 'apikey'
    },
    mailgun: { label: 'Mailgun', host: 'smtp.mailgun.org', port: 587 },
    google: { label: 'Google Workspace', host: 'smtp.gmail.com', port: 587 },
    microsoft: { label: 'Microsoft 365', host: 'smtp.office365.com', port: 587 }
};

/**
 * `MAIL_URL` from its parts. `smtps://` for implicit TLS (465), `smtp://` for
 * STARTTLS; credentials are percent-encoded, so a password with `@` or `/`
 * survives.
 */
export function buildMailUrl(parts: {
    host: string;
    port: number;
    user?: string;
    password?: string;
    requireTls?: boolean;
}): string {
    const scheme = parts.port === 465 ? 'smtps' : 'smtp';
    const auth = parts.user
        ? `${encodeURIComponent(parts.user)}${parts.password ? `:${encodeURIComponent(parts.password)}` : ''}@`
        : '';
    const query =
        parts.requireTls && scheme === 'smtp' ? '?requireTls=true' : '';
    return `${scheme}://${auth}${parts.host}:${parts.port}${query}`;
}

/** The OIDC issuer a provider preset implies. */
export function oidcIssuer(
    answers: Readonly<Record<string, string>>
): string | undefined {
    const trim = (value: string | undefined) =>
        value?.trim().replace(/\/+$/, '');
    switch (answers['provider']) {
        case 'google':
            return 'https://accounts.google.com';
        case 'entra':
            return `https://login.microsoftonline.com/${trim(answers['tenant'])}/v2.0`;
        case 'okta':
            return `https://${trim(answers['domain'])?.replace(/^https?:\/\//, '')}`;
        case 'auth0':
            // Auth0 issues with a trailing slash, and the claim is compared
            // byte for byte.
            return `https://${trim(answers['domain'])?.replace(/^https?:\/\//, '')}/`;
        case 'keycloak':
            return `${trim(answers['url'])}/realms/${trim(answers['realm'])}`;
        default:
            return answers['issuer'];
    }
}

const SKIP: SetupChoice = {
    value: 'skip',
    label: 'Not now — leave it unconfigured'
};

/** Every step, in the order the wizard asks them. */
export const SETUP_STEPS: readonly SetupStep[] = [
    {
        id: 'address',
        title: 'Public URL',
        section: 'Public URL',
        when: (context) => context.production,
        fields: [
            {
                id: 'url',
                kind: 'text',
                env: 'PUBLIC_URL',
                label: 'The address people type into the browser',
                default: current('PUBLIC_URL'),
                validate: urlProblem
            },
            {
                id: 'layout',
                kind: 'choice',
                label: 'Where do the admin and the API live?',
                choices: [
                    {
                        value: 'same',
                        label: 'Both at that address (the usual setup)'
                    },
                    {
                        value: 'admin-elsewhere',
                        label: 'The admin is also served from another address',
                        then: [
                            {
                                id: 'extra',
                                kind: 'text',
                                env: 'EXTRA_ORIGINS',
                                label: 'Its address (comma-separated for several)',
                                default: current('EXTRA_ORIGINS')
                            }
                        ]
                    },
                    {
                        value: 'api-elsewhere',
                        label: 'The API has its own address',
                        then: [
                            {
                                id: 'api',
                                kind: 'text',
                                env: 'API_PUBLIC_URL',
                                label: "The API's address",
                                default: current('API_PUBLIC_URL'),
                                validate: urlProblem
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'proxy',
        title: 'Reverse proxy',
        section: 'Public URL',
        when: (context) => context.production,
        fields: [
            {
                id: 'proxy',
                kind: 'choice',
                label: 'What sits in front of the app?',
                default: (context) =>
                    context.values['TRUST_PROXY'] ? 'one' : 'none',
                choices: [
                    {
                        value: 'none',
                        label: 'Nothing — it is exposed directly',
                        writes: { TRUST_PROXY: undefined }
                    },
                    {
                        value: 'one',
                        label: 'One reverse proxy or load balancer (nginx, Caddy, ALB, Cloudflare)',
                        writes: { TRUST_PROXY: '1' }
                    },
                    {
                        value: 'many',
                        label: 'Two or more hops',
                        then: [
                            {
                                id: 'hops',
                                kind: 'text',
                                env: 'TRUST_PROXY',
                                label: 'How many',
                                default: () => '2',
                                validate: (value) =>
                                    /^\d+$/.test(value)
                                        ? undefined
                                        : 'A whole number.'
                            }
                        ]
                    },
                    {
                        value: 'subnet',
                        label: 'Trust a subnet instead (advanced)',
                        then: [
                            {
                                id: 'subnet',
                                kind: 'text',
                                env: 'TRUST_PROXY',
                                label: 'Subnets or presets, as Express takes them',
                                default: () => '10.0.0.0/8'
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'workers',
        title: 'Background work',
        section: 'Public URL',
        when: (context) => context.production,
        fields: [
            {
                id: 'workers',
                kind: 'confirm',
                label: 'Does this process send webhooks and mail? (No for web nodes in front of a worker)',
                default: (context) =>
                    context.values['ORTHACMS_WORKERS'] !== 'false',
                writes: {
                    yes: { ORTHACMS_WORKERS: undefined },
                    no: { ORTHACMS_WORKERS: 'false' }
                }
            }
        ]
    },
    {
        id: 'database',
        title: 'Database',
        section: 'Database',
        when: () => true,
        check: 'database',
        fields: [
            {
                id: 'how',
                kind: 'choice',
                label: 'Database',
                when: (context) => !context.production,
                default: () => 'docker',
                choices: [
                    {
                        value: 'docker',
                        label: 'Start Postgres in Docker (docker compose up -d)'
                    },
                    { value: 'existing', label: 'I already have one' }
                ]
            },
            {
                id: 'url',
                kind: 'secret',
                env: 'DATABASE_URL',
                label: 'Connection string',
                default: current('DATABASE_URL'),
                validate: (value) =>
                    /^postgres(ql)?:\/\//.test(value)
                        ? undefined
                        : 'A PostgreSQL URL: postgresql://user:password@host:5432/database.'
            }
        ]
    },
    {
        id: 'storage-local',
        title: 'Uploads',
        section: 'Storage',
        when: (context) => has('media-local')(context) && context.production,
        check: 'storage-local',
        fields: [
            {
                id: 'root',
                kind: 'text',
                env: 'MEDIA_LOCAL_ROOT',
                label: 'Directory uploads are written to (a persistent volume)',
                default: (context) =>
                    context.values['MEDIA_LOCAL_ROOT'] ?? './.storage/media'
            }
        ]
    },
    {
        id: 'storage-s3',
        title: 'Uploads — S3-compatible storage',
        section: 'Storage',
        when: has('media-s3'),
        check: 'storage-s3',
        fields: [
            {
                id: 'bucket',
                kind: 'text',
                env: 'MEDIA_S3_BUCKET',
                label: 'Bucket',
                default: current('MEDIA_S3_BUCKET')
            },
            {
                id: 'where',
                kind: 'choice',
                label: 'Where is the bucket?',
                choices: [
                    {
                        value: 'aws',
                        label: 'AWS S3',
                        writes: {
                            MEDIA_S3_ENDPOINT: undefined,
                            MEDIA_S3_FORCE_PATH_STYLE: undefined
                        },
                        then: [
                            {
                                id: 'region',
                                kind: 'text',
                                env: 'MEDIA_S3_REGION',
                                label: 'Region',
                                default: (context) =>
                                    context.values['MEDIA_S3_REGION'] ??
                                    'us-east-1'
                            }
                        ]
                    },
                    {
                        value: 'r2',
                        label: 'Cloudflare R2',
                        writes: {
                            MEDIA_S3_REGION: 'auto',
                            MEDIA_S3_FORCE_PATH_STYLE: undefined
                        },
                        then: [
                            {
                                id: 'account',
                                kind: 'text',
                                label: 'R2 account ID'
                            }
                        ]
                    },
                    {
                        value: 'minio',
                        label: 'MinIO',
                        writes: { MEDIA_S3_FORCE_PATH_STYLE: 'true' },
                        then: [
                            {
                                id: 'endpoint',
                                kind: 'text',
                                env: 'MEDIA_S3_ENDPOINT',
                                label: 'Endpoint',
                                default: (context) =>
                                    context.values['MEDIA_S3_ENDPOINT'] ??
                                    'http://localhost:9000',
                                validate: urlProblem
                            }
                        ]
                    },
                    {
                        value: 'other',
                        label: 'Another S3-compatible service (Spaces, B2, Wasabi)',
                        then: [
                            {
                                id: 'endpoint',
                                kind: 'text',
                                env: 'MEDIA_S3_ENDPOINT',
                                label: 'Endpoint',
                                default: current('MEDIA_S3_ENDPOINT'),
                                validate: urlProblem
                            },
                            {
                                id: 'region',
                                kind: 'text',
                                env: 'MEDIA_S3_REGION',
                                label: 'Region',
                                default: (context) =>
                                    context.values['MEDIA_S3_REGION'] ?? 'auto'
                            }
                        ]
                    }
                ]
            },
            {
                id: 'auth',
                kind: 'choice',
                label: 'How does the app sign in to the bucket?',
                choices: [
                    {
                        value: 'keys',
                        label: 'Access keys',
                        then: [
                            {
                                id: 'key',
                                kind: 'text',
                                env: 'MEDIA_S3_ACCESS_KEY_ID',
                                label: 'Access key ID',
                                default: current('MEDIA_S3_ACCESS_KEY_ID')
                            },
                            {
                                id: 'secret',
                                kind: 'secret',
                                env: 'MEDIA_S3_SECRET_ACCESS_KEY',
                                label: 'Secret access key',
                                default: current('MEDIA_S3_SECRET_ACCESS_KEY')
                            }
                        ]
                    },
                    {
                        value: 'role',
                        label: 'An instance role or IRSA — no keys',
                        hint: 'blank keys would shadow the role, so none are written',
                        writes: {
                            MEDIA_S3_ACCESS_KEY_ID: undefined,
                            MEDIA_S3_SECRET_ACCESS_KEY: undefined
                        }
                    }
                ]
            },
            {
                id: 'direct',
                kind: 'confirm',
                label: 'Serve downloads straight from the bucket with signed URLs?',
                default: (context) =>
                    context.values['MEDIA_DIRECT_SERVE'] === 'signed-url',
                writes: {
                    yes: { MEDIA_DIRECT_SERVE: 'signed-url' },
                    no: { MEDIA_DIRECT_SERVE: undefined }
                }
            }
        ],
        derive: (answers) =>
            answers['where'] === 'r2'
                ? {
                      MEDIA_S3_ENDPOINT: `https://${answers['account']}.r2.cloudflarestorage.com`
                  }
                : {}
    },
    {
        id: 'storage-gcs',
        title: 'Uploads — Google Cloud Storage',
        section: 'Storage',
        when: has('media-gcs'),
        fields: [
            {
                id: 'bucket',
                kind: 'text',
                env: 'MEDIA_GCS_BUCKET',
                label: 'Bucket',
                default: current('MEDIA_GCS_BUCKET')
            },
            {
                id: 'credentials',
                kind: 'choice',
                label: 'How does the app sign in?',
                choices: [
                    {
                        value: 'adc',
                        label: 'GKE or Cloud Run — Application Default Credentials',
                        writes: {
                            MEDIA_GCS_KEY_FILE: undefined,
                            MEDIA_GCS_PROJECT_ID: undefined
                        }
                    },
                    {
                        value: 'key',
                        label: 'A service-account key file',
                        then: [
                            {
                                id: 'file',
                                kind: 'text',
                                env: 'MEDIA_GCS_KEY_FILE',
                                label: 'Path to the key file',
                                default: current('MEDIA_GCS_KEY_FILE')
                            },
                            {
                                id: 'project',
                                kind: 'text',
                                env: 'MEDIA_GCS_PROJECT_ID',
                                label: 'Project ID',
                                default: current('MEDIA_GCS_PROJECT_ID'),
                                optional: true
                            }
                        ]
                    }
                ]
            },
            {
                id: 'iam',
                kind: 'confirm',
                label: 'Sign URLs through IAM (Workload Identity; needs iam.serviceAccounts.signBlob)?',
                default: (context) =>
                    context.values['MEDIA_GCS_SIGN_WITH_IAM'] === 'true',
                writes: {
                    yes: { MEDIA_GCS_SIGN_WITH_IAM: 'true' },
                    no: { MEDIA_GCS_SIGN_WITH_IAM: undefined }
                }
            },
            {
                id: 'direct',
                kind: 'confirm',
                label: 'Serve downloads straight from the bucket with signed URLs?',
                default: (context) =>
                    context.values['MEDIA_DIRECT_SERVE'] === 'signed-url',
                writes: {
                    yes: { MEDIA_DIRECT_SERVE: 'signed-url' },
                    no: { MEDIA_DIRECT_SERVE: undefined }
                }
            }
        ]
    },
    {
        id: 'storage-azure',
        title: 'Uploads — Azure Blob Storage',
        section: 'Storage',
        when: has('media-azure'),
        fields: [
            {
                id: 'container',
                kind: 'text',
                env: 'MEDIA_AZURE_CONTAINER',
                label: 'Container',
                default: (context) =>
                    context.values['MEDIA_AZURE_CONTAINER'] ?? 'media'
            },
            {
                id: 'connection',
                kind: 'secret',
                env: 'MEDIA_AZURE_CONNECTION_STRING',
                label: 'Connection string',
                help: () =>
                    'For a managed identity, build the container client in apps/server/src/plugins.ts instead — the environment cannot express it.',
                default: current('MEDIA_AZURE_CONNECTION_STRING')
            },
            {
                id: 'direct',
                kind: 'confirm',
                label: 'Serve downloads straight from the container with signed URLs?',
                default: (context) =>
                    context.values['MEDIA_DIRECT_SERVE'] === 'signed-url',
                writes: {
                    yes: { MEDIA_DIRECT_SERVE: 'signed-url' },
                    no: { MEDIA_DIRECT_SERVE: undefined }
                }
            }
        ]
    },
    {
        id: 'storage-vercel-blob',
        title: 'Uploads — Vercel Blob',
        section: 'Storage',
        when: has('media-vercel-blob'),
        fields: [
            {
                id: 'where',
                kind: 'choice',
                label: 'Where will the app run?',
                help: () =>
                    'Every blob gets a permanent public URL: anyone who has one can fetch the file without signing in.',
                choices: [
                    {
                        value: 'vercel',
                        label: 'On Vercel — the platform supplies the token',
                        writes: { BLOB_READ_WRITE_TOKEN: undefined }
                    },
                    {
                        value: 'elsewhere',
                        label: 'Somewhere else',
                        then: [
                            {
                                id: 'token',
                                kind: 'secret',
                                env: 'BLOB_READ_WRITE_TOKEN',
                                label: 'Read-write token',
                                default: current('BLOB_READ_WRITE_TOKEN')
                            }
                        ]
                    }
                ]
            }
        ]
    },
    {
        id: 'mail',
        title: 'Mail',
        section: 'Mail',
        when: has('mail'),
        check: 'mail',
        fields: [
            {
                id: 'how',
                kind: 'choice',
                label: 'How should invitations and password resets reach people?',
                default: (context) =>
                    context.values['MAIL_URL'] ? 'smtp' : 'none',
                choices: [
                    {
                        value: 'none',
                        label: 'Not by mail — administrators copy the link by hand',
                        writes: { MAIL_URL: undefined }
                    },
                    {
                        value: 'console',
                        label: 'Write them to the server log (development only)',
                        when: (context) =>
                            !context.production &&
                            context.features.has('workspace'),
                        writes: { MAIL_URL: 'console://' }
                    },
                    {
                        value: 'smtp',
                        label: 'An SMTP relay',
                        then: [
                            {
                                id: 'service',
                                kind: 'choice',
                                label: 'Which service?',
                                choices: [
                                    ...Object.entries(SMTP_PRESETS).map(
                                        ([value, preset]) => ({
                                            value,
                                            label: preset.label
                                        })
                                    ),
                                    {
                                        value: 'ses',
                                        label: 'Amazon SES',
                                        then: [
                                            {
                                                id: 'region',
                                                kind: 'text' as const,
                                                label: 'SES region',
                                                default: () => 'eu-west-1'
                                            }
                                        ]
                                    },
                                    {
                                        value: 'other',
                                        label: 'Another relay',
                                        then: [
                                            {
                                                id: 'host',
                                                kind: 'text' as const,
                                                label: 'Host'
                                            },
                                            {
                                                id: 'port',
                                                kind: 'text' as const,
                                                label: 'Port (587 STARTTLS, 465 implicit TLS)',
                                                default: () => '587',
                                                validate: (value: string) =>
                                                    /^\d+$/.test(value)
                                                        ? undefined
                                                        : 'A port number.'
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 'user',
                                kind: 'text',
                                label: 'Username (Enter for none)',
                                optional: true
                            },
                            {
                                id: 'password',
                                kind: 'secret',
                                label: 'Password or API key',
                                optional: true
                            },
                            {
                                id: 'requireTls',
                                kind: 'confirm',
                                label: 'Refuse to send if the connection cannot be encrypted?',
                                default: () => true
                            },
                            {
                                id: 'from',
                                kind: 'text',
                                env: 'MAIL_FROM',
                                label: 'From',
                                default: current('MAIL_FROM')
                            }
                        ]
                    }
                ]
            }
        ],
        derive: (answers) => {
            if (answers['how'] !== 'smtp') return {};
            const preset = SMTP_PRESETS[answers['service'] ?? ''];
            const host =
                answers['service'] === 'ses'
                    ? `email-smtp.${answers['region']}.amazonaws.com`
                    : (preset?.host ?? answers['host'] ?? '');
            const port = preset?.port ?? Number(answers['port'] ?? 587);
            return {
                MAIL_URL: buildMailUrl({
                    host,
                    port,
                    user: answers['user'] || preset?.user,
                    password: answers['password'] || undefined,
                    requireTls: answers['requireTls'] === 'yes'
                })
            };
        }
    },
    {
        id: 'sso-oidc',
        title: 'Single sign-on — OpenID Connect',
        section: 'Single sign-on',
        when: has('sso-oidc'),
        check: 'oidc',
        fields: [
            {
                id: 'configure',
                kind: 'choice',
                label: 'Configure it now?',
                help: (context) =>
                    `Register this callback URL with your provider first: ${callbackUrl(context, 'oidc')}`,
                default: (context) =>
                    context.values['SSO_OIDC_ISSUER'] ? 'yes' : 'skip',
                choices: [
                    {
                        value: 'yes',
                        label: 'Yes',
                        then: [
                            {
                                id: 'provider',
                                kind: 'choice',
                                label: 'Which provider?',
                                choices: [
                                    { value: 'google', label: 'Google' },
                                    {
                                        value: 'entra',
                                        label: 'Microsoft Entra ID',
                                        then: [
                                            {
                                                id: 'tenant',
                                                kind: 'text',
                                                label: 'Tenant ID'
                                            },
                                            {
                                                id: 'verified',
                                                kind: 'confirm',
                                                label: 'Does your directory own the addresses it reports? (Entra sends no email_verified; without this a first sign-in never links to an existing account)',
                                                default: () => false,
                                                writes: {
                                                    yes: {
                                                        SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT:
                                                            'true'
                                                    },
                                                    no: {
                                                        SSO_OIDC_EMAIL_VERIFIED_WHEN_ABSENT:
                                                            undefined
                                                    }
                                                }
                                            }
                                        ]
                                    },
                                    {
                                        value: 'okta',
                                        label: 'Okta',
                                        then: [
                                            {
                                                id: 'domain',
                                                kind: 'text',
                                                label: 'Okta domain (acme.okta.com)'
                                            }
                                        ]
                                    },
                                    {
                                        value: 'auth0',
                                        label: 'Auth0',
                                        then: [
                                            {
                                                id: 'domain',
                                                kind: 'text',
                                                label: 'Auth0 domain (acme.eu.auth0.com)'
                                            }
                                        ]
                                    },
                                    {
                                        value: 'keycloak',
                                        label: 'Keycloak',
                                        then: [
                                            {
                                                id: 'url',
                                                kind: 'text',
                                                label: 'Keycloak URL',
                                                validate: urlProblem
                                            },
                                            {
                                                id: 'realm',
                                                kind: 'text',
                                                label: 'Realm'
                                            }
                                        ]
                                    },
                                    {
                                        value: 'other',
                                        label: 'Another OpenID Connect provider',
                                        then: [
                                            {
                                                id: 'issuer',
                                                kind: 'text',
                                                label: 'Issuer (exactly as in its discovery document)',
                                                default:
                                                    current('SSO_OIDC_ISSUER'),
                                                validate: urlProblem
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 'client',
                                kind: 'text',
                                env: 'SSO_OIDC_CLIENT_ID',
                                label: 'Client ID',
                                default: current('SSO_OIDC_CLIENT_ID')
                            },
                            {
                                id: 'secret',
                                kind: 'secret',
                                env: 'SSO_OIDC_CLIENT_SECRET',
                                label: 'Client secret (Enter for a public client, PKCE only)',
                                default: current('SSO_OIDC_CLIENT_SECRET'),
                                optional: true
                            }
                        ]
                    },
                    {
                        ...SKIP,
                        writes: {
                            SSO_OIDC_ISSUER: undefined,
                            SSO_OIDC_CLIENT_ID: undefined
                        }
                    }
                ]
            }
        ],
        derive: (answers) =>
            answers['configure'] === 'yes'
                ? { SSO_OIDC_ISSUER: oidcIssuer(answers) }
                : {}
    },
    {
        id: 'sso-github',
        title: 'Single sign-on — GitHub',
        section: 'Single sign-on',
        when: has('sso-github'),
        fields: [
            {
                id: 'configure',
                kind: 'choice',
                label: 'Configure it now?',
                help: (context) =>
                    `Register this as the OAuth app's callback URL: ${callbackUrl(context, 'github')}`,
                default: (context) =>
                    context.values['SSO_GITHUB_CLIENT_ID'] ? 'yes' : 'skip',
                choices: [
                    {
                        value: 'yes',
                        label: 'Yes',
                        then: [
                            {
                                id: 'host',
                                kind: 'choice',
                                label: 'Which GitHub?',
                                choices: [
                                    {
                                        value: 'github.com',
                                        label: 'github.com',
                                        writes: {
                                            SSO_GITHUB_ENTERPRISE_URL: undefined
                                        }
                                    },
                                    {
                                        value: 'enterprise',
                                        label: 'GitHub Enterprise Server',
                                        then: [
                                            {
                                                id: 'url',
                                                kind: 'text',
                                                env: 'SSO_GITHUB_ENTERPRISE_URL',
                                                label: 'Its root URL',
                                                default: current(
                                                    'SSO_GITHUB_ENTERPRISE_URL'
                                                ),
                                                validate: urlProblem
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 'client',
                                kind: 'text',
                                env: 'SSO_GITHUB_CLIENT_ID',
                                label: 'Client ID',
                                default: current('SSO_GITHUB_CLIENT_ID')
                            },
                            {
                                id: 'secret',
                                kind: 'secret',
                                env: 'SSO_GITHUB_CLIENT_SECRET',
                                label: 'Client secret (required: GitHub has no PKCE)',
                                default: current('SSO_GITHUB_CLIENT_SECRET')
                            }
                        ]
                    },
                    {
                        ...SKIP,
                        writes: {
                            SSO_GITHUB_CLIENT_ID: undefined,
                            SSO_GITHUB_CLIENT_SECRET: undefined
                        }
                    }
                ]
            }
        ]
    },
    {
        id: 'sso-saml',
        title: 'Single sign-on — SAML 2.0',
        section: 'Single sign-on',
        when: has('sso-saml'),
        check: 'saml',
        fields: [
            {
                id: 'configure',
                kind: 'choice',
                label: 'Configure it now?',
                help: (context) =>
                    `The identity provider posts back to: ${callbackUrl(context, 'saml')}`,
                default: (context) =>
                    context.values['SSO_SAML_ENTRY_POINT'] ? 'yes' : 'skip',
                choices: [
                    {
                        value: 'yes',
                        label: 'Yes',
                        then: [
                            {
                                id: 'entry',
                                kind: 'text',
                                env: 'SSO_SAML_ENTRY_POINT',
                                label: "The identity provider's SSO URL",
                                default: current('SSO_SAML_ENTRY_POINT'),
                                validate: urlProblem
                            },
                            {
                                id: 'cert',
                                kind: 'choice',
                                label: 'Its signing certificate',
                                choices: [
                                    {
                                        value: 'file',
                                        label: 'A file on this machine',
                                        writes: {
                                            SSO_SAML_IDP_CERT: undefined
                                        },
                                        then: [
                                            {
                                                id: 'path',
                                                kind: 'text',
                                                env: 'SSO_SAML_IDP_CERT_FILE',
                                                label: 'Path to the PEM file',
                                                default: current(
                                                    'SSO_SAML_IDP_CERT_FILE'
                                                )
                                            }
                                        ]
                                    },
                                    {
                                        value: 'paste',
                                        label: 'Paste it (base64 on one line)',
                                        writes: {
                                            SSO_SAML_IDP_CERT_FILE: undefined
                                        },
                                        then: [
                                            {
                                                id: 'body',
                                                kind: 'secret',
                                                env: 'SSO_SAML_IDP_CERT',
                                                label: 'Certificate',
                                                default:
                                                    current('SSO_SAML_IDP_CERT')
                                            }
                                        ]
                                    }
                                ]
                            },
                            {
                                id: 'nameid',
                                kind: 'confirm',
                                label: 'Is the NameID an email address?',
                                default: (context) =>
                                    Boolean(
                                        context.values[
                                            'SSO_SAML_SUBJECT_ATTRIBUTE'
                                        ]
                                    )
                            },
                            {
                                id: 'subject',
                                kind: 'text',
                                env: 'SSO_SAML_SUBJECT_ATTRIBUTE',
                                label: 'The attribute holding a stable ID (an address follows a mailbox, not a person)',
                                default: current('SSO_SAML_SUBJECT_ATTRIBUTE'),
                                when: (_context, answers) =>
                                    answers['nameid'] === 'yes'
                            },
                            {
                                id: 'verified',
                                kind: 'confirm',
                                label: 'Does your directory own the addresses it reports? (SAML carries no verification claim)',
                                default: (context) =>
                                    context.values[
                                        'SSO_SAML_EMAIL_VERIFIED'
                                    ] === 'true',
                                writes: {
                                    yes: { SSO_SAML_EMAIL_VERIFIED: 'true' },
                                    no: { SSO_SAML_EMAIL_VERIFIED: undefined }
                                }
                            }
                        ]
                    },
                    {
                        ...SKIP,
                        writes: { SSO_SAML_ENTRY_POINT: undefined }
                    }
                ]
            }
        ]
    },
    {
        id: 'sso-policy',
        title: 'Who single sign-on lets in',
        section: 'Single sign-on',
        when: (context) =>
            Boolean(
                context.values['SSO_OIDC_ISSUER'] ||
                    context.values['SSO_GITHUB_CLIENT_ID'] ||
                    context.values['SSO_SAML_ENTRY_POINT']
            ),
        fields: [
            {
                id: 'provision',
                kind: 'choice',
                label: 'Who gets an account on their first sign-in?',
                default: (context) =>
                    context.values['SSO_PROVISION_DOMAINS']
                        ? 'domains'
                        : 'invited',
                choices: [
                    {
                        value: 'invited',
                        label: 'Only people already invited',
                        writes: {
                            SSO_PROVISION_DOMAINS: undefined,
                            SSO_PROVISION_ROLE: undefined
                        }
                    },
                    {
                        value: 'domains',
                        label: 'Anyone with an address at domains I list',
                        then: [
                            {
                                id: 'domains',
                                kind: 'text',
                                env: 'SSO_PROVISION_DOMAINS',
                                label: 'Domains, comma-separated',
                                default: current('SSO_PROVISION_DOMAINS')
                            },
                            {
                                id: 'role',
                                kind: 'text',
                                env: 'SSO_PROVISION_ROLE',
                                label: 'The role they start with',
                                default: (context) =>
                                    context.values['SSO_PROVISION_ROLE'] ??
                                    'viewer'
                            }
                        ]
                    }
                ]
            },
            {
                id: 'password',
                kind: 'confirm',
                label: 'Keep signing in with a password available? (The root admin keeps one either way)',
                default: (context) =>
                    context.values['SSO_ALLOW_PASSWORD_LOGIN'] !== 'false',
                writes: {
                    yes: { SSO_ALLOW_PASSWORD_LOGIN: undefined },
                    no: { SSO_ALLOW_PASSWORD_LOGIN: 'false' }
                }
            }
        ]
    },
    {
        id: 'copilot-anthropic',
        title: 'Copilot — Claude',
        section: 'Copilot',
        when: has('copilot-anthropic'),
        check: 'anthropic',
        fields: [
            {
                id: 'key',
                kind: 'secret',
                env: 'ANTHROPIC_API_KEY',
                label: 'Anthropic API key (Enter to leave Claude unregistered)',
                default: current('ANTHROPIC_API_KEY'),
                optional: true
            }
        ]
    },
    {
        id: 'copilot-openai',
        title: 'Copilot — an OpenAI-compatible endpoint',
        section: 'Copilot',
        when: has('copilot-openai'),
        check: 'openai',
        fields: [
            {
                id: 'where',
                kind: 'choice',
                label: 'Where is the model?',
                default: (context) =>
                    context.values['COPILOT_OPENAI_BASE_URL']
                        ? 'self-hosted'
                        : 'skip',
                choices: [
                    {
                        value: 'ollama',
                        label: 'Ollama on this machine',
                        writes: {
                            COPILOT_OPENAI_BASE_URL:
                                'http://localhost:11434/v1',
                            COPILOT_OPENAI_API_KEY: undefined
                        }
                    },
                    {
                        value: 'self-hosted',
                        label: 'vLLM, LM Studio, llama.cpp or another server of mine',
                        then: [
                            {
                                id: 'url',
                                kind: 'text',
                                env: 'COPILOT_OPENAI_BASE_URL',
                                label: 'Base URL (ending in /v1)',
                                default: current('COPILOT_OPENAI_BASE_URL'),
                                validate: urlProblem
                            },
                            {
                                id: 'key',
                                kind: 'secret',
                                env: 'COPILOT_OPENAI_API_KEY',
                                label: 'API key (Enter for none)',
                                optional: true
                            }
                        ]
                    },
                    {
                        value: 'hosted',
                        label: 'OpenAI, Azure OpenAI or a LiteLLM gateway',
                        then: [
                            {
                                id: 'url',
                                kind: 'text',
                                env: 'COPILOT_OPENAI_BASE_URL',
                                label: 'Base URL',
                                default: (context) =>
                                    context.values['COPILOT_OPENAI_BASE_URL'] ??
                                    'https://api.openai.com/v1',
                                validate: urlProblem
                            },
                            {
                                id: 'key',
                                kind: 'secret',
                                env: 'COPILOT_OPENAI_API_KEY',
                                label: 'API key',
                                default: current('COPILOT_OPENAI_API_KEY')
                            }
                        ]
                    },
                    {
                        ...SKIP,
                        writes: {
                            COPILOT_OPENAI_BASE_URL: undefined,
                            COPILOT_OPENAI_API_KEY: undefined
                        }
                    }
                ]
            },
            {
                id: 'models',
                kind: 'text',
                env: 'COPILOT_OPENAI_MODELS',
                label: 'Models people may pick, comma-separated (the first is the default)',
                default: (context) =>
                    context.values['COPILOT_OPENAI_MODELS'] ?? 'llama3.1',
                when: (context) =>
                    Boolean(context.values['COPILOT_OPENAI_BASE_URL'])
            }
        ]
    },
    {
        id: 'copilot',
        title: 'Copilot',
        section: 'Copilot',
        // Only once a backend is configured: turning it on with none refuses
        // to start.
        when: (context) =>
            Boolean(
                context.values['ANTHROPIC_API_KEY'] ||
                    context.values['COPILOT_OPENAI_BASE_URL']
            ),
        fields: [
            {
                id: 'enabled',
                kind: 'confirm',
                label: 'Turn the copilot on now?',
                default: (context) =>
                    context.values['COPILOT_ENABLED'] === 'true' ||
                    !context.production,
                writes: {
                    yes: { COPILOT_ENABLED: 'true' },
                    no: { COPILOT_ENABLED: 'false' }
                }
            }
        ]
    },
    {
        id: 'switches',
        title: 'Switches',
        section: 'Switches',
        when: (context) => context.features.has('mcp') || context.production,
        fields: [
            {
                id: 'mcp',
                kind: 'confirm',
                label: 'Turn on the MCP server? (agents with a full-scope API token can then edit content)',
                when: has('mcp'),
                default: (context) => context.values['MCP_ENABLED'] === 'true',
                writes: {
                    yes: { MCP_ENABLED: 'true' },
                    no: { MCP_ENABLED: 'false' }
                }
            },
            {
                id: 'docs',
                kind: 'confirm',
                label: 'Publish the API reference and GraphiQL?',
                when: (context) => context.production,
                default: (context) => context.values['API_DOCS'] === 'true',
                writes: {
                    yes: { API_DOCS: 'true' },
                    no: { API_DOCS: undefined }
                }
            }
        ]
    }
];
