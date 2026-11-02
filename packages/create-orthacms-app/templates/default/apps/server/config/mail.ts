// orthacms:if mail
/**
 * Mail — whether this app sends anything, and what it sends as.
 *
 * **Unset is a complete configuration.** Leave `MAIL_URL` empty and this
 * returns `undefined`: no plugin, no queue, no worker, and the invite and reset
 * routes keep returning the raw link for an administrator to pass on by hand,
 * exactly as the product behaves with no mail installed at all. That is the
 * state a freshly scaffolded app runs in, so `npm run dev` works before you
 * have a relay.
 *
 * `MAIL_URL` names the relay in one line — `smtp://user:password@host:587`, or
 * `smtps://` for implicit TLS. Setting it makes `MAIL_FROM` required, and in
 * production `PUBLIC_URL`, because every link in every message is built from
 * it — deliberately not from the `Host` header, which the caller controls.
 *
 * Retry counts and the poll interval are the plugin's defaults; override them
 * here (`maxAttempts`, `deliveryIntervalMs`) if a relay needs it.
 */
import type { MailPluginConfig } from '@orthacms/mail-server';
// orthacms:if mail-smtp
import type { SmtpMailProviderOptions } from '@orthacms/mail-provider-smtp';
// orthacms:end
import { mailFromEnv } from '@orthacms/config';

// orthacms:if mail-smtp
/**
 * The backend this app was scaffolded with — one string, because a deployment
 * hands its messages to exactly one relay. A `MAIL_URL` naming another backend
 * refuses to start rather than reading as "send nothing".
 */
export type MailBackend = 'smtp';
// orthacms:end

/** Mail settings, plus the connection settings for the one backend it runs. */
export interface AppMailConfig extends MailPluginConfig {
    /** Which adapter `src/plugins.ts` constructs. */
    backend: MailBackend;
    // orthacms:if mail-smtp
    /** Whatever the SMTP adapter needs to reach the relay. */
    smtp: SmtpMailProviderOptions;
    // orthacms:end
}

/** The mail settings, or `undefined` when this app sends nothing. */
export function mailConfig(): AppMailConfig | undefined {
    // orthacms:if mail-smtp
    const mail = mailFromEnv(['smtp']);
    if (!mail?.smtp) return undefined;
    return { ...mail, backend: 'smtp', smtp: mail.smtp };
    // orthacms:end
}
// orthacms:end
