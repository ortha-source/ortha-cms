import { Link } from 'react-router-dom';
import { defineMessages, useIntl } from 'react-intl';
import { ArrowRight } from 'lucide-react';
import { Button } from '@orthacms/design-system';
import { DrillRecordRow, SignalDrill } from '@orthacms/insights-admin';
import { useMediaAltMissing } from '../../hooks/useMediaInsights';

/** Intl descriptors for the alt-text panel, co-located here. */
const messages = defineMessages({
    title: {
        id: 'media.insights.drill.alt.title',
        defaultMessage: 'Images missing alt text'
    },
    description: {
        id: 'media.insights.drill.alt.description',
        defaultMessage:
            'Images in the library with no alt text, the oldest upload first.'
    },
    heading: {
        id: 'media.insights.drill.alt.heading',
        defaultMessage:
            'Images missing alt text · {count, number} {count, plural, one {image} other {images}}'
    },
    meta: {
        id: 'media.insights.drill.alt.meta',
        defaultMessage: 'Uploaded {date}'
    },
    uploadedBy: {
        id: 'media.insights.drill.alt.uploadedBy',
        defaultMessage: 'Uploaded by {name}'
    },
    open: {
        id: 'media.insights.drill.alt.open',
        defaultMessage: 'Open Media Library'
    },
    empty: {
        id: 'media.insights.drill.alt.empty',
        defaultMessage: 'Every image has alt text.'
    }
});

/**
 * The images behind "Images missing alt text", the oldest upload first, with
 * who uploaded each — and the way to the library, where alt text is written.
 *
 * The library has no "missing alt text" filter of its own to land on, so the
 * button opens the library as it is rather than claiming a filtered view.
 */
export function MediaAltDrill() {
    const intl = useIntl();
    const { data, isPending, isError } = useMediaAltMissing();

    return (
        <SignalDrill
            title={intl.formatMessage(messages.title)}
            count={data?.total}
            heading={
                data
                    ? intl.formatMessage(messages.heading, {
                          count: data.total
                      })
                    : undefined
            }
            shown={data?.assets.length}
            description={intl.formatMessage(messages.description)}
            isPending={isPending}
            isError={isError}
            isEmpty={!!data && data.total === 0}
            emptyMessage={intl.formatMessage(messages.empty)}
            actions={
                <Button asChild variant="outline" size="sm">
                    <Link to="../media">
                        <ArrowRight aria-hidden="true" />
                        {intl.formatMessage(messages.open)}
                    </Link>
                </Button>
            }
        >
            {data?.assets.map((asset) => (
                <DrillRecordRow
                    key={asset.id}
                    title={asset.name}
                    meta={intl.formatMessage(messages.meta, {
                        date: intl.formatDate(asset.createdAt, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                        })
                    })}
                    personId={asset.uploadedBy}
                    personLabel={(name) =>
                        intl.formatMessage(messages.uploadedBy, { name })
                    }
                />
            ))}
        </SignalDrill>
    );
}
