import type { ReactNode } from 'react';
import { FormattedMessage, useIntl } from 'react-intl';
import type { ActivityEvent } from '../../../types/activityEvent';
import {
    actorName,
    sentenceDescriptor,
    sentenceValues
} from '../../activitySentence';
import { formatActivityAction } from '../../activityMessages';

/**
 * One event as a sentence — "**Grace Hopper** published **Spring launch**" —
 * the shared rendering of the feed row and the event panel's title, so the two
 * cannot describe one event two ways.
 *
 * A kind this admin has no sentence for still reads: the actor, then the
 * action label (which itself falls back to the raw kind).
 */
export function ActivitySentence({ event }: { event: ActivityEvent }) {
    const intl = useIntl();
    const descriptor = sentenceDescriptor(event.kind);
    const strong = (chunks: ReactNode[]) => (
        <span className="font-medium text-foreground">{chunks}</span>
    );

    if (!descriptor) {
        return (
            <>
                {strong([actorName(intl, event)])}{' '}
                {formatActivityAction(intl, event.kind)}
            </>
        );
    }
    // `FormattedMessage` rather than `intl.formatMessage`: it keys the rich
    // chunks it returns, which a bare array of elements would not be.
    return (
        <FormattedMessage
            {...descriptor}
            values={{ ...sentenceValues(intl, event), b: strong }}
        />
    );
}
