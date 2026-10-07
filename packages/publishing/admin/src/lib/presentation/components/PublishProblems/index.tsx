import { defineMessages, useIntl } from 'react-intl';
import { ExternalLink, XCircle } from 'lucide-react';
import {
    contentEntryPath,
    type BulkPublishVerdict
} from '@orthacms/content-admin';

const messages = defineMessages({
    title: {
        id: 'publishing.problems.title',
        defaultMessage:
            '{count, plural, one {# entry can’t publish yet} other {# entries can’t publish yet}}'
    },
    body: {
        id: 'publishing.problems.body',
        defaultMessage:
            'They stay as they are when you publish. Fix them in the editor, then re-check.'
    },
    open: {
        id: 'publishing.problems.open',
        defaultMessage: 'Open {name} in a new tab'
    },
    issue: {
        id: 'publishing.problems.issue',
        defaultMessage: '{field}: {message}'
    }
});

/** One blocked entry, named the way the page names its cell. */
export type PublishProblem = {
    verdict: BulkPublishVerdict;
    /** The content type, for the editor link. */
    type: string;
    /** "{record} · {axis}". */
    name: string;
};

/**
 * What the last check refused, with **why** — the per-field issues the dry run
 * reported — and a way to the editor that fixes it. A blocked entry only
 * shows an issue count in its cell; this is where the reason is spelled out,
 * once, rather than in a tooltip per cell.
 */
export function PublishProblems({
    workspaceId,
    problems
}: {
    workspaceId: string;
    problems: readonly PublishProblem[];
}) {
    const intl = useIntl();
    if (problems.length === 0) return null;
    return (
        <section
            aria-label={intl.formatMessage(messages.title, {
                count: problems.length
            })}
            className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-4"
        >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <XCircle className="size-4" aria-hidden />
                {intl.formatMessage(messages.title, {
                    count: problems.length
                })}
            </h2>
            <p className="text-sm text-muted-foreground">
                {intl.formatMessage(messages.body)}
            </p>
            <ul className="flex flex-col gap-2">
                {problems.map(({ verdict, type, name }) => (
                    <li key={verdict.id} className="text-sm">
                        <span className="flex items-center gap-1 font-medium">
                            {name}
                            <a
                                href={contentEntryPath(
                                    workspaceId,
                                    type,
                                    verdict.id
                                )}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={intl.formatMessage(messages.open, {
                                    name
                                })}
                                className="rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <ExternalLink
                                    className="size-3.5"
                                    aria-hidden
                                />
                            </a>
                        </span>
                        <ul className="ml-4 list-disc text-muted-foreground">
                            {verdict.issues.map((issue) => (
                                <li key={`${issue.field}:${issue.message}`}>
                                    {intl.formatMessage(messages.issue, {
                                        field:
                                            verdict.checks.find(
                                                (check) =>
                                                    check.field === issue.field
                                            )?.label ?? issue.field,
                                        message: issue.message
                                    })}
                                </li>
                            ))}
                        </ul>
                    </li>
                ))}
            </ul>
        </section>
    );
}
