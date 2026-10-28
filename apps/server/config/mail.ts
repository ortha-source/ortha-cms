/** Mail — the one backend this deployment sends through, and what it sends as. */
import type { MailPluginConfig } from '@orthacms/mail-server';
import type { SmtpMailProviderOptions } from '@orthacms/mail-provider-smtp';

import { mailFromEnv, type MailBackend } from '@orthacms/config';

export type { MailBackend };

/**
 * Mail settings, plus the connection settings for the one backend this
 * deployment runs.
 *
 * The backend settings live **here**, not in `MailPluginConfig`, for the same
 * reason media's and the copilot's do: the plugin names no backend.
 * `plugins.ts` already imports the adapter factory, so importing its config
 * type costs no new coupling.
 */
export interface OrthaCmsMailConfig extends MailPluginConfig {
    /** Which adapter `plugins.ts` constructs. */
    backend: MailBackend;
    /** Whatever the SMTP adapter needs; absent on `console`. */
    smtp?: SmtpMailProviderOptions;
}

/**
 * The mail settings, or `undefined` when this deployment sends nothing.
 *
 * **Unset is a complete configuration**, and the one a fresh clone runs: no
 * queue, no worker, and the invite and reset routes keep returning the raw
 * token for an administrator to relay by hand, exactly as they always have.
 *
 * `MAIL_URL` names the backend and the relay in one line. Setting it makes
 * `MAIL_FROM` required, and in production `PUBLIC_URL` — every link in a
 * message is built from it, and it is deliberately not derived from the
 * `Host` header, which the caller controls (ADR-0018 §5).
 *
 * `console://` is accepted here and in no generated app: reading an
 * invitation out of the dev server's log is what it is for, and it is never a
 * production answer — with a backend configured the API stops returning the
 * link, so a "sent" message would reach nobody (ADR-0018 §6).
 *
 * The rest is the plugin's own defaults — five hand-off attempts, a two-second
 * poll. Override them here (`maxAttempts`, `deliveryIntervalMs`) if a relay
 * needs it.
 */
export function mailConfig(): OrthaCmsMailConfig | undefined {
    return mailFromEnv(['smtp', 'console']);
}
