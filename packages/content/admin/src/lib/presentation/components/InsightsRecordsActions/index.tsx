import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import {
    insightsRecordsLink,
    type InsightsRecordsFilter
} from '../../insightsRecordsLink';

/** Intl descriptors for the drill-down's way out, co-located here. */
const messages = defineMessages({
    all: {
        id: 'content.insights.drill.openAll',
        defaultMessage: 'Open all {count, number} in Records'
    },
    perType: {
        id: 'content.insights.drill.openType',
        defaultMessage: 'Open {count, number} in {type}'
    }
});

/**
 * The drill-down's way out to the records table, with the line's filter
 * applied.
 *
 * Records tables are per content type — there is no table of "all records" —
 * so a set that sits in one type gets the one "Open all N in Records" button,
 * and a set spread over several gets one button per type, biggest first. Each
 * lands on a table that filters, edits and saves its filter like any other.
 */
export function InsightsRecordsActions({
    types,
    filter
}: {
    /** Where the records sit, biggest first. */
    types: readonly { name: string; label: string; count: number }[];
    /** The line's filter. */
    filter: InsightsRecordsFilter;
}) {
    const intl = useIntl();
    if (types.length === 0) return null;

    if (types.length === 1) {
        const [only] = types;
        return (
            <Button asChild variant="outline" size="sm">
                <Link to={insightsRecordsLink(only.name, filter)}>
                    <ArrowRight aria-hidden="true" />
                    {intl.formatMessage(messages.all, { count: only.count })}
                </Link>
            </Button>
        );
    }

    return (
        <>
            {types.map((type) => (
                <Button key={type.name} asChild variant="outline" size="sm">
                    <Link to={insightsRecordsLink(type.name, filter)}>
                        <ArrowRight aria-hidden="true" />
                        {intl.formatMessage(messages.perType, {
                            count: type.count,
                            type: type.label
                        })}
                    </Link>
                </Button>
            ))}
        </>
    );
}
