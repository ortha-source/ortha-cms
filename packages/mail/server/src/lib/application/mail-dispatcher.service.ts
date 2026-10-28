import { Injectable } from '@nestjs/common';
import {
    MAIL_KINDS,
    NOTICE_TTL_MS,
    appLink,
    inviteLink,
    passwordResetLink,
    type MailDispatcher,
    type MailKind,
    type Notice,
    type NoticeContext,
    type NotificationDispatcher,
    type NotificationTemplate,
    type RevealableLink,
    type TransactionalMail
} from '@orthacms/mail-domain';
import { InjectMailConfig } from '../mail.tokens';
import type { ResolvedMailConfig } from '../types/mail-config';
import { MailDeliveryRepository } from '../infrastructure/mail-delivery.repository';

/**
 * Renders a transactional message and queues it in the caller's transaction.
 *
 * This is the adapter behind `MAIL_DISPATCHER`, the port `users-server` injects
 * optionally. Rendering happens here rather than at the call site for two
 * reasons: the copy and the `appUrl` it needs are this plugin's configuration,
 * and a caller that assembled its own body would be a second place the product
 * decides what an invitation says.
 */
@Injectable()
export class MailDispatcherService
    implements MailDispatcher, NotificationDispatcher
{
    constructor(
        private readonly deliveries: MailDeliveryRepository,
        @InjectMailConfig() private readonly config: ResolvedMailConfig
    ) {}

    /** Whether the deployment is in link-revealing (delivery-debugging) mode. */
    get revealsLinks(): boolean {
        return this.config.revealLinks;
    }

    /**
     * Renders `mail` and writes it to the queue.
     *
     * The write joins the caller's open transaction — the repository refuses
     * otherwise — so the message commits with the token it carries, or neither
     * of them does.
     */
    async enqueue(mail: TransactionalMail): Promise<void> {
        const link = this.linkFor(mail.kind, mail.token);
        const rendered = this.config.templates[mail.kind]({
            recipientName: mail.recipientName ?? null,
            recipientEmail: mail.to,
            actorName: mail.actorName ?? null,
            link,
            expiresAt: mail.expiresAt,
            productName: this.config.productName
        });

        await this.deliveries.enqueue({
            kind: mail.kind,
            toAddress: mail.to,
            subject: rendered.subject,
            bodyText: rendered.text,
            ...(rendered.html ? { bodyHtml: rendered.html } : {}),
            link,
            userId: mail.userId,
            expiresAt: mail.expiresAt
        });
    }

    /**
     * Renders a notice and writes it to the queue, in the caller's open
     * transaction like a token message.
     *
     * No `link` is stored — the row has no secret for `reveal-link` to hand
     * back — and it expires after {@link NOTICE_TTL_MS}, so a notice that
     * could not be handed over for days is swept rather than delivered late.
     */
    async notify(notice: Notice): Promise<void> {
        const context: NoticeContext = {
            productName: this.config.productName,
            url: (path) => appLink(this.config.appUrl, path)
        };
        // The map is keyed by kind, so this template takes exactly this
        // notice; TypeScript cannot follow the correlation through an index.
        const template = this.config.notificationTemplates[
            notice.kind
        ] as NotificationTemplate;
        const rendered = template(notice, context);

        await this.deliveries.enqueue({
            kind: notice.kind,
            toAddress: notice.to,
            subject: rendered.subject,
            bodyText: rendered.text,
            ...(rendered.html ? { bodyHtml: rendered.html } : {}),
            userId: notice.userId,
            expiresAt: new Date(Date.now() + NOTICE_TTL_MS)
        });
    }

    /** The link of the newest message to this user that never got out. */
    async revealableLink(userId: string): Promise<RevealableLink | null> {
        const row = await this.deliveries.newestUndeliveredFor(userId);
        if (!row?.link) return null;

        return {
            kind: row.kind as MailKind,
            link: row.link,
            queuedAt: row.createdAt,
            attempts: row.attempts,
            lastError: row.lastError
        };
    }

    /**
     * Which admin route this kind of message points at. An admin-issued reset
     * and a self-service recovery redeem the same kind of token, so they share
     * the reset route.
     */
    private linkFor(kind: MailKind, token: string): string {
        return kind === MAIL_KINDS.PASSWORD_RESET ||
            kind === MAIL_KINDS.PASSWORD_RECOVERY
            ? passwordResetLink(this.config.appUrl, token)
            : inviteLink(this.config.appUrl, token);
    }
}
