import {
    defined,
    readEnv,
    readFlag,
    readOptionalPositiveInt,
    requireEnv,
    when
} from '@orthacms/utils-server';

import { requirePublicUrl } from './urls';
import { workersEnabled } from './server';
import { warnOnce } from './warn';

/** A backend this package knows how to configure from `MAIL_URL`. */
export type MailBackend = 'smtp' | 'console';

/** The relay settings `@orthacms/mail-provider-smtp` takes. */
export interface SmtpSettings {
    host: string;
    port?: number;
    secure?: boolean;
    user?: string;
    password?: string;
    requireTls?: boolean;
}

/** Mail, as the environment configures it. */
export interface MailSettings {
    /** Which adapter `plugins.ts` constructs. */
    backend: MailBackend;
    /** The absolute URL every link in a message is built from. */
    appUrl: string;
    from: string;
    replyTo?: string;
    productName?: string;
    revealLinks: boolean;
    /** `0` when `ORTHACMS_WORKERS=false`: queue, but send nothing from here. */
    deliveryIntervalMs?: number;
    /** Present for `smtp`. */
    smtp?: SmtpSettings;
}

const SCHEMES: Readonly<Record<string, MailBackend>> = {
    'smtp:': 'smtp',
    'smtps:': 'smtp',
    'console:': 'console'
};

/** Parses `MAIL_URL` into a backend and, for SMTP, the relay. */
export function parseMailUrl(raw: string): {
    backend: MailBackend;
    smtp?: SmtpSettings;
} {
    let url: URL;
    try {
        url = new URL(raw);
    } catch {
        throw new Error(
            'MAIL_URL must be a URL such as smtp://user:password@smtp.example.com:587 or console://.'
        );
    }
    const backend = SCHEMES[url.protocol];
    if (!backend) {
        throw new Error(
            `MAIL_URL must start with smtp://, smtps:// or console:// (got "${url.protocol}//").`
        );
    }
    if (backend === 'console') {
        return { backend };
    }
    if (!url.hostname) {
        throw new Error('MAIL_URL names no relay host.');
    }
    let requireTls: boolean | undefined;
    for (const [key, value] of url.searchParams) {
        if (key !== 'requireTls') {
            throw new Error(
                `MAIL_URL has an option this server does not know: ${key}. The one it reads is requireTls.`
            );
        }
        if (value !== 'true' && value !== 'false') {
            throw new Error(
                `MAIL_URL's requireTls must be true or false (got "${value}").`
            );
        }
        requireTls = value === 'true';
    }
    return {
        backend,
        smtp: defined({
            host: url.hostname,
            port: url.port ? Number(url.port) : undefined,
            // `smtps://` is implicit TLS. Plain `smtp://` leaves it unset, which
            // upgrades with STARTTLS — `false` here would turn that off.
            secure: url.protocol === 'smtps:' ? true : undefined,
            user: url.username ? decodeURIComponent(url.username) : undefined,
            password: url.password
                ? decodeURIComponent(url.password)
                : undefined,
            requireTls
        })
    };
}

/** The pre-`MAIL_URL` spelling, still read with a warning. */
function legacyTransport():
    | { backend: MailBackend; smtp?: SmtpSettings }
    | undefined {
    const provider = readEnv('MAIL_PROVIDER');
    if (!provider) {
        return undefined;
    }
    warnOnce(
        'MAIL_PROVIDER',
        'MAIL_PROVIDER and SMTP_* are still read, but MAIL_URL replaces them — e.g. MAIL_URL=smtp://user:password@smtp.example.com:587. Move the values before the next release.'
    );
    if (provider === 'console') {
        return { backend: 'console' };
    }
    if (provider !== 'smtp') {
        throw new Error(
            `MAIL_PROVIDER must be "smtp" or "console" (got ${JSON.stringify(provider)}). Better: set MAIL_URL.`
        );
    }
    return {
        backend: 'smtp',
        smtp: defined({
            host: requireEnv(
                'SMTP_HOST',
                'MAIL_PROVIDER=smtp needs a relay to hand messages to — or set MAIL_URL instead.'
            ),
            port: readOptionalPositiveInt('SMTP_PORT'),
            secure: when(readEnv('SMTP_SECURE'), () =>
                readFlag('SMTP_SECURE', false)
            ),
            user: readEnv('SMTP_USER'),
            password: readEnv('SMTP_PASSWORD'),
            requireTls: when(readEnv('SMTP_REQUIRE_TLS'), () =>
                readFlag('SMTP_REQUIRE_TLS', false)
            )
        })
    };
}

/**
 * Mail, or `undefined` for a deployment that sends none — which is a complete
 * configuration: the invite and reset routes then return the link for an
 * administrator to pass on (ADR-0018).
 *
 * @param backends The adapters this app has installed. A `MAIL_URL` naming
 *   another refuses to start: mail that looks configured and reaches nobody is
 *   the failure this whole arrangement exists to avoid.
 */
export function mailFromEnv(
    backends: readonly MailBackend[]
): MailSettings | undefined {
    const raw = readEnv('MAIL_URL');
    const transport = raw ? parseMailUrl(raw) : legacyTransport();
    if (!transport) {
        return undefined;
    }
    if (!backends.includes(transport.backend)) {
        throw new Error(
            `MAIL_URL names the ${transport.backend} backend, which this app does not have installed (it has: ${backends.join(', ') || 'none'}).`
        );
    }
    return defined({
        ...transport,
        appUrl: requirePublicUrl('every link in an email is built from it'),
        from: requireEnv(
            'MAIL_FROM',
            'Mail is configured, so messages need a sender — e.g. "Ortha CMS <no-reply@example.com>".'
        ),
        replyTo: readEnv('MAIL_REPLY_TO'),
        productName: readEnv('MAIL_PRODUCT_NAME'),
        revealLinks: readFlag('MAIL_REVEAL_LINKS', false),
        deliveryIntervalMs: workersEnabled() ? undefined : 0
    });
}
