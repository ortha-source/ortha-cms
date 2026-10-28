import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { defineMessages, useIntl, type IntlShape } from 'react-intl';
import {
    BellRing,
    Check,
    RotateCcw,
    ShieldCheck,
    type LucideProps
} from 'lucide-react';
import { Badge, buttonVariants, cn } from '@orthacms/design-system';
import { sinceParts } from '@orthacms/utils-admin';
import { number, text, type InboxItem } from '../../../domain/types';

const messages = defineMessages({
    aRecord: { id: 'inbox.item.aRecord', defaultMessage: 'a record' },
    somebody: { id: 'inbox.item.somebody', defaultMessage: 'Somebody' },
    requested: {
        id: 'inbox.item.requested',
        defaultMessage: '{requester} asked you to review {title}'
    },
    requestedMeta: {
        id: 'inbox.item.requestedMeta',
        defaultMessage:
            '{required, plural, =0 {no approval required} one {# approval required} other {# approvals required}}'
    },
    ready: {
        id: 'inbox.item.ready',
        defaultMessage:
            '{title} has every approval it needs — you can publish it'
    },
    readyMeta: {
        id: 'inbox.item.readyMeta',
        defaultMessage:
            '{required, plural, one {# of # approvals} other {# of # approvals}}'
    },
    stale: {
        id: 'inbox.item.stale',
        defaultMessage:
            'Your approval of {title} no longer counts — it changed since'
    },
    staleMeta: {
        id: 'inbox.item.staleMeta',
        defaultMessage: 'You approved version {version}'
    },
    flagged: {
        id: 'inbox.item.flagged',
        defaultMessage:
            'Alarm “{rule}” flagged {count, plural, one {# record} other {# records}}'
    },
    error: { id: 'inbox.item.severity.error', defaultMessage: 'Error' },
    warn: { id: 'inbox.item.severity.warn', defaultMessage: 'Warning' },
    info: { id: 'inbox.item.severity.info', defaultMessage: 'Info' },
    unknown: {
        id: 'inbox.item.unknown',
        defaultMessage: 'Something happened that this version cannot describe'
    },
    actionReview: { id: 'inbox.item.action.review', defaultMessage: 'Review' },
    actionOpen: { id: 'inbox.item.action.open', defaultMessage: 'Open record' },
    actionAgain: {
        id: 'inbox.item.action.again',
        defaultMessage: 'Review again'
    },
    actionFindings: {
        id: 'inbox.item.action.findings',
        defaultMessage: 'See findings'
    },
    actionGeneric: {
        id: 'inbox.item.action.open.generic',
        defaultMessage: 'Open'
    },
    actionFor: {
        id: 'inbox.item.action.for',
        defaultMessage: '{action}: {sentence}'
    },
    unread: { id: 'inbox.item.unread', defaultMessage: 'Unread' }
});

/** How an item looks and what it says, by kind. */
type Reading = {
    icon: ComponentType<LucideProps>;
    /** The design-system soft tone of the icon tile. */
    tone: 'info' | 'success' | 'warning' | 'destructive-soft' | 'muted';
    sentence: string;
    meta: string | null;
    action: string;
    severity?: {
        label: string;
        variant: 'destructive-soft' | 'warning' | 'info';
    };
};

function titleOf(intl: IntlShape, item: InboxItem): string {
    const title = text(item, 'entryTitle');
    return title ? `“${title}”` : intl.formatMessage(messages.aRecord);
}

