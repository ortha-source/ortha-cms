/**
 * The copy for notices — on the same footing as `templates.ts`: code, in git,
 * English, overridable per kind through `MailPluginConfig.notificationTemplates`.
 *
 * The house shape, kept from the token messages: a greeting, plain sentences,
 * and every link spelled out in full, because a client that strips an anchor
 * still leaves something the reader can copy. No branding, no buttons.
 */

import { escapeHtml, type RenderedMail } from './templates';
import type {
    AlarmDigestNotice,
    Notice,
    NotificationKind,
    ReviewRequestedNotice
} from './notifications';

/** What a notice template is handed besides the notice itself. */
export interface NoticeContext {
    /** How the product refers to itself in the copy. */
    productName: string;
    /** Turns an app-relative path into an absolute link on `appUrl`. */
    url(path: string): string;
}

/** A template for one kind of notice. Pure, and trivially testable. */
export type NotificationTemplate<N extends Notice = Notice> = (
    notice: N,
    context: NoticeContext
) => RenderedMail;

/** One template per notice kind. A host may override any subset. */
export type NotificationTemplates = {
    [K in NotificationKind]: NotificationTemplate<Extract<Notice, { kind: K }>>;
};

/** A paragraph of a notice: text, or a link shown as its own URL. */
type Block = { text: string } | { link: string } | { heading: string };

function greeting(name: string | null | undefined): string {
    const trimmed = name?.trim();
    return trimmed ? `Hello ${trimmed},` : 'Hello,';
}

function textOf(blocks: readonly Block[]): string {
    return (
        blocks
            .map((block) =>
                'text' in block
                    ? block.text
                    : 'link' in block
                      ? block.link
                      : block.heading
            )
            .join('\n\n') + '\n'
    );
}

function htmlOf(blocks: readonly Block[]): string {
    const body = blocks
        .map((block) => {
            if ('link' in block) {
                const href = escapeHtml(block.link);
                return `        <p><a href="${href}">${href}</a></p>`;
            }
            if ('heading' in block) {
                return `        <p><strong>${escapeHtml(block.heading)}</strong></p>`;
            }
            return `        <p>${escapeHtml(block.text)}</p>`;
        })
        .join('\n');
    return [
        '<!doctype html>',
        '<html lang="en">',
        '    <body style="font-family: system-ui, sans-serif; line-height: 1.5;">',
        body,
        '    </body>',
        '</html>',
        ''
    ].join('\n');
}

function render(subject: string, blocks: readonly Block[]): RenderedMail {
    return { subject, text: textOf(blocks), html: htmlOf(blocks) };
}

/** "Alan, Grace" / "Alan and Grace" — a list a sentence can hold. */
function listOf(names: readonly string[]): string {
    if (names.length <= 1) return names[0] ?? '';
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The record as a sentence names it: its title, or what it is. */
function recordName(notice: ReviewRequestedNotice): string {
    return notice.entryTitle
        ? `“${notice.entryTitle}”`
        : `a record in ${notice.contentTypeLabel}`;
}

/**
 * Somebody named you as a reviewer. One message per request: approvals and
 * later saves send nothing, and asking again only mails the people newly
 * added — the queue page carries the rest.
 */
const reviewRequested: NotificationTemplate<ReviewRequestedNotice> = (
    notice,
    context
) => {
    const record = recordName(notice);
    const rule =
        notice.requiredApprovals > 0
            ? `${notice.contentTypeLabel} in this workspace need ${notice.requiredApprovals} ${
                  notice.requiredApprovals === 1 ? 'approval' : 'approvals'
              } before they can be published.`
            : `${notice.contentTypeLabel} in this workspace can be published without approval, so this is a second pair of eyes rather than a gate.`;
    const blocks: Block[] = [
        { text: greeting(notice.recipientName) },
        {
            text: `${notice.requesterName} has asked you to review ${record} in the ${notice.workspaceName} workspace of ${context.productName} before it is published.`
        },
        { text: rule },
        ...(notice.alsoAsked.length
            ? [
                  {
                      text: `${listOf(notice.alsoAsked)} ${notice.alsoAsked.length === 1 ? 'was' : 'were'} asked too.`
                  }
              ]
            : []),
        { text: 'Follow the link below to see what changed and approve it.' },
        { link: context.url(notice.reviewPath) },
        {
            text: 'You receive this because you were named as a reviewer. Approvals and later saves send nothing more.'
        }
    ];
    return render(
        `${notice.requesterName} asked you to review ${record}`,
        blocks
    );
};

/** Finding counts as a phrase: "3 new, 4 open". */
function counts(line: { newCount: number; openCount: number }): string {
    return `${line.newCount} new, ${line.openCount} open`;
}

/**
 * What the recipient's alarms flagged since the previous digest. Sent only on
 * a period in which something new was flagged; `info` never appears.
 */
const alarmDigest: NotificationTemplate<AlarmDigestNotice> = (
    notice,
    context
) => {
    const total = notice.sections.reduce(
        (sum, section) =>
            sum + section.lines.reduce((n, line) => n + line.newCount, 0),
        0
    );
    const workspaces = notice.sections.length;
    const since = notice.period === 'weekly' ? 'last week' : 'yesterday';
    const blocks: Block[] = [
        { text: greeting(notice.recipientName) },
        {
            text: `Since ${since} your alarms in ${context.productName} flagged ${total} new ${
                total === 1 ? 'record' : 'records'
            }. Alarms never block a save or a publish — this is so they get fixed before a reader notices.`
        }
    ];
    for (const section of notice.sections) {
        blocks.push({ heading: section.workspaceName });
        for (const line of section.lines) {
            blocks.push({
                text: `${line.severity === 'error' ? 'Error' : 'Warning'} · “${line.name}” — ${counts(line)} in ${line.contentTypeLabel}`
            });
        }
        blocks.push({ link: context.url(section.alarmsPath) });
    }
    blocks.push({
        text: `You get one digest ${notice.period === 'weekly' ? 'a week' : 'a day'}, and only when something new was flagged. Info-level findings are left out. Change how often, or turn it off, in your notification settings:`
    });
    blocks.push({ link: context.url(notice.settingsPath) });
    return render(
        `${total} new alarm ${total === 1 ? 'finding' : 'findings'} in ${workspaces} ${
            workspaces === 1 ? 'workspace' : 'workspaces'
        }`,
        blocks
    );
};

/** The shipped copy, one template per notice kind. */
export const DEFAULT_NOTIFICATION_TEMPLATES: NotificationTemplates = {
    review_requested: reviewRequested,
    alarm_digest: alarmDigest
};
