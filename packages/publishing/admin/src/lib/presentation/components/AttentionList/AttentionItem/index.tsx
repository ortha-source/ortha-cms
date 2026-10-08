import { defineMessages, useIntl } from 'react-intl';
import { ExternalLink, Globe } from 'lucide-react';
import {
    contentEntryPath,
    useContentSchema,
    type BulkPublishVerdict
} from '@orthacms/content-admin';
import type { PublishAnnotation } from '../../../slots/publishingSlots';

const messages = defineMessages({
    open: {
        id: 'publishing.attention.open',
        defaultMessage: 'Fix {name} in a new tab'
    },
    issue: {
        id: 'publishing.attention.issue',
        defaultMessage: '{field} {message}'
    },
    translated: {
        id: 'publishing.checks.translated',
        defaultMessage: '(translated per locale)'
    }
});

/**
 * One entry that needs attention, on one line: its name, what is wrong — each
 * failing field (a globe on one translated per locale, so "the German title"
 * reads differently from a shared field missing everywhere) and any blocking
 * note a plugin has (approvals) — and a link to the editor that fixes it.
 */
export function AttentionItem({
    workspaceId,
    type,
    entryId,
    name,
    verdict,
    notes
}: {
    workspaceId: string;
    type: string;
    entryId: string;
    /** "{record} · {language}". */
    name: string;
    /** The dry run's verdict, when it blocked the entry. */
    verdict?: BulkPublishVerdict;
    /** Blocking notes (approvals outstanding). */
    notes: readonly PublishAnnotation[];
}) {
    const intl = useIntl();
    const schema = useContentSchema(type, !!verdict);
    const localized = new Set(
        (schema.data?.fields ?? [])
            .filter((field) => field.localized)
            .map((field) => field.name)
    );
    const labelOf = (field: string) =>
        verdict?.checks.find((check) => check.field === field)?.label ?? field;
    return (
        <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 text-sm">
            <span className="flex items-center gap-1 font-medium">
                {name}
                <a
                    href={contentEntryPath(workspaceId, type, entryId)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={intl.formatMessage(messages.open, { name })}
                    className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ExternalLink className="size-3.5" aria-hidden />
                </a>
            </span>
            {(verdict?.issues ?? []).map((issue) => (
                <span
                    key={`${issue.field}:${issue.message}`}
                    className="inline-flex items-center gap-1 text-destructive"
                >
                    {localized.has(issue.field) ? (
                        <>
                            <Globe className="size-3.5" aria-hidden />
                            <span className="sr-only">
                                {intl.formatMessage(messages.translated)}
                            </span>
                        </>
                    ) : null}
                    {intl.formatMessage(messages.issue, {
                        field: labelOf(issue.field),
                        message: issue.message
                    })}
                </span>
            ))}
            {notes.map((note) => (
                <span key={note.label} className="text-warning-soft-foreground">
                    {note.label}
                    {note.description ? (
                        <span className="text-muted-foreground">
                            {' '}
                            — {note.description}
                        </span>
                    ) : null}
                </span>
            ))}
        </li>
    );
}