/** The sentence an item reads as, from its kind and payload. */
export function readItem(intl: IntlShape, item: InboxItem): Reading {
    switch (item.kind) {
        case 'review.requested':
            return {
                icon: ShieldCheck,
                tone: 'info',
                sentence: intl.formatMessage(messages.requested, {
                    requester:
                        text(item, 'requesterName') ??
                        intl.formatMessage(messages.somebody),
                    title: titleOf(intl, item)
                }),
                meta: intl.formatMessage(messages.requestedMeta, {
                    required: number(item, 'required')
                }),
                action: intl.formatMessage(messages.actionReview)
            };
        case 'review.ready':
            return {
                icon: Check,
                tone: 'success',
                sentence: intl.formatMessage(messages.ready, {
                    title: titleOf(intl, item)
                }),
                meta: intl.formatMessage(messages.readyMeta, {
                    required: number(item, 'required')
                }),
                action: intl.formatMessage(messages.actionOpen)
            };
        case 'review.approval_stale':
            return {
                icon: RotateCcw,
                tone: 'info',
                sentence: intl.formatMessage(messages.stale, {
                    title: titleOf(intl, item)
                }),
                meta: intl.formatMessage(messages.staleMeta, {
                    version: number(item, 'approvedRevisionNumber')
                }),
                action: intl.formatMessage(messages.actionAgain)
            };
        case 'alarm.flagged': {
            const severity = text(item, 'severity');
            const variant =
                severity === 'error'
                    ? 'destructive-soft'
                    : severity === 'warn'
                      ? 'warning'
                      : 'info';
            return {
                icon: BellRing,
                tone: variant,
                sentence: intl.formatMessage(messages.flagged, {
                    rule: text(item, 'ruleName') ?? '',
                    count: number(item, 'newCount')
                }),
                meta: null,
                action: intl.formatMessage(messages.actionFindings),
                severity: {
                    variant,
                    label: intl.formatMessage(
                        severity === 'error'
                            ? messages.error
                            : severity === 'warn'
                              ? messages.warn
                              : messages.info
                    )
                }
            };
        }
        default:
            return {
                icon: BellRing,
                tone: 'muted',
                sentence: intl.formatMessage(messages.unknown),
                meta: null,
                action: intl.formatMessage(messages.actionGeneric)
            };
    }
}

const TILE: Record<Reading['tone'], string> = {
    info: 'bg-info-soft text-info-soft-foreground',
    success: 'bg-success-soft text-success-soft-foreground',
    warning: 'bg-warning-soft text-warning-soft-foreground',
    'destructive-soft': 'bg-destructive-soft text-destructive-soft-foreground',
    muted: 'bg-muted text-muted-foreground'
};

function formatSince(intl: IntlShape, iso: string): string {
    const parts = sinceParts(iso);
    return parts.kind === 'relative'
        ? intl.formatRelativeTime(parts.value, parts.unit, {
              numeric: 'auto',
              style: 'short'
          })
        : intl.formatDate(parts.date, {
              month: 'short',
              day: 'numeric',
              year: parts.withYear ? 'numeric' : undefined
          });
}

type InboxItemRowProps = {
    item: InboxItem;
    /** The workspace's name, when the item concerns one the reader can see. */
    workspaceName: string | null;
    /** Called when the item is opened — the page marks it read. */
    onOpen: (item: InboxItem) => void;
};

/**
 * One item: a tile by kind, the sentence, where it is ("Marketing site ·
 * Pages · 2 approvals required"), how long ago, an unread mark in words as
 * well as a dot, and one action that opens it — which also marks it read.
 * The action's accessible name carries the sentence, so a list of "Review"
 * buttons is not a list of identical buttons.
 */
export function InboxItemRow({
    item,
    workspaceName,
    onOpen
}: InboxItemRowProps) {
    const intl = useIntl();
    const reading = readItem(intl, item);
    const Icon = reading.icon;
    const where = [
        workspaceName,
        text(item, 'contentTypeLabel'),
        reading.meta
    ].filter((part): part is string => Boolean(part));

    return (
        <li className="flex flex-wrap items-center gap-3 px-4 py-3.5">
            <span
                aria-hidden
                className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-lg',
                    TILE[reading.tone]
                )}
            >
                <Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-0.5">
                {/* A div, not a <p>: the severity Badge renders a <div>. */}
                <div
                    className={cn(
                        'flex flex-wrap items-center gap-2 text-sm',
                        !item.read && 'font-medium'
                    )}
                >
                    {reading.severity ? (
                        <Badge size="xs" variant={reading.severity.variant}>
                            {reading.severity.label}
                        </Badge>
                    ) : null}
                    <span>{reading.sentence}</span>
                </div>
                {where.length ? (
                    <p className="text-xs text-muted-foreground">
                        {where.join(' · ')}
                    </p>
                ) : null}
            </div>
            <time
                dateTime={item.createdAt}
                className="text-xs text-muted-foreground tabular-nums"
            >
                {formatSince(intl, item.createdAt)}
            </time>
            <span className="flex w-2 justify-center">
                {item.read ? null : (
                    <span className="size-2 rounded-full bg-brand">
                        <span className="sr-only">
                            {intl.formatMessage(messages.unread)}
                        </span>
                    </span>
                )}
            </span>
            <Link
                to={item.to}
                onClick={() => onOpen(item)}
                className={buttonVariants({ variant: 'outline', size: 'sm' })}
                aria-label={intl.formatMessage(messages.actionFor, {
                    action: reading.action,
                    sentence: reading.sentence
                })}
            >
                {reading.action}
            </Link>
        </li>
    );
}
