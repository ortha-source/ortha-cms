import { defineMessages, useIntl } from 'react-intl';
import { Alert, AlertDescription, AlertTitle } from '@orthacms/design-system';
import { BULK_VERDICT, type BulkVerdictKind } from '@orthacms/content-admin';
import type { PublishRunResult } from '../../../application/usePublishRun';

const messages = defineMessages({
    title: {
        id: 'publishing.outcome.title',
        defaultMessage:
            '{count, plural, =0 {Nothing was published} one {# entry published} other {# entries published}}'
    },
    skipped: {
        id: 'publishing.outcome.skipped',
        defaultMessage:
            '{count, plural, one {# entry was not published:} other {# entries were not published:}}'
    },
    reason: {
        id: 'publishing.outcome.reason',
        defaultMessage: '{name} — {reason}'
    },
    held: {
        id: 'publishing.outcome.held',
        defaultMessage: 'held by a publish rule (approvals outstanding)'
    },
    blocked: {
        id: 'publishing.outcome.blocked',
        defaultMessage: 'no longer passes its publish checks'
    },
    already: {
        id: 'publishing.outcome.already',
        defaultMessage: 'was already published'
    },
    gone: {
        id: 'publishing.outcome.gone',
        defaultMessage: 'is no longer available'
    },
    failed: {
        id: 'publishing.outcome.failed',
        defaultMessage:
            'Publishing stopped before {types} — the server couldn’t be reached. Nothing after that point was sent; check again and publish the rest.'
    }
});

/**
 * What the last commit did, in words: how many went live, which did not and
 * why (a guard's refusal reads differently from a check that no longer
 * passes), and — when a batch failed in transport — where the run stopped.
 * An `Alert`, because it is an event the reader triggered and its live region
 * is how a screen-reader user hears the result.
 */
export function PublishOutcomeSummary({
    result,
    nameOf
}: {
    result: PublishRunResult;
    /** The page's name for an entry ("{record} · {axis}"), or the id. */
    nameOf: (id: string) => string;
}) {
    const intl = useIntl();
    const published = [...result.outcomes.values()].filter(
        (outcome) => outcome.kind === 'published'
    ).length;
    const skipped = [...result.outcomes].flatMap(([id, outcome]) =>
        outcome.kind === 'skipped' ? [{ id, reason: outcome.reason }] : []
    );
    const reasonText = (reason: BulkVerdictKind) =>
        intl.formatMessage(
            reason === BULK_VERDICT.GuardRefused
                ? messages.held
                : reason === BULK_VERDICT.Blocked
                  ? messages.blocked
                  : reason === BULK_VERDICT.AlreadyPublished
                    ? messages.already
                    : messages.gone
        );
    const failedTypes = [
        ...new Set(result.failed.map((batch) => batch.type))
    ].join(', ');
    const trouble = skipped.length > 0 || result.failed.length > 0;
    return (
        <Alert variant={trouble ? 'warning' : 'success'}>
            <AlertTitle>
                {intl.formatMessage(messages.title, { count: published })}
            </AlertTitle>
            {trouble ? (
                <AlertDescription>
                    {skipped.length > 0 && (
                        <>
                            <p>
                                {intl.formatMessage(messages.skipped, {
                                    count: skipped.length
                                })}
                            </p>
                            <ul className="ml-4 list-disc">
                                {skipped.map(({ id, reason }) => (
                                    <li key={id}>
                                        {intl.formatMessage(messages.reason, {
                                            name: nameOf(id),
                                            reason: reasonText(reason)
                                        })}
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    {result.failed.length > 0 && (
                        <p>
                            {intl.formatMessage(messages.failed, {
                                types: failedTypes
                            })}
                        </p>
                    )}
                </AlertDescription>
            ) : null}
        </Alert>
    );
}
